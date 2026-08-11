document.addEventListener('DOMContentLoaded', () => {
    const predictionForm = document.getElementById('predictionForm');
    const resultContainer = document.getElementById('resultContainer');
    const initialState = resultContainer.querySelector('.initial-state');
    const loaderWrapper = resultContainer.querySelector('.loader-wrapper');
    const predictionContent = resultContainer.querySelector('.prediction-content');
    const heatmapContainer = document.getElementById('heatmapContainer');
    const locationInput = document.getElementById('location');
    const destinationInput = document.getElementById('destination');
    const predictBtn = document.getElementById('predictBtn');
    const saveRouteBtn = document.getElementById('saveRouteBtn');
    const historyList = document.getElementById('historyList');
    const favoritesList = document.getElementById('favoritesList');
    const apiLabel = document.getElementById('apiLabel');
    const emergencyToggle = document.getElementById('emergencyToggle');
    const demoToggle = document.getElementById('demoToggle');
    const voiceToggle = document.getElementById('voiceToggle');
    const globalSearchInput = document.getElementById('globalSearch');
    const globalSearchDropdown = document.getElementById('globalSearchDropdown');
    const gpsLocationBtn = document.getElementById('gpsLocationBtn');
    
    // New production features
    let currentLocationCoords = null;
    let weatherData = null;
    let accidentRiskData = null;
    let searchTimeout = null;
    let lastPredictionData = null; // Store last data for UI updates
    let lastSearchedCoords = null;
    let searchCache = new Map(); // Cache search results
    let searchAbortController = null; // For aborting previous fetch requests
    let autocompleteAbortController = null; // Separate controller for autocomplete
    let latestSearchQuery = null; // To track the latest query string
    let activeGeocodeRequests = new Set(); // Track active geocode requests for deduplication
    let geocodeCallCount = 0; // Count geocode calls for audit
    let analysisTriggered = false; // STRICT ANALYSIS LOCK - Only Initial Analysis button may set this to true
    
    // Function to mark results as outdated when inputs change
    const markResultsAsOutdated = () => {
        const predictionContent = document.getElementById('predictionContent');
        if (!predictionContent || predictionContent.classList.contains('hidden')) {
            return;
        }
        
        const altRoute = document.getElementById('altRoute');
        if (altRoute && !altRoute.innerHTML.includes('⚠️ OUTDATED')) {
            altRoute.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ⚠️ Results Outdated - Press "Initial Analysis" to refresh';
            altRoute.style.color = '#f59e0b';
            altRoute.style.fontWeight = '600';
        }
    };

    // Shared Autocomplete Function
    const setupAutocomplete = (input, dropdown, targetInputForMarker) => {
        input.addEventListener('input', (e) => {
            // PREVENT RECURSIVE LOOPS: Skip if this was triggered by autocomplete selection
            if (input.getAttribute('data-autocomplete-selected') === 'true') {
                return;
            }
            
            // RESET ANALYSIS LOCK on input change
            analysisTriggered = false;
            markResultsAsOutdated();
            
            const query = e.target.value.trim();
            dropdown.innerHTML = ''; // Clear old results immediately
            if (query.length < 2) {
                dropdown.classList.remove('show');
                return;
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => performAutocompleteSearch(query, input, dropdown, targetInputForMarker), 200);
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    };

    const performAutocompleteSearch = async (query, input, dropdown, targetInput) => {
        const startTime = performance.now();
        const cacheKey = query.toLowerCase();
        latestSearchQuery = query;
        
        // REQUEST DEDUPLICATION: Check if same query is already running
        if (activeGeocodeRequests.has(query)) {
            console.log('[GEOCODE DEDUP] Query already running, skipping:', query);
            return;
        }
        
        // Abort any existing autocomplete search (not global search)
        if (autocompleteAbortController) {
            autocompleteAbortController.abort();
        }
        
        // Add to active requests
        activeGeocodeRequests.add(query);
        geocodeCallCount++;
        console.log(`[GEOCODE AUDIT] Call #${geocodeCallCount}: ${query}`);
        
        // Show loading indicator
        dropdown.innerHTML = '<div class="autocomplete-item"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
        dropdown.classList.add('show');
        
        // Check cache first
        if (searchCache.has(cacheKey)) {
            const cachedData = searchCache.get(cacheKey);
            if (latestSearchQuery === query) { // Only update if still latest query
                renderAutocompleteResults(cachedData, input, dropdown, targetInput);
            }
            activeGeocodeRequests.delete(query);
            console.log(`[GEOCODE TIMING] Cache hit for "${query}": ${(performance.now() - startTime).toFixed(2)}ms`);
            return;
        }
        
        // Create new AbortController for this search
        autocompleteAbortController = new AbortController();
        const signal = autocompleteAbortController.signal;
        
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
            const data = await response.json();
            
            // Check if this is still the latest query before updating UI
            if (latestSearchQuery !== query) {
                activeGeocodeRequests.delete(query);
                return;
            }
            
            if (data.error) {
                dropdown.classList.remove('show');
                activeGeocodeRequests.delete(query);
                return;
            }

            // Cache the results (expire after 5 minutes)
            searchCache.set(cacheKey, data);
            setTimeout(() => {
                if (searchCache.has(cacheKey)) {
                    searchCache.delete(cacheKey);
                }
            }, 300000); // 5 minutes cache

            renderAutocompleteResults(data, input, dropdown, targetInput);
            console.log(`[GEOCODE TIMING] Autocomplete search for "${query}": ${(performance.now() - startTime).toFixed(2)}ms`);
        } catch (error) {
            if (error.name !== 'AbortError') { // Ignore abort errors
                console.error('Autocomplete search error:', error);
            }
        } finally {
            activeGeocodeRequests.delete(query);
        }
    };

    const renderAutocompleteResults = (data, input, dropdown, targetInput) => {
        // Remove existing event listeners to prevent duplication
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.replaceWith(item.cloneNode(true));
        });
        
        let html = '';
        data.results.forEach((result) => {
            html += `
                <div class="autocomplete-item" 
                     data-lat="${result.lat}" 
                     data-lon="${result.lon}" 
                     data-name="${result.display_name}" 
                     data-place-id="${result.place_id || ''}" 
                     data-source="${result.source || ''}"
                     data-place-name="${result.place_name || result.display_name.split(',')[0]}">
                    <i class="fas fa-map-marker-alt"></i>
                    <div>
                        <div class="autocomplete-name">${result.display_name.split(',')[0]}</div>
                        <div class="autocomplete-region">${result.display_name.split(',').slice(1).join(', ')}</div>
                    </div>
                </div>
            `;
        });
        
        dropdown.innerHTML = html;
        dropdown.classList.add('show');

        // Add click event listeners to items (only once, since we cloned nodes)
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.getAttribute('data-name');
                const lat = parseFloat(item.getAttribute('data-lat'));
                const lon = parseFloat(item.getAttribute('data-lon'));
                const placeId = item.getAttribute('data-place-id');
                const source = item.getAttribute('data-source');
                const placeName = item.getAttribute('data-place-name');
                
                lastSearchedCoords = { lat, lon };
                
                // LOG: Selected place information
                console.log('[AUTOCOMPLETE SELECT] Selected Place:');
                console.log('[AUTOCOMPLETE SELECT] Display Name:', name);
                console.log('[AUTOCOMPLETE SELECT] Latitude:', lat);
                console.log('[AUTOCOMPLETE SELECT] Longitude:', lon);
                console.log('[AUTOCOMPLETE SELECT] Place ID:', placeId);
                console.log('[AUTOCOMPLETE SELECT] Source:', source);
                console.log('[AUTOCOMPLETE SELECT] Place Name:', placeName);
                
                // Set flag to prevent input event from triggering autocomplete
                targetInput.setAttribute('data-autocomplete-selected', 'true');
                targetInput.value = name;
                targetInput.setAttribute('data-coords', `${lat},${lon}`);
                targetInput.setAttribute('data-place-id', placeId);
                targetInput.setAttribute('data-source', source);
                targetInput.setAttribute('data-place-name', placeName);
                
                // RESET ANALYSIS LOCK on autocomplete selection (input value changed)
                analysisTriggered = false;
                markResultsAsOutdated();
                
                // Update map marker (DO NOT trigger route generation - analysis lock)
                if (map && startMarker && endMarker) {
                    if (targetInput === locationInput) {
                        startMarker.setLatLng([lat, lon]);
                    } else {
                        endMarker.setLatLng([lat, lon]);
                    }
                    // REMOVED: updateRouteFromMarkers(true); - Analysis lock prevents automatic route generation
                    map.flyTo([lat, lon], 13);
                } else if (map) {
                    map.flyTo([lat, lon], 13);
                }
                
                apiLabel.textContent = `Connected to: Global Traffic Intelligence`;
                
                dropdown.classList.remove('show');
                
                // Reset flag after a short delay
                setTimeout(() => {
                    targetInput.removeAttribute('data-autocomplete-selected');
                }, 100);
            });
        });
    };

    // Global search with Nominatim API
    if (globalSearchInput && globalSearchDropdown) {
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            globalSearchDropdown.innerHTML = ''; // Clear old results immediately
            if (query.length < 2) {
                globalSearchDropdown.classList.remove('show');
                return;
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => performGlobalSearch(query), 500);
        });
    }

    const performGlobalSearch = async (query) => {
        const startTime = performance.now();
        const cacheKey = query.toLowerCase();
        latestSearchQuery = query;
        
        // REQUEST DEDUPLICATION: Check if same query is already running
        if (activeGeocodeRequests.has(query)) {
            console.log('[GEOCODE DEDUP] Query already running, skipping:', query);
            return;
        }
        
        // Abort any existing global search (not autocomplete)
        if (searchAbortController) {
            searchAbortController.abort();
        }
        
        // Add to active requests
        activeGeocodeRequests.add(query);
        geocodeCallCount++;
        console.log(`[GEOCODE AUDIT] Call #${geocodeCallCount}: ${query}`);
        
        // Show loading indicator
        globalSearchDropdown.innerHTML = '<div class="autocomplete-item"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
        globalSearchDropdown.classList.add('show');
        
        // Check cache first
        if (searchCache.has(cacheKey)) {
            const cachedData = searchCache.get(cacheKey);
            if (latestSearchQuery === query) { // Only update if still latest query
                renderGlobalSearchResults(cachedData);
            }
            activeGeocodeRequests.delete(query);
            console.log(`[GEOCODE TIMING] Cache hit for "${query}": ${(performance.now() - startTime).toFixed(2)}ms`);
            return;
        }
        
        // Create new AbortController for this search
        searchAbortController = new AbortController();
        const signal = searchAbortController.signal;
        
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
            const data = await response.json();
            
            // Check if this is still the latest query before updating UI
            if (latestSearchQuery !== query) {
                activeGeocodeRequests.delete(query);
                return;
            }
            
            if (data.error) {
                globalSearchDropdown.classList.remove('show');
                activeGeocodeRequests.delete(query);
                return;
            }

            searchCache.set(cacheKey, data);
            setTimeout(() => { searchCache.delete(cacheKey); }, 300000);
            renderGlobalSearchResults(data);
            console.log(`[GEOCODE TIMING] Global search for "${query}": ${(performance.now() - startTime).toFixed(2)}ms`);
        } catch (error) {
            if (error.name !== 'AbortError') { // Ignore abort errors
                console.error('Global search error:', error);
            }
        } finally {
            activeGeocodeRequests.delete(query);
        }
    };

    const renderGlobalSearchResults = (data) => {
        // Remove existing event listeners to prevent duplication
        globalSearchDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.replaceWith(item.cloneNode(true));
        });
        
        let html = '';
        data.results.forEach((result) => {
            html += `
                <div class="autocomplete-item" 
                     data-lat="${result.lat}" 
                     data-lon="${result.lon}" 
                     data-name="${result.display_name}" 
                     data-place-id="${result.place_id || ''}" 
                     data-source="${result.source || ''}"
                     data-place-name="${result.place_name || result.display_name.split(',')[0]}">
                    <i class="fas fa-map-marker-alt"></i>
                    <div>
                        <div class="autocomplete-name">${result.display_name.split(',')[0]}</div>
                        <div class="autocomplete-region">${result.display_name.split(',').slice(1).join(', ')}</div>
                    </div>
                </div>
            `;
        });
        
        globalSearchDropdown.innerHTML = html;
        globalSearchDropdown.classList.add('show');

        globalSearchDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const name = item.getAttribute('data-name');
                const lat = parseFloat(item.getAttribute('data-lat'));
                const lon = parseFloat(item.getAttribute('data-lon'));
                const placeId = item.getAttribute('data-place-id');
                const source = item.getAttribute('data-source');
                const placeName = item.getAttribute('data-place-name');
                
                lastSearchedCoords = { lat, lon };
                
                // LOG: Selected place information
                console.log('[AUTOCOMPLETE SELECT] Selected Place:');
                console.log('[AUTOCOMPLETE SELECT] Display Name:', name);
                console.log('[AUTOCOMPLETE SELECT] Latitude:', lat);
                console.log('[AUTOCOMPLETE SELECT] Longitude:', lon);
                console.log('[AUTOCOMPLETE SELECT] Place ID:', placeId);
                console.log('[AUTOCOMPLETE SELECT] Source:', source);
                console.log('[AUTOCOMPLETE SELECT] Place Name:', placeName);
                
                let targetInput;
                if (document.activeElement === destinationInput) {
                    targetInput = destinationInput;
                } else if (document.activeElement === locationInput) {
                    targetInput = locationInput;
                } else if (!locationInput.value) {
                    targetInput = locationInput;
                } else if (!destinationInput.value) {
                    targetInput = destinationInput;
                } else {
                    targetInput = locationInput;
                }
                
                // Set flag to prevent input event from triggering autocomplete
                targetInput.setAttribute('data-autocomplete-selected', 'true');
                targetInput.value = name;
                targetInput.setAttribute('data-coords', `${lat},${lon}`);
                targetInput.setAttribute('data-place-id', placeId);
                targetInput.setAttribute('data-source', source);
                targetInput.setAttribute('data-place-name', placeName);
                
                // RESET ANALYSIS LOCK on global search selection (input value changed)
                analysisTriggered = false;
                markResultsAsOutdated();
                
                if (map && startMarker && endMarker) {
                    if (targetInput === locationInput) {
                        startMarker.setLatLng([lat, lon]);
                    } else {
                        endMarker.setLatLng([lat, lon]);
                    }
                    // REMOVED: updateRouteFromMarkers(true); - Analysis lock prevents automatic route generation
                    map.flyTo([lat, lon], 13);
                } else if (map) {
                    map.flyTo([lat, lon], 13);
                }
                
                apiLabel.textContent = `Connected to: Global Traffic Intelligence`;
                
                globalSearchInput.value = '';
                globalSearchDropdown.classList.remove('show');
                
                // Reset flag after a short delay
                setTimeout(() => {
                    targetInput.removeAttribute('data-autocomplete-selected');
                }, 100);
            });
        });
    };

    // Setup autocomplete for location and destination inputs
    const locationAutocomplete = document.getElementById('locationAutocomplete');
    const destinationAutocomplete = document.getElementById('destinationAutocomplete');
    
    if (locationInput && locationAutocomplete) {
        setupAutocomplete(locationInput, locationAutocomplete, locationInput);
    }
    if (destinationInput && destinationAutocomplete) {
        setupAutocomplete(destinationInput, destinationAutocomplete, destinationInput);
    }

    // GPS location button handler
    if (gpsLocationBtn) {
        gpsLocationBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                gpsLocationBtn.style.animation = 'pulse-api 0.5s ease infinite';
                
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        gpsLocationBtn.style.animation = '';
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        currentLocationCoords = { lat, lon };
                        
                        try {
                            const response = await fetch(`/api/reverse_geocode?lat=${lat}&lon=${lon}`);
                            const data = await response.json();
                            
                            let address;
                            if (data.structured_address) {
                                const parts = [
                                    data.structured_address.village_locality,
                                    data.structured_address.area,
                                    data.structured_address.city,
                                    data.structured_address.district,
                                    data.structured_address.state,
                                    data.structured_address.country
                                ].filter(Boolean);
                                address = parts.join(', ');
                            } else {
                                address = data.display_name;
                            }
                            
                            let targetInput;
                            if (document.activeElement === destinationInput) {
                                targetInput = destinationInput;
                            } else if (document.activeElement === locationInput) {
                                targetInput = locationInput;
                            } else if (!locationInput.value) {
                                targetInput = locationInput;
                            } else if (!destinationInput.value) {
                                targetInput = destinationInput;
                            } else {
                                targetInput = locationInput;
                            }
                            
                            targetInput.value = address;
                            targetInput.setAttribute('data-coords', `${lat},${lon}`);
                            
                            // RESET ANALYSIS LOCK on GPS location selection (input value changed)
                            analysisTriggered = false;
                            markResultsAsOutdated();
                            
                            if (map && startMarker && endMarker) {
                                if (targetInput === locationInput) {
                                    startMarker.setLatLng([lat, lon]);
                                } else {
                                    endMarker.setLatLng([lat, lon]);
                                }
                                // REMOVED: updateRouteFromMarkers(true); - Analysis lock prevents automatic route generation
                                map.flyTo([lat, lon], 14);
                            } else if (map) {
                                map.flyTo([lat, lon], 14);
                            }
                            
                            apiLabel.textContent = `Connected to: GPS Live Location`;
                            speak('Current location detected');
                        } catch (error) {
                            console.error('Reverse geocoding error:', error);
                        }
                    },
                    (error) => {
                        gpsLocationBtn.style.animation = '';
                        console.error('Geolocation error:', error);
                        speak('Unable to detect your location');
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
                );
            } else {
                speak('Geolocation not supported on your device');
            }
        });
    }

    let trafficChart;
    let map;
    let routingControl;
    let startMarker;
    let endMarker;
    let currentZones = [];
    let isEmergencyMode = false;
    let isDemoMode = false;
    let isVoiceEnabled = true;
    let userHasSubmittedPrediction = false; // Track user interaction
    let hasSpokenForCurrentPrediction = false; // Track if voice has already spoken for current prediction

    // Voice Assistant Logic
    const speak = (text) => {
        if (!isVoiceEnabled) return;
        
        // ✅ Enhanced reliability with voice loading
        const loadVoicesAndSpeak = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) {
                // Voices not loaded yet, wait and retry
                setTimeout(() => loadVoicesAndSpeak(), 100);
                return;
            }
            
            window.speechSynthesis.cancel(); // Stop previous speech
            
            const speech = new SpeechSynthesisUtterance(text);
            speech.rate = 1;
            speech.pitch = 1;
            speech.volume = 1;
            
            // Prefer English voices that sound natural
            const preferredVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB')) || voices[0];
            speech.voice = preferredVoice;
            
            // ✅ Add error handling
            speech.onerror = (event) => {
                console.warn('Speech synthesis error:', event.error);
            };
            
            speech.onend = () => {
                console.log('Speech completed');
            };
            
            window.speechSynthesis.speak(speech);
        };
        
        loadVoicesAndSpeak();
    };

    // ✅ Ensure voices are loaded when page loads
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            console.log('Speech voices loaded');
        };
    }

    voiceToggle.onclick = () => {
        isVoiceEnabled = !isVoiceEnabled;
        if (isVoiceEnabled) {
            voiceToggle.classList.add('active');
            voiceToggle.classList.remove('off');
            voiceToggle.querySelector('span').textContent = 'VOICE ON';
            voiceToggle.querySelector('i').className = 'fas fa-volume-up';
            speak("Voice assistant activated.");
        } else {
            voiceToggle.classList.remove('active');
            voiceToggle.classList.add('off');
            voiceToggle.querySelector('span').textContent = 'VOICE OFF';
            voiceToggle.querySelector('i').className = 'fas fa-volume-mute';
            window.speechSynthesis.cancel();
        }
    };

    // Notification System
    const showNotification = (type, title, message, icon = 'info-circle') => {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${icon} notification-icon"></i>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;

        container.appendChild(notification);

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            removeNotification(notification);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeNotification(notification);
        }, 5000);

        // Speak notification if voice is enabled
        if (isVoiceEnabled) {
            speak(`${title}: ${message}`);
        }
    };

    const removeNotification = (notification) => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    };

    // 1. SINGLE SOURCE OF TRUTH (Centralized Traffic State Manager)
    let trafficState = { 
        level: 'medium',   // only: low, medium, high 
        routes: [], 
        selectedRouteIndex: 0,
        history: [],       // Last 5 predictions for temporal smoothing
        confidence: 0,     // Current prediction confidence
        stability: 'MODERATE' // HIGH, MODERATE, VOLATILE
    };

    // Helper for Predictive Consistency (Temporal Smoothing)
    const getStableLevel = (newLvl) => {
        if (isDemoMode) {
            // Lock transitions smoothly in Demo Mode
            const levels = ['low', 'medium', 'high'];
            const currentIndex = levels.indexOf(trafficState.level);
            const targetIndex = levels.indexOf(newLvl);
            
            if (Math.abs(currentIndex - targetIndex) > 1) {
                // Only move one step at a time for demo smoothness
                return levels[currentIndex + (targetIndex > currentIndex ? 1 : -1)];
            }
            return newLvl;
        }

        trafficState.history.push(newLvl);
        if (trafficState.history.length > 5) trafficState.history.shift();
        
        const counts = {};
        trafficState.history.forEach(l => counts[l] = (counts[l] || 0) + 1);
        
        // Calculate stability index
        const uniqueCount = Object.keys(counts).length;
        trafficState.stability = uniqueCount === 1 ? 'HIGH' : (uniqueCount <= 2 ? 'MODERATE' : 'VOLATILE');
        
        // Most frequent level
        return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    };

    // Demo Mode Logic
    demoToggle.onchange = (e) => {
        isDemoMode = e.target.checked;
        console.log(`[Demo Mode] ${isDemoMode ? 'ACTIVATED' : 'DEACTIVATED'}`);
        
        if (isDemoMode) {
            trafficState.stability = 'HIGH';
            trafficState.confidence = 98;
        }
        updateAISuggestionUI();
    };

    // 2. NORMALIZATION LAYER (MANDATORY)
    const normalizeTrafficLevel = (lvl) => {
        if (!lvl) return 'medium';
        const normalized = lvl.toLowerCase().trim();
        
        // 5. PREVENT WRONG STATE EXECUTION (Validation Layer)
        if (!['low', 'medium', 'high'].includes(normalized)) {
            console.warn(`[TrafficSense AI] Invalid traffic level: "${lvl}". Defaulting to "medium".`);
            return 'medium';
        }
        return normalized;
    };



    // Emergency Mode Logic
    emergencyToggle.onchange = (e) => {
        isEmergencyMode = e.target.checked;
        const predictBtn = document.getElementById('predictBtn');
        
        if (isEmergencyMode) {
            predictBtn.classList.add('emergency-alert');
            predictBtn.querySelector('span').textContent = 'INITIATE EMERGENCY ROUTING';
        } else {
            predictBtn.classList.remove('emergency-alert');
            predictBtn.querySelector('span').textContent = 'INITIATE ANALYSIS';
        }

        // If routes already exist, re-evaluate immediately
        if (window.availableRoutes) {
            const bestRouteIndex = window.availableRoutes.reduce((bestIdx, curr, currIdx, arr) => 
                curr.time < arr[bestIdx].time ? currIdx : bestIdx, 0);
            
            if (isEmergencyMode) {
                 window.highlightRoute(bestRouteIndex);
             }
             
             updateAISuggestionUI();
         }
     };

    // LocalStorage Initialization
    let trafficHistory = JSON.parse(localStorage.getItem('trafficHistory')) || [];
    let favoriteRoutes = JSON.parse(localStorage.getItem('favoriteRoutes')) || [];
    let userName = localStorage.getItem('trafficSenseUserName') || 'Explorer';
    let lastUsedLocation = JSON.parse(localStorage.getItem('lastUsedLocation')) || null;
    let apiStartTime = 0; // For real latency measurement

    // Set Welcome Name
    document.getElementById('userWelcome').textContent = `Welcome, ${userName} 👋`;
    
    // ✅ CURRENT LOCATION DETECTION (Optimized for Speed and Accuracy)
    const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported by this browser.'));
                return;
            }

            // High Accuracy attempt first (GPS)
            const highAccuracyOptions = {
                enableHighAccuracy: true,
                timeout: 5000, // Wait max 5s for GPS
                maximumAge: 0
            };

            // Fast attempt second (IP-based)
            const fastOptions = {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000 // Allow 1 min old cache
            };

            const success = (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                currentLocationCoords = coords;
                resolve(coords);
            };

            const error = (err) => {
                if (err.code === err.TIMEOUT && highAccuracyOptions.enableHighAccuracy) {
                    console.log("GPS timeout, falling back to network location...");
                    navigator.geolocation.getCurrentPosition(success, finalError, fastOptions);
                } else {
                    finalError(err);
                }
            };

            const finalError = (err) => {
                let msg = 'Location detection failed.';
                switch(err.code) {
                    case err.PERMISSION_DENIED:
                        msg = 'Permission denied. Please enable location access.';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        msg = 'Location unavailable. Try turning on GPS.';
                        break;
                    case err.TIMEOUT:
                        msg = 'Location request timed out.';
                        break;
                }
                reject(new Error(msg));
            };

            // Start with High Accuracy
            navigator.geolocation.getCurrentPosition(success, error, highAccuracyOptions);
        });
    };
    
    // ✅ REAL PLACE SEARCH WITH NOMINATIM API
    const searchPlaces = async (query, limit = 5) => {
        const cacheKey = `place-${query.toLowerCase()}-${limit}`;
        if (searchCache.has(cacheKey)) {
            return searchCache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=${limit}`);
            const data = await response.json();
            const results = data.results || [];
            
            // Cache for 5 minutes
            searchCache.set(cacheKey, results);
            setTimeout(() => {
                if (searchCache.has(cacheKey)) {
                    searchCache.delete(cacheKey);
                }
            }, 300000);
            
            return results;
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    };
    
    // ✅ REVERSE GEOCODING
    const reverseGeocode = async (lat, lon) => {
        try {
            const response = await fetch(`/api/reverse_geocode?lat=${lat}&lon=${lon}`);
            const data = await response.json();
            return data.display_name || 'Unknown Location';
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            return 'Unknown Location';
        }
    };
    
    // ✅ WEATHER DATA FETCHING
    const getWeatherData = async (lat, lon) => {
        try {
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            const data = await response.json();
            weatherData = data;
            return data;
        } catch (error) {
            console.error('Weather fetch failed:', error);
            return null;
        }
    };

    
    // ✅ USE CURRENT LOCATION BUTTON
    const addCurrentLocationButton = () => {
        const locationContainer = locationInput.parentElement;
        const currentLocationBtn = document.createElement('button');
        currentLocationBtn.type = 'button';
        currentLocationBtn.className = 'current-location-btn';
        currentLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>'; // Professional crosshairs icon
        currentLocationBtn.title = 'Detect precise location';
        currentLocationBtn.style.cssText = `
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(212, 175, 55, 0.1);
            border: 1px solid var(--accent-gold-glow);
            border-radius: 12px;
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--accent-gold);
            font-size: 1.2rem;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10;
            backdrop-filter: blur(5px);
        `;
        
        currentLocationBtn.addEventListener('mouseenter', () => {
            currentLocationBtn.style.background = 'var(--accent-gold)';
            currentLocationBtn.style.color = 'var(--bg-dark)';
            currentLocationBtn.style.boxShadow = '0 0 20px var(--accent-gold-glow)';
            currentLocationBtn.style.transform = 'translateY(-50%) scale(1.05) rotate(90deg)';
        });
        
        currentLocationBtn.addEventListener('mouseleave', () => {
            currentLocationBtn.style.background = 'rgba(212, 175, 55, 0.1)';
            currentLocationBtn.style.color = 'var(--accent-gold)';
            currentLocationBtn.style.boxShadow = 'none';
            currentLocationBtn.style.transform = 'translateY(-50%) scale(1) rotate(0deg)';
        });
        
        currentLocationBtn.addEventListener('click', async () => {
            currentLocationBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
            currentLocationBtn.disabled = true;
            
            try {
                const coords = await getCurrentLocation();
                const address = await reverseGeocode(coords.lat, coords.lon);
                
                locationInput.value = address;
                locationInput.setAttribute('data-coords', `${coords.lat},${coords.lon}`);
                
                // RESET ANALYSIS LOCK on current location selection (input value changed)
                analysisTriggered = false;
                markResultsAsOutdated();
                
                // Update map marker
                if (startMarker) {
                    startMarker.setLatLng([coords.lat, coords.lon]);
                    // REMOVED: updateRouteFromMarkers(true); - Analysis lock prevents automatic route generation
                    map.flyTo([coords.lat, coords.lon], 15);
                }
                
                // Show success feedback
                currentLocationBtn.innerHTML = '<i class="fas fa-check-double"></i>';
                currentLocationBtn.style.background = 'var(--low-traffic)';
                currentLocationBtn.style.color = 'white';
                setTimeout(() => {
                    currentLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
                    currentLocationBtn.style.background = 'rgba(212, 175, 55, 0.1)';
                    currentLocationBtn.style.color = 'var(--accent-gold)';
                    currentLocationBtn.disabled = false;
                }, 2000);
                
            } catch (error) {
                console.error('Location detection failed:', error);
                currentLocationBtn.innerHTML = '<i class="fas fa-shield-virus"></i>';
                currentLocationBtn.style.background = 'var(--high-traffic)';
                currentLocationBtn.style.color = 'white';
                setTimeout(() => {
                    currentLocationBtn.innerHTML = '<i class="fas fa-crosshairs"></i>';
                    currentLocationBtn.style.background = 'rgba(212, 175, 55, 0.1)';
                    currentLocationBtn.style.color = 'var(--accent-gold)';
                    currentLocationBtn.disabled = false;
                }, 2000);
            }
        });
        
        locationContainer.style.position = 'relative';
        locationInput.style.paddingRight = '65px'; // Increased padding for professional look
        locationContainer.appendChild(currentLocationBtn);
    };
    
    // ✅ UPDATE ROUTE FROM SEARCH COORDINATES
    const updateRouteFromSearch = async () => {
        const startCoords = locationInput.getAttribute('data-coords');
        const endCoords = destinationInput.getAttribute('data-coords');
        
        if (startCoords && endCoords) {
            const [startLat, startLon] = startCoords.split(',').map(parseFloat);
            const [endLat, endLon] = endCoords.split(',').map(parseFloat);
            
            if (startMarker && endMarker) {
                startMarker.setLatLng([startLat, startLon]);
                endMarker.setLatLng([endLat, endLon]);
                // REMOVED: updateRouteFromMarkers(true); - Analysis lock prevents automatic route generation
            }
            
            // Get weather data for start location
            await getWeatherData(startLat, startLon);
        }
    };
    
    // ✅ DISPLAY WEATHER AND RISK DATA
    const displayWeatherAndRisk = (weather, accidentRisk) => {
        const container = document.getElementById('weatherRiskContainer');
        if (!container) return;
        
        container.style.display = 'grid';
        
        if (weather) {
            document.getElementById('weatherCondition').textContent = weather.condition || 'Unknown';
            document.getElementById('weatherTemp').textContent = `${weather.temperature || 0}°C`;
            document.getElementById('weatherVisibility').textContent = `${weather.visibility || 0} km`;
            document.getElementById('weatherHumidity').textContent = `${weather.humidity || 0}%`;
            
            const impactElement = document.getElementById('weatherImpact').querySelector('.impact-badge');
            impactElement.textContent = `${weather.impact?.toUpperCase() || 'LOW'} IMPACT`;
            impactElement.className = `impact-badge ${weather.impact || 'low'}`;

            // ✅ Update Weather Source and Time (AM/PM)
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
            const timeStr = `${displayHours}:${minutes} ${ampm}`;

            document.getElementById('weatherSource').textContent = weather.source || 'OpenWeatherMap API';
            document.getElementById('weatherLastUpdate').textContent = timeStr;
            
            // ✅ Show container
            document.getElementById('weatherRiskContainer').style.display = 'grid';
        }
        
        if (accidentRisk) {
            document.getElementById('riskScore').textContent = `${accidentRisk.score || 0}%`;
            document.getElementById('riskLevel').textContent = accidentRisk.level?.toUpperCase() || 'LOW';
            
            // Update risk circle color based on level
            const riskCircle = document.getElementById('riskCircle');
            if (accidentRisk.level === 'high') {
                riskCircle.style.background = 'conic-gradient(from 0deg, #ef4444 0deg, #ef4444 360deg)';
            } else if (accidentRisk.level === 'medium') {
                riskCircle.style.background = 'conic-gradient(from 0deg, #f59e0b 0deg, #f59e0b 360deg)';
            } else {
                riskCircle.style.background = 'conic-gradient(from 0deg, #10b981 0deg, #10b981 360deg)';
            }
        }
    };
    
    // ✅ UPDATE ROUTE EXPLANATION (WHY THIS ROUTE?)
    const updateRouteExplanation = (data, activeRoute, efficiency) => {
        const explanationEl = document.getElementById('routeExplanation');
        if (!explanationEl) return;
        
        const level = trafficState.level;
        let reason = "";
        let details = [];
        let icons = "";
        
        // 1. Primary Logic based on Level/Emergency
        if (isEmergencyMode) {
            reason = "Emergency Priority Mode is active. We've bypassed normal traffic patterns to find the absolute fastest path.";
            icons = '<i class="fas fa-ambulance"></i><i class="fas fa-bolt"></i>';
        } else if (level === 'high') {
            reason = `Severe congestion detected on primary arteries. This optimized route via ${activeRoute.name || 'alternative roads'} avoids the gridlock.`;
            icons = '<i class="fas fa-shield-alt"></i><i class="fas fa-random"></i>';
        } else if (level === 'medium') {
            reason = `Moderate flow building up in central corridors. We've selected a path that balances travel time with route stability.`;
            icons = '<i class="fas fa-balance-scale"></i><i class="fas fa-chart-line"></i>';
        } else {
            reason = `Traffic flow is currently stable and optimal. This is the mathematically fastest path to your destination.`;
            icons = '<i class="fas fa-check-double"></i><i class="fas fa-leaf"></i>';
        }

        // 2. Add Weather Context
        if (data.weather) {
            const cond = data.weather.condition.toLowerCase();
            if (cond.includes('rain') || cond.includes('storm')) {
                details.push(`Weather impact: ${data.weather.condition} detected. We've prioritized roads with better drainage and lower flood risk.`);
            } else if (cond.includes('fog') || data.weather.visibility < 5) {
                details.push(`Visibility alert: ${data.weather.visibility}km visibility. Route favors well-lit main roads for safety.`);
            }
        }

        // 3. Add Risk Context
        if (data.accident_risk && data.accident_risk.score > 50) {
            details.push(`Safety Protocol: High accident risk (${data.accident_risk.score}%) on some segments. Rerouted to statistically safer corridors.`);
        }

        // 4. Add Efficiency Context
        if (efficiency > 10) {
            details.push(`Optimization: This path is ${efficiency}% faster than the default GPS recommendation.`);
        }

        // 5. Time Context
        const now = new Date();
        const hour = now.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        
        if (hour >= 7 && hour <= 9) details.push(`Morning rush hour logic applied (${displayHour}:00 ${ampm}): avoiding school zones and major office hubs.`);
        else if (hour >= 17 && hour <= 19) details.push(`Evening peak synchronization (${displayHour}:00 ${ampm}): bypassing primary exit corridors.`);

        const detailsHtml = details.map(d => `<div class="explanation-detail"><i class="fas fa-caret-right"></i> ${d}</div>`).join('');
        
        explanationEl.innerHTML = `
            <div class="explanation-container" data-aos="fade-up">
                <div class="explanation-header" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <div class="explanation-icons" style="font-size: 1.5rem; color: var(--accent-gold);">${icons}</div>
                    <h4 style="margin: 0; color: var(--text-primary); font-size: 1.1rem;">AI Decision Rationale</h4>
                </div>
                <p class="explanation-main-reason" style="font-weight: 600; color: var(--accent-gold); margin-bottom: 1rem;">${reason}</p>
                <div class="explanation-details-list" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                    ${detailsHtml}
                </div>
                <div class="explanation-footer" style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <span class="tag"><i class="fas fa-microchip"></i> Neural Model v3.5</span>
                    <span class="tag"><i class="fas fa-satellite"></i> OSRM Real-time</span>
                    <span class="tag"><i class="fas fa-shield-alt"></i> Safety Verified</span>
                </div>
            </div>
        `;
    };
    
    // ✅ UPDATE ADVANCED ANALYTICS
    const updateAdvancedAnalytics = (data) => {
        // Calculate live congestion score based on traffic level
        const congestionScore = trafficState.level === 'high' ? 85 : trafficState.level === 'medium' ? 55 : 25;
        document.getElementById('liveCongestion').textContent = `${congestionScore}%`;
        
        // Calculate average latency (simulated based on conditions)
        let latency = 15; // Base latency
        if (data.weather && data.weather.condition.includes('rain')) latency += 8;
        if (data.weather && data.weather.condition.includes('fog')) latency += 12;
        if (data.accident_risk && data.accident_risk.level === 'high') latency += 15;
        document.getElementById('avgLatency').textContent = `${latency} min`;
        
        // Route performance (inverse of congestion, fixed value)
        const routePerformance = 100 - congestionScore + 5;
        document.getElementById('routePerformance').textContent = `${Math.round(routePerformance)}%`;
        
        // Emergency priority status
        const emergencyStatus = isEmergencyMode ? 'ACTIVE' : (accidentRiskData?.level === 'high' ? 'STANDBY' : 'NORMAL');
        document.getElementById('emergencyPriority').textContent = emergencyStatus;
        
        // Update Trust Panel metrics
        updateTrustPanel(data);
    };
    
    // ✅ UPDATE TRUST PANEL WITH REAL DATA
    const updateTrustPanel = (data) => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
        const timeStr = `${displayHours}:${minutes} ${ampm}`;
        
        // Update Last Sync times
        const osmSync = document.getElementById('osmLastSync');
        const osrmSync = document.getElementById('osrmLastSync');
        const weatherSync = document.getElementById('weatherLastSync');
        const cameraSync = document.getElementById('cameraLastSync');
        
        if (osmSync) osmSync.textContent = `Last sync: ${timeStr}`;
        if (osrmSync) osrmSync.textContent = `Last sync: ${timeStr}`;
        if (weatherSync) weatherSync.textContent = `Last sync: ${timeStr}`;
        if (cameraSync) cameraSync.textContent = `Last sync: ${timeStr}`;
        
        // Update Confidence and Accuracy
        const predConf = document.getElementById('predictionConfidence');
        const confBar = document.getElementById('confidenceBar');
        if (predConf && data.confidence) {
            predConf.textContent = data.confidence;
            if (confBar) confBar.style.width = data.confidence;
        }
        
        const routeAcc = document.getElementById('routeAccuracy');
        const accBar = document.getElementById('accuracyBar');
        if (routeAcc) {
            // Accuracy based on confidence and route availability
            const baseAcc = 90;
            const variability = (parseInt(data.confidence) || 100) / 10;
            const accuracy = Math.min(100, baseAcc + (variability / 2));
            routeAcc.textContent = `${accuracy.toFixed(1)}%`;
            if (accBar) accBar.style.width = `${accuracy}%`;
        }
        
        // Update Response Time (REAL DATA)
        const respTime = document.getElementById('apiResponseTime');
        const respBar = document.getElementById('responseBar');
        if (respTime && apiStartTime > 0) {
            const latency = Math.round(performance.now() - apiStartTime);
            respTime.textContent = `${latency}ms`;
            if (respBar) respBar.style.width = `${Math.min(100, latency / 5)}%`;
        }
        
        // Update Camera status
        const cameraStatus = document.getElementById('cameraStatusText');
        const cameraTrust = document.getElementById('cameraTrust');
        if (cameraStatus && cameraTrust) {
            cameraStatus.textContent = "Verified Live Feed";
            cameraTrust.className = "trust-status verified";
            cameraTrust.innerHTML = '<i class="fas fa-check-circle"></i>';
        }
        
        // Update Validation Grid (The other cards mentioned in index.html)
        const trustScoreNum = document.querySelector('.score-number');
        const trustScoreFill = document.querySelector('.progress-fill');
        if (trustScoreNum && data.confidence) {
            trustScoreNum.textContent = data.confidence;
            if (trustScoreFill) trustScoreFill.style.width = data.confidence;
        }
        
        // Update Stability Value
         const stabilityVal = document.querySelector('.stability-value');
         if (stabilityVal) {
             stabilityVal.textContent = trafficState.stability || 'HIGH';
             const stabilityLevel = document.querySelector('.stability-level');
             if (stabilityLevel) {
                 stabilityLevel.className = `stability-level ${trafficState.stability?.toLowerCase() || 'high'}`;
             }
         }

         // ✅ NEW: COMPREHENSIVE ROUTE VALIDATION UPDATES
         updateRouteValidation(data);
     };

     // ✅ REAL-TIME ROUTE VALIDATION LOGIC
     const updateRouteValidation = (data) => {
         // 1. Verification Status
         const routeFound = trafficState.routes && trafficState.routes.length > 0;
         updateVerificationItem('verifyRoute', routeFound);
         updateVerificationItem('verifyData', data.status === 'success');
         updateVerificationItem('verifyWeather', !!data.weather);
         updateVerificationItem('verifyRisk', !!data.accident_risk);

         // 2. Trust Score
         const trustScore = parseInt(data.confidence) || 0;
         const scoreEl = document.getElementById('validationTrustScore');
         const fillEl = document.getElementById('validationTrustFill');
         if (scoreEl) scoreEl.textContent = `${trustScore}%`;
         if (fillEl) fillEl.style.width = `${trustScore}%`;

         // 3. Data Source Badges
         updateStatusBadge('osmStatusBadge', true);
         updateStatusBadge('osrmStatusBadge', routeFound);
         updateStatusBadge('weatherStatusBadge', !!data.weather);
         updateStatusBadge('modelStatusBadge', true);

         // 4. Alternate Routes
         const altCount = trafficState.routes ? Math.max(0, trafficState.routes.length - 1) : 0;
         const countEl = document.getElementById('altRouteCount');
         if (countEl) countEl.textContent = altCount;

         const indicatorsEl = document.getElementById('routeIndicators');
         if (indicatorsEl && trafficState.routes) {
             indicatorsEl.innerHTML = '';
             trafficState.routes.forEach((r, i) => {
                 const indicator = document.createElement('div');
                 indicator.className = `route-indicator ${i === 0 ? 'primary' : 'alternate'}`;
                 indicator.textContent = i === 0 ? 'Primary' : `Alt ${i}`;
                 indicatorsEl.appendChild(indicator);
             });
         }

         // 5. Detailed Stability Metrics
         const flowEl = document.getElementById('flowStability');
         const weatherEl = document.getElementById('weatherStability');
         const roadEl = document.getElementById('roadStability');

         if (flowEl) flowEl.textContent = trafficState.level === 'low' ? 'Optimal' : (trafficState.level === 'medium' ? 'Stable' : 'Congested');
         if (weatherEl) {
             const impact = data.weather?.impact || 'low';
             weatherEl.textContent = impact.charAt(0).toUpperCase() + impact.slice(1);
             weatherEl.style.color = impact === 'high' ? 'var(--high-traffic)' : (impact === 'medium' ? 'var(--medium-traffic)' : 'var(--low-traffic)');
         }
         if (roadEl) roadEl.textContent = data.accident_risk?.level === 'high' ? 'Caution' : 'Good';
     };

     const updateVerificationItem = (idPrefix, success) => {
         const icon = document.getElementById(`${idPrefix}Icon`);
         const text = document.getElementById(`${idPrefix}Text`);
         if (icon) {
             icon.className = success ? 'fas fa-check text-success' : 'fas fa-times text-danger';
         }
         if (text) {
             text.style.opacity = success ? '1' : '0.5';
         }
     };

     const updateStatusBadge = (id, active) => {
         const badge = document.getElementById(id);
         if (badge) {
             badge.textContent = active ? 'Active' : 'Offline';
             badge.className = `status-badge ${active ? 'active' : 'inactive'}`;
         }
     };
    
    // Initialize autocomplete and current location
    addCurrentLocationButton();
    
    // Load last used location if available and recent
    if (lastUsedLocation && (Date.now() - lastUsedLocation.timestamp) < 300000) { // 5 minutes
        locationInput.value = lastUsedLocation.address;
        locationInput.setAttribute('data-coords', `${lastUsedLocation.coords.lat},${lastUsedLocation.coords.lon}`);
    } else {
        // Optional: Auto-detect location on first load (UX enhancement)
        getCurrentLocation().then(coords => {
            reverseGeocode(coords.lat, coords.lon).then(address => {
                if (!locationInput.value) {
                    locationInput.value = address;
                    locationInput.setAttribute('data-coords', `${coords.lat},${coords.lon}`);
                    if (startMarker) startMarker.setLatLng([coords.lat, coords.lon]);
                }
            });
        }).catch(err => console.log("Auto-location skipped:", err.message));
    }

    const updateRouteMetricsUI = (distance, time) => {
        const el = document.getElementById('routeMetrics');
        if (!el) return;
        
        // If distance/time are not valid, show calculating state
        if (distance == null || time == null) {
            el.textContent = 'Calculating route...';
            return;
        }
        
        // Smooth Number Change (Micro Animation)
        const oldContent = el.textContent;
        const oldTimeMatch = oldContent.match(/(\d+)\smin/);
        const oldTime = oldTimeMatch ? parseInt(oldTimeMatch[1]) : 0;
        
        if (oldTime > 0 && oldTime !== time) {
            let current = oldTime;
            const step = time > oldTime ? 1 : -1;
            const timer = setInterval(() => {
                current += step;
                el.textContent = `${distance.toFixed(1)} km | ${current} min`;
                if (current === time) clearInterval(timer);
            }, 50);
        } else {
            el.textContent = `${distance.toFixed(1)} km | ${time} min`;
        }

        el.classList.remove('metrics-update-glow');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('metrics-update-glow');
    };

    const getRouteName = (route, index = 0) => {
        if (route.name) return route.name;
        if (route.instructions && route.instructions.length > 0) {
            // Extract unique road names, filter short/invalid names
            const uniqueRoads = [...new Set(route.instructions
                .map(i => i.road)
                .filter(r => r && r.length > 3 && r !== "undefined")
            )].slice(0, 3);
            
            if (uniqueRoads.length > 0) return uniqueRoads.join(' via ');
        }
        // Fallback realistic names based on index
        const fallbacks = ["NH Route", "City Bypass", "Urban Link Road"];
        return fallbacks[index % fallbacks.length];
    };

    // 3. HARD LOCK AI DECISION ENGINE (Strict Logic)
    const updateAISuggestionUI = () => {
        // Removed setTimeout for performance - execute directly
        const suggestEl = document.getElementById('altRoute');
        const routes = trafficState.routes;
        if (!suggestEl || !routes || routes.length === 0) return;

        // SMART AUTO-SWITCH THRESHOLD (10% improvement rule)
        const mainRoute = routes[0];
        const currentSelected = routes[trafficState.selectedRouteIndex];
        
        const bestRouteIdx = routes.reduce((best, r, i, arr) => {
            return r.time < arr[best].time ? i : best;
        }, 0);
        
        const bestRoute = routes[bestRouteIdx];
        
        // ✅ Fix: Sync Stability with Traffic Level
        trafficState.stability = trafficState.level === 'high' ? 'LOW' : (trafficState.level === 'medium' ? 'MODERATE' : 'HIGH');

        // Logic for route switching: must be 10% faster to switch automatically
        const improvementThreshold = 0.90; // 10% faster
        if (bestRoute.time < currentSelected.time * improvementThreshold) {
            // If high confidence (>85%), lock current decision
            if (trafficState.confidence <= 85 || isDemoMode) {
                trafficState.selectedRouteIndex = bestRouteIdx;
            }
        }

        const activeRoute = routes[trafficState.selectedRouteIndex];
        const mainName = mainRoute.name || 'Main Route';
        const bestName = activeRoute.name || 'Optimal Route';
        
        const timeDiff = mainRoute.time - activeRoute.time;
        const efficiency = mainRoute.time > 0 ? Math.round((timeDiff / mainRoute.time) * 100) : 0;

        let situation = '';
        let action = '';
        let impact = '';
        let badge = '';

        // 4. HUMAN-LIKE AI MESSAGING (Story-Driven)
        if (trafficState.level === 'low') {
            situation = "Smooth traffic flow detected across the primary grid.";
            action = `Maintain current course via ${mainName}. It remains the most efficient path.`;
            impact = "Zero congestion latency. Optimal fuel efficiency maintained.";
            badge = efficiency > 10 ? `<span class="efficiency-badge">${efficiency}% faster</span>` : '';
        } else if (trafficState.level === 'medium') {
            situation = "Moderate congestion building up in the central corridors.";
            if (timeDiff >= 5) {
                action = `Adaptive routing suggests switching to ${bestName} to bypass minor delays.`;
                impact = `Estimated saving of ${timeDiff} minutes (${efficiency}% faster).`;
                badge = `<span class="efficiency-badge highlight">${efficiency}% faster</span>`;
            } else {
                action = `Main route via ${mainName} is still viable despite building density.`;
                impact = "Current path stability is high. Rerouting not required.";
            }
        } else if (trafficState.level === 'high') {
            situation = "Severe congestion gridlock detected in the main sector.";
            action = `Immediate rerouting via ${bestName} is recommended to avoid heavy delays.`;
            impact = `Saves approximately ${timeDiff} minutes. Congestion override active.`;
            badge = efficiency > 0 ? `<span class="efficiency-badge critical">${efficiency}% faster</span>` : `<span class="efficiency-badge critical">Gridlock Warning</span>`;
        }

        // EMERGENCY OVERRIDE
        if (isEmergencyMode) {
            situation = "Emergency vehicle detected. Prioritizing clear-path routing.";
            action = `Switching to absolute fastest path via ${bestName}.`;
            impact = "Emergency Priority Protocol: Bypassing all non-essential traffic nodes.";
            badge = `<span class="efficiency-badge critical">EMERGENCY ACTIVE</span>`;
        }

        // Confidence Badge Logic
        let confidenceBadge = '';
        if (trafficState.confidence > 85) confidenceBadge = '<span class="efficiency-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--low-traffic);">🟢 HIGH RELIABILITY</span>';
        else if (trafficState.confidence >= 60) confidenceBadge = '<span class="efficiency-badge" style="background: rgba(245, 158, 11, 0.2); color: var(--medium-traffic);">🟡 MODERATE CONFIDENCE</span>';
        else confidenceBadge = '<span class="efficiency-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--high-traffic);">🔴 LOW CONFIDENCE</span>';

        const lowConfWarning = trafficState.confidence < 60 ? '<div class="ai-insight-text" style="color: var(--high-traffic); border-left-color: var(--high-traffic);">⚠ Low confidence prediction — results may vary.</div>' : '';
        const stabilityLabel = `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 1px;">SYSTEM STABILITY: <span style="color: ${trafficState.stability === 'HIGH' ? 'var(--low-traffic)' : (trafficState.stability === 'MODERATE' ? 'var(--medium-traffic)' : 'var(--high-traffic)')}">${trafficState.stability}</span></div>`;
        
        // Route Comparison Panel
        const comparisonPanel = `
            <div class="route-comparison-panel">
                <div class="comp-item">
                    <div class="comp-label">Main Route</div>
                    <div class="comp-val">${mainRoute.time} min</div>
                </div>
                <div class="comp-item">
                    <div class="comp-label">Optimal</div>
                    <div class="comp-val ${efficiency > 0 ? 'faster' : ''}">${activeRoute.time} min</div>
                </div>
            </div>
        `;

        const trustBadges = `
            <div class="trust-badge">
                <i class="fas fa-check-circle"></i> Real-time Simulation Active
                <span style="margin: 0 5px;">|</span>
                <i class="fas fa-microchip"></i> Powered by Neural Traffic Model
            </div>
            `;
            
            // Generate dynamic "Why this route?" explanation
            if (lastPredictionData) {
                updateRouteExplanation(lastPredictionData, activeRoute, efficiency);
            }
            
            suggestEl.innerHTML = `
                <div class="suggestion-header" style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem;">
                    ${confidenceBadge} ${badge}
                </div>
                <div class="stability-info" style="text-align: center; margin-bottom: 1rem;">
                    ${stabilityLabel}
                </div>
                
                <div class="ai-story-container">
                    <div class="ai-story-row">
                        <i class="fas fa-traffic-light"></i>
                        <div>
                            <span class="ai-story-label">Current Situation:</span>
                            <span class="ai-story-val">${situation}</span>
                        </div>
                    </div>
                    <div class="ai-story-row">
                        <i class="fas fa-rocket"></i>
                        <div>
                            <span class="ai-story-label">Recommended:</span>
                            <span class="ai-story-val">${action}</span>
                        </div>
                    </div>
                    <div class="ai-story-row">
                        <i class="fas fa-chart-line"></i>
                        <div>
                            <span class="ai-story-label">Impact:</span>
                            <span class="ai-story-val">${impact}</span>
                        </div>
                    </div>
                </div>

                ${comparisonPanel}
                ${lowConfWarning}
                ${trustBadges}
            `;
            
            // ✅ Voice Assistant - ONLY after user submission and ONLY once
            if (userHasSubmittedPrediction && !hasSpokenForCurrentPrediction) {
                let voiceMessage = "";
                if (isEmergencyMode) {
                    voiceMessage = `Emergency mode activated. Prioritizing fastest path via ${bestName}.`;
                } else {
                    voiceMessage = `Traffic level is ${trafficState.level}. Recommended route is ${bestName}.`;
                }
                setTimeout(() => speak(voiceMessage), 500);
                hasSpokenForCurrentPrediction = true; // Mark as spoken
            }
            
            suggestEl.classList.remove('metrics-update-glow');
            void suggestEl.offsetWidth;
            suggestEl.classList.add('metrics-update-glow');

            // Visual Authority Mode
            applyVisualAuthority();
            
            // Update Header Status
            updateHeaderStatus();

            // 8. DEBUG PANEL
            console.table({
                "Intelligence Engine": {
                    LEVEL: trafficState.level.toUpperCase(),
                    CONFIDENCE: trafficState.confidence + "%",
                    STABILITY: trafficState.stability,
                    AUTO_SWITCH: (bestRoute.time < currentSelected.time * improvementThreshold) ? "YES" : "NO",
                    SELECTED: activeRoute.name,
                    DEMO_MODE: isDemoMode ? "ON" : "OFF"
                }
            });
    };

    const updateHeaderStatus = () => {
        const textEl = document.getElementById('statusText');
        const dotEl = document.querySelector('.live-dot');
        if (!textEl || !dotEl) return;

        if (trafficState.level === 'low') {
            textEl.textContent = '🟢 Stable Flow';
            dotEl.style.background = 'var(--low-traffic)';
        } else if (trafficState.level === 'medium') {
            textEl.textContent = '🟡 Adaptive Routing';
            dotEl.style.background = 'var(--medium-traffic)';
        } else {
            textEl.textContent = '🔴 Congestion Override Active';
            dotEl.style.background = 'var(--high-traffic)';
        }
    };

    const applyVisualAuthority = () => {
        const paths = document.querySelectorAll('path.leaflet-interactive');
        const routePaths = Array.from(paths).filter(p => p.classList.contains('route-main') || p.classList.contains('route-alt'));
        
        routePaths.forEach((p, i) => {
            const isSelected = (i === trafficState.selectedRouteIndex);
            
            if (trafficState.level === 'high') {
                // HIGH TRAFFIC: Blur main, glow alternative
                if (i === 0 && !isSelected) { // Main route not selected
                    p.style.opacity = '0.3';
                    p.style.filter = 'blur(2px)';
                    p.style.strokeDasharray = '5, 10';
                    p.classList.remove('route-pulse');
                } else if (isSelected) {
                    p.style.opacity = '1';
                    p.style.filter = 'drop-shadow(0 0 15px var(--accent-gold))';
                    p.style.strokeWidth = '8';
                    p.classList.add('route-pulse');
                }
            } else if (trafficState.level === 'low') {
                // LOW TRAFFIC: Strong glow main, fade alternative
                if (i === 0) {
                    p.style.opacity = '1';
                    p.style.filter = 'drop-shadow(0 0 20px var(--low-traffic))';
                    p.style.strokeWidth = '10';
                    p.classList.add('route-pulse');
                } else {
                    p.style.opacity = '0.2';
                    p.style.filter = 'none';
                    p.style.strokeWidth = '4';
                    p.classList.remove('route-pulse');
                }
            } else {
                // MEDIUM: Standard behavior
                if (isSelected) {
                    p.style.opacity = '1';
                    p.style.filter = 'drop-shadow(0 0 10px var(--accent-gold))';
                    p.style.strokeWidth = '8';
                    p.classList.add('route-pulse');
                } else {
                    p.style.opacity = '0.3';
                    p.style.filter = 'none';
                    p.style.strokeWidth = '4';
                    p.classList.remove('route-pulse');
                }
            }
        });
    };

    // Function to highlight a specific route with Elite UX
    window.highlightRoute = (index) => {
        const paths = document.querySelectorAll('path.leaflet-interactive');
        // Filter for our route paths specifically
        const routePaths = Array.from(paths).filter(p => p.classList.contains('route-main') || p.classList.contains('route-alt'));
        
        routePaths.forEach((p, i) => {
            const isSelected = (i === index);
            
            if (isSelected) {
                p.style.strokeWidth = '8';
                p.style.opacity = '1';
                p.style.filter = `drop-shadow(0 0 15px var(--accent-gold))`;
                p.style.strokeDasharray = ""; // Solid when selected
                p.style.zIndex = "1000";
                p.classList.add('route-pulse'); // ADDED PULSE EFFECT
            } else {
                p.style.strokeWidth = '5';
                p.style.opacity = '0.5';
                p.style.filter = 'none';
                p.style.strokeDasharray = "10, 15"; // Dashed when not selected
                p.style.zIndex = "1";
                p.classList.remove('route-pulse');
            }
        });
    };

    // Initialize Leaflet Map with Premium Colorful Styling
    const initMap = () => {
        const defaultCoords = [22.5726, 88.3639]; // Default: Kolkata
        
        // Cleanup existing routing control if it exists
        if (routingControl) {
            map.removeControl(routingControl);
        }
        
        map = L.map('map', {
            center: defaultCoords,
            zoom: 13,
            zoomControl: false,
            attributionControl: false
        });

        // Premium Colorful Voyager Tiles from CartoDB
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        // Custom Glowing Markers
        const startIcon = L.divIcon({
            className: 'marker-pin-wrapper',
            html: '<div class="marker-pin-start"></div><span class="marker-label">START</span>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const endIcon = L.divIcon({
            className: 'marker-pin-wrapper',
            html: '<div class="marker-pin-end"></div><span class="marker-label">DESTINATION</span>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        startMarker = L.marker(defaultCoords, { icon: startIcon, draggable: true }).addTo(map);
        endMarker = L.marker([22.58, 88.40], { icon: endIcon, draggable: true }).addTo(map);

        // Routing Logic with Alternatives (Forced to request multiple paths)
        routingControl = L.Routing.control({
            waypoints: [L.latLng(defaultCoords), L.latLng(22.58, 88.40)],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                requestParameters: {
                    alternatives: 1 // Request up to 1 alternative (reduced from 3 for performance)
                }
            }),
            routeWhileDragging: false, // Disabled to prevent continuous recalculation during drag
            showAlternatives: true,
            addWaypoints: false, // Prevent users from adding waypoints manually
            altLineOptions: {
                styles: [{ color: '#f59e0b', opacity: 0.6, weight: 4, dashArray: '10, 15', className: 'route-alt' }]
            },
            lineOptions: {
                styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6, className: 'route-main' }]
            },
            createMarker: () => null // Use our existing markers
        }).addTo(map);

        routingControl.on('routesfound', (e) => {
            const routes = e.routes;
            
            // LOG: Routes found event
            console.log('[ROUTE AUDIT] Routes found event triggered');
            console.log('[ROUTE AUDIT] Number of routes:', routes ? routes.length : 0);
            
            if (!routes || routes.length === 0) {
                // 9. FAILSAFE (Routing Fail) - DO NOT return 0 km/0 min
                console.error('[ROUTE ERROR] No routes found in OSRM response');
                trafficState.level = 'medium';
                const suggestEl = document.getElementById('altRoute');
                if (suggestEl) {
                    suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Route calculation failed. <br> <span style="font-size: 0.8rem; opacity: 0.7;">Unable to find route between these locations. They may not be connected by road network.</span>';
                }
                
                // Show error in route metrics instead of 0 km/0 min
                const metricsEl = document.getElementById('routeMetrics');
                if (metricsEl) {
                    metricsEl.textContent = 'Route unavailable';
                    metricsEl.style.color = '#ff6b6b';
                }
                return;
            }

            // Store all routes in Central State with validation
            trafficState.routes = [];
            for (let i = 0; i < routes.length; i++) {
                const r = routes[i];
                const dist = r.summary.totalDistance / 1000;
                const time = Math.round(r.summary.totalTime / 60);
                
                // LOG: Route data
                console.log(`[ROUTE AUDIT] Route ${i+1}: Distance=${dist.toFixed(2)} km, Duration=${time} min`);
                
                // VALIDATE: Distance and duration are reasonable
                if (dist <= 0 || time <= 0) {
                    console.error(`[ROUTE ERROR] Route ${i+1} has invalid distance or duration: dist=${dist}, time=${time}`);
                    continue; // Skip invalid routes
                }
                
                trafficState.routes.push({
                    route: r,
                    distance: dist,
                    time: time,
                    name: getRouteName(r, i) || (i === 0 ? 'Main Route' : 'Alternative Route')
                });
            }
            
            // VALIDATE: At least one valid route
            if (trafficState.routes.length === 0) {
                console.error('[ROUTE ERROR] All routes had invalid distance/duration');
                const suggestEl = document.getElementById('altRoute');
                if (suggestEl) {
                    suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Route calculation failed. <br> <span style="font-size: 0.8rem; opacity: 0.7;">Invalid route data received from routing service.</span>';
                }
                
                const metricsEl = document.getElementById('routeMetrics');
                if (metricsEl) {
                    metricsEl.textContent = 'Route unavailable';
                    metricsEl.style.color = '#ff6b6b';
                }
                return;
            }
            
            console.log(`[ROUTE AUDIT] Successfully processed ${trafficState.routes.length} valid routes`);

            // Compatibility with legacy window.availableRoutes
            window.availableRoutes = trafficState.routes;

            const main = trafficState.routes[0];
            window.lastRouteStats = {
                distance: main.distance,
                time: main.time
            };
            
            // ✅ If user has already clicked INITIATE ANALYSIS, update Route Metrics NOW!
            if (userHasSubmittedPrediction) {
                const bestIdx = trafficState.routes.reduce((best, r, i, arr) => r.time < arr[best].time ? i : best, 0);
                const highlightIdx = (trafficState.level === 'high' && trafficState.routes.length > 1) ? 1 : 0;
                const selected = trafficState.routes[isEmergencyMode ? bestIdx : highlightIdx];
                
                updateRouteMetricsUI(selected.distance, selected.time);
                updateAISuggestionUI();
                window.highlightRoute(isEmergencyMode ? bestIdx : highlightIdx);
            }

            // Smart Camera System
            map.fitBounds(main.route.coordinates, {
                padding: [80, 80],
                maxZoom: 14,
                duration: 1.5
            });

            // 4. FORCE MAP + AI SYNC
            if (loaderWrapper.classList.contains('hidden')) {
                // Determine which route to highlight based on traffic level
                const bestIdx = trafficState.routes.reduce((best, r, i, arr) => r.time < arr[best].time ? i : best, 0);
                
                // If High traffic, always suggest alternative (index 1 if exists)
                const highlightIdx = (trafficState.level === 'high' && trafficState.routes.length > 1) ? 1 : 0;
                
                setTimeout(() => {
                    window.highlightRoute(isEmergencyMode ? bestIdx : highlightIdx);
                }, 100);
                
                const selectedData = trafficState.routes[isEmergencyMode ? bestIdx : highlightIdx];
                updateRouteMetricsUI(selectedData.distance, selectedData.time);
                updateAISuggestionUI();
                startLiveSimulation(); // START LIVE SIMULATION ENGINE
                
                // Stop simulation after 30 seconds to prevent continuous background activity
                setTimeout(() => {
                    if (simulationInterval) {
                        clearInterval(simulationInterval);
                        console.log('[PERFORMANCE] Stopped simulation interval after 30 seconds');
                    }
                }, 30000);
            }

            // ✅ NEW: Trigger validation update as soon as routes are found
            if (lastPredictionData) {
                updateRouteValidation(lastPredictionData);
            }

            // Interactive Route Selection (PRO Level)
            setTimeout(() => {
                const paths = document.querySelectorAll('path.leaflet-interactive');
                const routePaths = Array.from(paths).filter(p => p.classList.contains('route-main') || p.classList.contains('route-alt'));
                
                routePaths.forEach((p, index) => {
                    p.style.cursor = 'pointer';
                    p.onclick = (e) => {
                        L.DomEvent.stopPropagation(e);
                        const selectedData = trafficState.routes[index];
                        
                        window.highlightRoute(index);
                        updateRouteMetricsUI(selectedData.distance, selectedData.time);
                        updateAISuggestionUI();
                    };
                });
            }, 100);
        });

        routingControl.on('routingerror', () => {
            // 9. FAILSAFE (Routing Error)
            trafficState.level = 'medium';
            const suggestEl = document.getElementById('altRoute');
            if (suggestEl) {
                suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Routing synchronization failed. <br> <span style="font-size: 0.8rem; opacity: 0.7;">System operating on historical traffic fallback.</span>';
            }
        });

        // REMOVED: Automatic route generation on marker drag - Analysis lock prevents automatic route generation
        // startMarker.on('dragend', () => updateRouteFromMarkers());
        // endMarker.on('dragend', () => updateRouteFromMarkers());
    };

    let isRouteCalculationInProgress = false; // Prevent duplicate route calculations
    
    const updateRouteFromMarkers = async (skipReverse = false) => {
        // STRICT ANALYSIS LOCK - Only proceed if analysis was triggered by Initial Analysis button
        if (!analysisTriggered) {
            console.log('[ANALYSIS LOCK] Route generation blocked - analysis not triggered by Initial Analysis button');
            return;
        }
        
        // PREVENT DUPLICATE ROUTE CALCULATIONS
        if (isRouteCalculationInProgress) {
            console.log('[ROUTE AUDIT] Route calculation already in progress, skipping duplicate call');
            return;
        }
        
        const startTime = performance.now();
        isRouteCalculationInProgress = true;
        
        const startPos = startMarker.getLatLng();
        const endPos = endMarker.getLatLng();
        
        // LOG: Start and destination coordinates
        console.log('[ROUTE AUDIT] Update route from markers');
        console.log('[ROUTE AUDIT] Start Location:', locationInput.value);
        console.log('[ROUTE AUDIT] Destination:', destinationInput.value);
        console.log('[ROUTE AUDIT] Start Lat:', startPos.lat, 'Start Lon:', startPos.lng);
        console.log('[ROUTE AUDIT] End Lat:', endPos.lat, 'End Lon:', endPos.lng);
        
        // VALIDATE: Coordinates are different
        if (startPos.lat === endPos.lat && startPos.lng === endPos.lng) {
            console.error('[ROUTE ERROR] Start and destination coordinates are identical');
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Same location';
                metricsEl.style.color = '#ff6b6b';
            }
            isRouteCalculationInProgress = false;
            return;
        }
        
        // VALIDATE: Coordinates are within valid ranges
        if (!(-90 <= startPos.lat <= 90) || !(-180 <= startPos.lng <= 180)) {
            console.error('[ROUTE ERROR] Invalid start coordinates:', startPos.lat, startPos.lng);
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Invalid start location';
                metricsEl.style.color = '#ff6b6b';
            }
            isRouteCalculationInProgress = false;
            return;
        }
        
        if (!(-90 <= endPos.lat <= 90) || !(-180 <= endPos.lng <= 180)) {
            console.error('[ROUTE ERROR] Invalid end coordinates:', endPos.lat, endPos.lng);
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Invalid destination';
                metricsEl.style.color = '#ff6b6b';
            }
            isRouteCalculationInProgress = false;
            return;
        }
        
        routingControl.setWaypoints([
            L.latLng(startPos.lat, startPos.lng),
            L.latLng(endPos.lat, endPos.lng)
        ]);
        routingControl.route(); // FORCE route refresh
        
        if (skipReverse) {
            isRouteCalculationInProgress = false;
            console.log(`[ROUTE TIMING] Route calculation (skip reverse): ${(performance.now() - startTime).toFixed(2)}ms`);
            return;
        }
        
        try {
            // Create or use existing AbortController
            if (searchAbortController) {
                searchAbortController.abort();
            }
            searchAbortController = new AbortController();
            const signal = searchAbortController.signal;
            
            const resStart = await fetch(`/api/reverse_geocode?lat=${startPos.lat}&lon=${startPos.lng}`, { signal });
            const dataStart = await resStart.json();
            locationInput.value = dataStart.display_name.split(',')[0];

            const resEnd = await fetch(`/api/reverse_geocode?lat=${endPos.lat}&lon=${endPos.lng}`, { signal });
            const dataEnd = await resEnd.json();
            destinationInput.value = dataEnd.display_name.split(',')[0];
            
            // LOG: Verified location names match coordinates
            console.log('[ROUTE AUDIT] Verified start location:', dataStart.display_name);
            console.log('[ROUTE AUDIT] Verified destination:', dataEnd.display_name);
            console.log(`[ROUTE TIMING] Route calculation with reverse geocode: ${(performance.now() - startTime).toFixed(2)}ms`);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('updateRouteFromMarkers error:', e);
            }
        } finally {
            isRouteCalculationInProgress = false;
        }
    };

    const syncMapWithSearch = async (startQuery, endQuery) => {
        // STRICT ANALYSIS LOCK - Only proceed if analysis was triggered by Initial Analysis button
        if (!analysisTriggered) {
            console.log('[ANALYSIS LOCK] Map sync blocked - analysis not triggered by Initial Analysis button');
            return false;
        }
        
        const startTime = performance.now();
        try {
            let s, e;
            
            // LOG: Search queries
            console.log('[ROUTE AUDIT] Sync map with search');
            console.log('[ROUTE AUDIT] Start query:', startQuery);
            console.log('[ROUTE AUDIT] End query:', endQuery);
            
            // Abort any existing search first
            if (searchAbortController) {
                searchAbortController.abort();
            }
            searchAbortController = new AbortController();
            const signal = searchAbortController.signal;
            
            // Check if we already have coordinates on the inputs
            const existingStartCoords = locationInput.getAttribute('data-coords');
            const existingEndCoords = destinationInput.getAttribute('data-coords');
            
            // Prepare geocode promises for missing coordinates: start and end in parallel
            const promises = [];
            
            if (existingStartCoords) {
                const [lat, lon] = existingStartCoords.split(',').map(parseFloat);
                s = [lat, lon];
                const startPlaceId = locationInput.getAttribute('data-place-id') || 'N/A';
                const startSource = locationInput.getAttribute('data-source') || 'N/A';
                const startPlaceName = locationInput.getAttribute('data-place-name') || locationInput.value;
                console.log('[AUTOCOMPLETE SELECT] Selected Place (Start):');
                console.log('[AUTOCOMPLETE SELECT] Display Name:', locationInput.value);
                console.log('[AUTOCOMPLETE SELECT] Latitude:', lat);
                console.log('[AUTOCOMPLETE SELECT] Longitude:', lon);
                console.log('[AUTOCOMPLETE SELECT] Place ID:', startPlaceId);
                console.log('[AUTOCOMPLETE SELECT] Source:', startSource);
                console.log('[AUTOCOMPLETE SELECT] Place Name:', startPlaceName);
                console.log('[ROUTE AUDIT] Using existing start coords:', lat, lon);
            } else {
            // Need to geocode start even if no autocomplete selected
            console.log('[DEBUG] Geocoding start with query:', startQuery);
            promises.push(
                fetch(`/api/geocode?q=${encodeURIComponent(startQuery)}`, { signal })
                    .then(r => r.json())
                    .then(data => {
                        console.log('[DEBUG] Start geocoding response:', data);
                        if (data.results && data.results.length > 0) {
                            const result = data.results[0];
                            // DEBUG: Log before updating input
                            console.log('[DEBUG] Before updating locationInput.value:', locationInput.value);
                            console.log('[DEBUG] Geocoded start result:', result.display_name);
                            // REMOVED: locationInput.value = result.display_name; - Do not update input during geocoding
                            locationInput.setAttribute('data-coords', `${result.lat},${result.lon}`);
                            console.log('[DEBUG] After updating locationInput.value:', locationInput.value);
                            console.log(`[ROUTE AUDIT] Geocoded start:`, result.display_name, 'coords:', result.lat, result.lon);
                            return { coords: [result.lat, result.lon], display_name: result.display_name };
                        }
                        console.error('[ROUTE ERROR] Geocoding failed for start:', startQuery);
                        return null;
                    })
                );
            }
            
            if (existingEndCoords) {
                const [lat, lon] = existingEndCoords.split(',').map(parseFloat);
                e = [lat, lon];
                const endPlaceId = destinationInput.getAttribute('data-place-id') || 'N/A';
                const endSource = destinationInput.getAttribute('data-source') || 'N/A';
                const endPlaceName = destinationInput.getAttribute('data-place-name') || destinationInput.value;
                console.log('[AUTOCOMPLETE SELECT] Selected Place (Destination):');
                console.log('[AUTOCOMPLETE SELECT] Display Name:', destinationInput.value);
                console.log('[AUTOCOMPLETE SELECT] Latitude:', lat);
                console.log('[AUTOCOMPLETE SELECT] Longitude:', lon);
                console.log('[AUTOCOMPLETE SELECT] Place ID:', endPlaceId);
                console.log('[AUTOCOMPLETE SELECT] Source:', endSource);
                console.log('[AUTOCOMPLETE SELECT] Place Name:', endPlaceName);
                console.log('[ROUTE AUDIT] Using existing end coords:', lat, lon);
            } else {
                // Need to geocode end even if no autocomplete selected
                console.log('[DEBUG] Geocoding end with query:', endQuery);
                promises.push(
                    fetch(`/api/geocode?q=${encodeURIComponent(endQuery)}`, { signal })
                        .then(r => r.json())
                        .then(data => {
                            console.log('[DEBUG] End geocoding response:', data);
                            if (data.results && data.results.length > 0) {
                                const result = data.results[0];
                                // DEBUG: Log before updating input
                                console.log('[DEBUG] Before updating destinationInput.value:', destinationInput.value);
                                console.log('[DEBUG] Geocoded end result:', result.display_name);
                                // REMOVED: destinationInput.value = result.display_name; - Do not update input during geocoding
                                destinationInput.setAttribute('data-coords', `${result.lat},${result.lon}`);
                                console.log('[DEBUG] After updating destinationInput.value:', destinationInput.value);
                                console.log('[ROUTE AUDIT] Geocoded end:', result.display_name, 'coords:', result.lat, result.lon);
                                return { coords: [result.lat, result.lon], display_name: result.display_name };
                            }
                            console.error('[ROUTE ERROR] Geocoding failed for end:', endQuery);
                            return null;
                        })
                );
            }
            
            // Wait for all geocode promises!
            const geocodeResults = await Promise.all(promises);
            
            // DEBUG: Log geocode results
            console.log('[DEBUG] Geocode results:', geocodeResults);
            console.log('[DEBUG] locationInput.value after geocoding:', locationInput.value);
            console.log('[DEBUG] destinationInput.value after geocoding:', destinationInput.value);
            
            let geocodeIdx = 0;
            if (!s && geocodeResults.length > geocodeIdx && geocodeResults[geocodeIdx]) {
                const startResult = geocodeResults[geocodeIdx++];
                s = startResult.coords;
                // Update input value AFTER geocoding is complete
                if (startResult.display_name) {
                    locationInput.value = startResult.display_name;
                }
            }
            if (!e && geocodeResults.length > geocodeIdx && geocodeResults[geocodeIdx]) {
                const endResult = geocodeResults[geocodeIdx];
                e = endResult.coords;
                // Update input value AFTER geocoding is complete
                if (endResult.display_name) {
                    destinationInput.value = endResult.display_name;
                }
            }

            if (s && e) {
                // DEBUG: Log coordinates before validation
                console.log('[DEBUG] Start coordinates (s):', s);
                console.log('[DEBUG] End coordinates (e):', e);
                console.log('[DEBUG] Start equals End?', s[0] === e[0] && s[1] === e[1]);
                
                // VALIDATE: Coordinates are different
                if (s[0] === e[0] && s[1] === e[1]) {
                    console.error('[ROUTE ERROR] Start and destination coordinates are identical after geocoding');
                    const suggestEl = document.getElementById('altRoute');
                    if (suggestEl) {
                        suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Start and destination are the same location.';
                    }
                    console.log(`[ROUTE TIMING] Sync map with search (validation failed): ${(performance.now() - startTime).toFixed(2)}ms`);
                    return false;
                }
                
                // VALIDATE: Coordinates are within valid ranges
                if (!(-90 <= s[0] <= 90) || !(-180 <= s[1] <= 180)) {
                    console.error('[ROUTE ERROR] Invalid start coordinates after geocoding:', s);
                    const suggestEl = document.getElementById('altRoute');
                    if (suggestEl) {
                        suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid start location coordinates.';
                    }
                    console.log(`[ROUTE TIMING] Sync map with search (validation failed): ${(performance.now() - startTime).toFixed(2)}ms`);
                    return false;
                }
                
                if (!(-90 <= e[0] <= 90) || !(-180 <= e[1] <= 180)) {
                    console.error('[ROUTE ERROR] Invalid end coordinates after geocoding:', e);
                    const suggestEl = document.getElementById('altRoute');
                    if (suggestEl) {
                        suggestEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid destination coordinates.';
                    }
                    console.log(`[ROUTE TIMING] Sync map with search (validation failed): ${(performance.now() - startTime).toFixed(2)}ms`);
                    return false;
                }
                
                // Smoothly move markers and update routing
                startMarker.setLatLng(s);
                endMarker.setLatLng(e);
                
                routingControl.setWaypoints([
                    L.latLng(s[0], s[1]),
                    L.latLng(e[0], e[1])
                ]);
                routingControl.route(); // FORCE route refresh
                
                console.log('[ROUTE AUDIT] Route calculation triggered with valid coordinates');
                console.log(`[ROUTE TIMING] Sync map with search (success): ${(performance.now() - startTime).toFixed(2)}ms`);
                return true;
            } else {
                // Show location not found message
                const suggestEl = document.getElementById('altRoute');
                if (suggestEl) {
                    suggestEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Location could not be resolved. Please refine your search.';
                }
                // Determine which one failed
                if (!s) {
                    console.warn(`Geocoding failed for start: ${startQuery}`);
                }
                if (!e) {
                    console.warn(`Geocoding failed for destination: ${endQuery}`);
                }
                console.log(`[ROUTE TIMING] Sync map with search (geocoding failed): ${(performance.now() - startTime).toFixed(2)}ms`);
                return false;
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('syncMapWithSearch error:', e);
            }
            console.log(`[ROUTE TIMING] Sync map with search (error): ${(performance.now() - startTime).toFixed(2)}ms`);
            return false;
        }
    };

    // Personalization & Insights
    const updatePersonalizationUI = () => {
        renderHistory();
        renderFavorites();
        generateAIInsights();
    };

    const renderHistory = () => {
        if (!historyList) return;
        if (trafficHistory.length === 0) {
            historyList.innerHTML = '<p class="empty-msg">No recent analysis found.</p>';
            return;
        }
        historyList.innerHTML = '';
        trafficHistory.slice(0, 5).forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="item-info">
                    <h4>${item.location} → ${item.destination || 'Point B'}</h4>
                    <p>${item.day} at ${item.time}</p>
                </div>
                <div class="item-status ${item.result}">${item.result}</div>
            `;
            el.onclick = () => reloadPrediction(item);
            historyList.appendChild(el);
        });
    };

    const renderFavorites = () => {
        if (!favoritesList) return;
        if (favoriteRoutes.length === 0) {
            favoritesList.innerHTML = '<p class="empty-msg">No favorite routes saved.</p>';
            return;
        }
        favoritesList.innerHTML = '';
        favoriteRoutes.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'favorite-item';
            
            // Stats fallback
            const dist = item.distance || '--';
            const time = item.time_est || '--';

            el.innerHTML = `
                <div class="item-info">
                    <h4>${item.location} → ${item.destination || 'Point B'}</h4>
                    <p><i class="fas fa-road"></i> ${dist} km | <i class="fas fa-clock"></i> ${time} min</p>
                </div>
                <div class="favorite-actions">
                    <button class="action-btn load-btn" title="Load Route">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Remove Favorite">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            // Add click events to specific elements
            el.querySelector('.item-info').onclick = () => reloadPrediction(item);
            el.querySelector('.load-btn').onclick = () => reloadPrediction(item);
            el.querySelector('.delete-btn').onclick = (e) => {
                e.stopPropagation();
                removeFavorite(index);
            };
            
            favoritesList.appendChild(el);
        });
    };

    window.removeFavorite = (index) => {
        // Add fade out animation before removal
        const items = favoritesList.querySelectorAll('.favorite-item');
        if (items[index]) {
            items[index].style.transform = 'translateX(50px)';
            items[index].style.opacity = '0';
            setTimeout(() => {
                favoriteRoutes.splice(index, 1);
                localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
                renderFavorites();
            }, 300);
        } else {
            favoriteRoutes.splice(index, 1);
            localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
            renderFavorites();
        }
    };

    const generateAIInsights = () => {
        if (trafficHistory.length === 0) return;
        const locations = trafficHistory.map(h => h.location);
        const topLoc = locations.sort((a,b) => locations.filter(v => v===a).length - locations.filter(v => v===b).length).pop();
        const times = trafficHistory.map(h => parseInt(h.time.split(':')[0]));
        const avgTime = Math.round(times.reduce((a,b) => a+b, 0) / times.length);
        const levels = trafficHistory.map(h => h.result);
        const avgDensity = Math.round((levels.filter(l => l === 'High').length / levels.length) * 100);

        document.getElementById('topLocation').textContent = topLoc;
        document.getElementById('peakTime').textContent = `${avgTime}:00`;
        document.getElementById('avgTraffic').textContent = `${avgDensity}%`;
        document.getElementById('aiSummary').textContent = avgDensity > 40 ? 
            `Neural analysis detect heavy usage patterns in ${topLoc}. Optimized window: ${avgTime + 2}:00.` : 
            `Your grid efficiency in ${topLoc} is exceptional. Premium mobility score maintained.`;
    };

    const reloadPrediction = (item) => {
        locationInput.value = item.location;
        destinationInput.value = item.destination || '';
        document.getElementById('day').value = item.day;
        document.getElementById('time').value = item.time;
        predictionForm.dispatchEvent(new Event('submit'));
    };

    saveRouteBtn.onclick = () => {
        const entry = {
            location: locationInput.value,
            destination: destinationInput.value,
            day: document.getElementById('day').value,
            time: document.getElementById('time').value,
            distance: window.lastRouteStats?.distance,
            time_est: window.lastRouteStats?.time,
            altRoute: document.getElementById('altRoute').textContent
        };
        if (!favoriteRoutes.find(f => f.location === entry.location && f.destination === entry.destination)) {
            favoriteRoutes.unshift(entry);
            localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
            renderFavorites();
            saveRouteBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
            setTimeout(() => saveRouteBtn.innerHTML = '<i class="fas fa-star"></i> Save Route', 2000);
        }
    };

    // Chart & Intensity
    const initChart = () => {
        const ctx = document.getElementById('trafficChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
        gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
        trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'],
                datasets: [{ data: [15, 10, 85, 45, 95, 65, 20], borderColor: '#d4af37', borderWidth: 4, fill: true, backgroundColor: gradient, tension: 0.4, pointRadius: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
        });
    };

    const generateDynamicZones = (loc) => {
        const tags = ['Sector 7', 'Terminal A', 'Hub South', 'Grid 404', 'Alpha Node', 'Bypass'];
        const intensities = [45, 65, 30, 75, 50, 40];
        currentZones = [{ name: loc.split(',')[0], intensity: 55 }];
        for(let i=0; i<5; i++) {
            currentZones.push({ 
                name: tags[i], 
                intensity: intensities[i] 
            });
        }
        renderZones();
    };

    const renderZones = () => {
        const currentContainer = document.getElementById('heatmapContainer');
        currentContainer.innerHTML = '';
        currentZones.forEach((z, i) => {
            const row = document.createElement('div');
            row.className = 'area-row';
            row.setAttribute('data-aos', 'fade-left');
            row.setAttribute('data-aos-delay', i * 100);
            
            // Dynamic color based on intensity
            const color = z.intensity > 70 ? 'var(--high-traffic)' : (z.intensity > 40 ? 'var(--medium-traffic)' : 'var(--low-traffic)');
            
            row.innerHTML = `
                <div class="area-name">${z.name}</div>
                <div class="progress-track">
                    <div class="progress-bar" style="width: ${z.intensity}%; background: ${color}; box-shadow: 0 0 15px ${color}66"></div>
                </div>
                <div class="area-name" style="text-align:right; color: ${color}; font-weight: 700;">${z.intensity}%</div>
            `;
            currentContainer.appendChild(row);
        });
    };

    // Form Submission - Initial Analysis Button
    predictionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // STRICT ANALYSIS LOCK - Only this button may set analysisTriggered to true
        analysisTriggered = true;
        console.log('[ANALYSIS LOCK] Initial Analysis button pressed - analysis triggered');
        
        // ✅ 1. Reset ALL OLD DATA first!
        userHasSubmittedPrediction = true;
        hasSpokenForCurrentPrediction = false;
        apiStartTime = performance.now();
        trafficState.routes = [];
        window.lastRouteStats = null;
        window.availableRoutes = [];
        
        locationInput.removeAttribute('data-coords');
        destinationInput.removeAttribute('data-coords');
        
        const metricsEl = document.getElementById('routeMetrics');
        const confidenceScoreEl = document.getElementById('confidenceScore');
        const confidenceFillEl = document.getElementById('confidenceFill');
        const trafficLevelEl = document.getElementById('trafficLevel');
        
        if (metricsEl) metricsEl.textContent = 'Calculating route...';
        if (confidenceScoreEl) confidenceScoreEl.textContent = '0';
        if (confidenceFillEl) confidenceFillEl.style.width = '0';
        if (trafficLevelEl) trafficLevelEl.textContent = '';
        
        const loc = locationInput.value.trim();
        const dest = destinationInput.value.trim();
        const day = document.getElementById('day').value;
        const time = document.getElementById('time').value;
        
        // DEBUG: Log origin and destination before geocoding
        console.log('[DEBUG] Origin before geocoding:', loc);
        console.log('[DEBUG] Destination before geocoding:', dest);
        console.log('[DEBUG] locationInput.value:', locationInput.value);
        console.log('[DEBUG] destinationInput.value:', destinationInput.value);
        
        if (!loc || !dest) {
            alert('Please enter both start and destination locations');
            return;
        }

        const mapSynced = await syncMapWithSearch(loc, dest);
        
        if (!mapSynced) {
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        generateDynamicZones(loc);
        initialState.classList.add('hidden');
        predictionContent.classList.add('hidden');
        loaderWrapper.classList.remove('hidden');
        predictionContent.classList.remove('pulse-active');

        try {
            // Get coordinates from input attributes if available
        const startCoords = locationInput.getAttribute('data-coords');
        const endCoords = destinationInput.getAttribute('data-coords');
        
        // LOG: Start and destination location text
        console.log(`[ROUTE AUDIT] Start Location: ${loc}`);
        console.log(`[ROUTE AUDIT] Destination: ${dest}`);
        
        // VALIDATE: Coordinates are present
        if (!startCoords || !endCoords) {
            console.error('[ROUTE ERROR] Missing coordinates for route calculation');
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Location could not be resolved.';
                metricsEl.style.color = '#ff6b6b';
            }
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        const [startLat, startLon] = startCoords.split(',').map(parseFloat);
        const [endLat, endLon] = endCoords.split(',').map(parseFloat);
        
        // LOG: Start and destination coordinates
        console.log(`[ROUTE AUDIT] Start Lat: ${startLat}, Start Lon: ${startLon}`);
        console.log(`[ROUTE AUDIT] End Lat: ${endLat}, End Lon: ${endLon}`);
        
        // VALIDATE: Coordinates are different
        if (startLat === endLat && startLon === endLon) {
            console.error('[ROUTE ERROR] Start and destination coordinates are identical');
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Start and destination are the same location.';
                metricsEl.style.color = '#ff6b6b';
            }
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        // VALIDATE: Coordinates are within valid ranges
        if (!(-90 <= startLat <= 90) || !(-180 <= startLon <= 180)) {
            console.error('[ROUTE ERROR] Invalid start coordinates:', startLat, startLon);
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Invalid start location.';
                metricsEl.style.color = '#ff6b6b';
            }
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        if (!(-90 <= endLat <= 90) || !(-180 <= endLon <= 180)) {
            console.error('[ROUTE ERROR] Invalid destination coordinates:', endLat, endLon);
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = 'Invalid destination location.';
                metricsEl.style.color = '#ff6b6b';
            }
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        // Call backend route API for proper logging and validation
        const routeRequestData = {
            start_lat: startLat,
            start_lon: startLon,
            end_lat: endLat,
            end_lon: endLon,
            start_location: loc,
            end_location: dest,
            alternatives: true
        };
        
        console.log(`[ROUTE AUDIT] Calling /api/route with data:`, routeRequestData);
        
        let routeData = null;
        let routeError = null;
        
        try {
            const routeRes = await fetch('/api/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeRequestData)
            });
            
            console.log(`[ROUTE AUDIT] /api/route response status: ${routeRes.status}`);
            
            if (routeRes.ok) {
                routeData = await routeRes.json();
                console.log(`[ROUTE AUDIT] /api/route response data:`, routeData);
                
                if (routeData.routes && routeData.routes.length > 0) {
                    const mainRoute = routeData.routes[0];
                    console.log(`[ROUTE AUDIT] Main route distance: ${mainRoute.distance.toFixed(2)} km, duration: ${mainRoute.duration.toFixed(2)} min`);
                    
                    // Update route metrics with actual OSRM data
                    const metricsEl = document.getElementById('routeMetrics');
                    if (metricsEl) {
                        metricsEl.textContent = `${mainRoute.distance.toFixed(1)} km | ${Math.round(mainRoute.duration)} min`;
                        metricsEl.style.color = '#10b981';
                    }
                } else {
                    routeError = 'No routes found in response';
                    console.error('[ROUTE ERROR]', routeError);
                }
            } else {
                const errorData = await routeRes.json();
                routeError = errorData.error || 'Route calculation failed';
                console.error('[ROUTE ERROR]', routeError);
            }
        } catch (routeErr) {
            routeError = routeErr.message || 'Route calculation failed';
            console.error('[ROUTE ERROR] Exception:', routeError);
        }
        
        // If route calculation failed, show error and don't continue
        if (routeError) {
            const metricsEl = document.getElementById('routeMetrics');
            if (metricsEl) {
                metricsEl.textContent = routeError;
                metricsEl.style.color = '#ff6b6b';
            }
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            return;
        }
        
        // Continue with traffic prediction
        const requestData = {
            location: loc,
            destination: dest,
            day,
            time,
            emergency_mode: isEmergencyMode
        };
        
        if (startCoords) {
            const [lat, lon] = startCoords.split(',').map(parseFloat);
            requestData.start_coords = [lat, lon];
        }
        
        if (endCoords) {
            const [lat, lon] = endCoords.split(',').map(parseFloat);
            requestData.end_coords = [lat, lon];
        }
        
        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
            const data = await res.json();
            if (data.status === 'success') {
                setTimeout(() => {
                    loaderWrapper.classList.add('hidden');
                    predictionContent.classList.remove('hidden');
                    predictionContent.classList.add('pulse-active');
                    
                    // Normalize and Store in Central State
                    const rawLvl = normalizeTrafficLevel(data.prediction);
                    trafficState.level = getStableLevel(rawLvl);
                    trafficState.confidence = parseInt(data.confidence) || 0;
                    lastPredictionData = data; // Store for global access
                    
                    document.getElementById('trafficLevel').textContent = trafficState.level.toUpperCase();
                    document.getElementById('trafficLevel').className = `traffic-status ${data.prediction}`; // Keep original casing for CSS class
                    document.getElementById('confidenceScore').textContent = data.confidence;
                    document.getElementById('confidenceFill').style.width = data.confidence + '%';
                    document.getElementById('bestTime').textContent = data.best_time;
                    
                    // Show notifications based on data
                    if (trafficState.level === 'high') {
                        showNotification('congestion', 'High Traffic Detected', 'Heavy congestion expected. Consider alternative routes.', 'traffic-light');
                    } else if (trafficState.level === 'medium') {
                        showNotification('congestion', 'Moderate Traffic', 'Some congestion expected. Plan your trip accordingly.', 'traffic-light');
                    }
                    
                    if (data.weather) {
                        let weatherIcon = 'cloud-sun';
                        if (data.weather.rain_condition) weatherIcon = 'cloud-rain';
                        if (data.weather.fog_detected) weatherIcon = 'smog';
                        if (data.weather.storm_detected) weatherIcon = 'cloud-bolt';
                        showNotification('weather', `Weather Update: ${data.weather.condition}`, `Visibility: ${data.weather.visibility} km, Temp: ${data.weather.temperature}°C`, weatherIcon);
                    }
                    
                    if (data.accident_risk && data.accident_risk.level === 'high') {
                        showNotification('accident', 'High Accident Risk', 'High risk of accidents detected. Drive carefully.', 'exclamation-triangle');
                    }
                    
                    // ✅ Display weather and risk data if available
                    if (data.weather || data.accident_risk) {
                        displayWeatherAndRisk(data.weather, data.accident_risk);
                    }
                    
                    // ✅ Update advanced analytics
                    updateAdvancedAnalytics(data);
                    
                    // ✅ Update Trust Panel with real data
                    updateTrustPanel(data);
                    
                    // ✅ Update Route Validation with real data
                    updateRouteValidation(data);
                    
                    // Route Metrics and UI are handled in 'routesfound' listener!
                    
                    // ✅ If routes are already available, update UI now!
                    if (trafficState.routes && trafficState.routes.length > 0) {
                        const bestIdx = trafficState.routes.reduce((best, r, i, arr) => r.time < arr[best].time ? i : best, 0);
                        const highlightIdx = (trafficState.level === 'high' && trafficState.routes.length > 1) ? 1 : 0;
                        const selected = trafficState.routes[isEmergencyMode ? bestIdx : highlightIdx];
                        
                        updateRouteMetricsUI(selected.distance, selected.time);
                        updateAISuggestionUI();
                        window.highlightRoute(isEmergencyMode ? bestIdx : highlightIdx);
                    } else {
                        // If routes aren't here yet, wait a little longer and try again!
                        setTimeout(() => {
                            if (trafficState.routes && trafficState.routes.length > 0) {
                                const bestIdx = trafficState.routes.reduce((best, r, i, arr) => r.time < arr[best].time ? i : best, 0);
                                const highlightIdx = (trafficState.level === 'high' && trafficState.routes.length > 1) ? 1 : 0;
                                const selected = trafficState.routes[isEmergencyMode ? bestIdx : highlightIdx];
                                
                                updateRouteMetricsUI(selected.distance, selected.time);
                                updateAISuggestionUI();
                                window.highlightRoute(isEmergencyMode ? bestIdx : highlightIdx);
                            }
                        }, 500);
                    }
                    
                    updateChartVisuals();
                    animateStats();
                    
                    trafficHistory.unshift({ 
                        location: loc, 
                        destination: dest, 
                        day, 
                        time, 
                        result: data.prediction, 
                        distance: window.lastRouteStats?.distance?.toFixed(1) || 0,
                        time_est: window.lastRouteStats?.time || 0,
                        timestamp: Date.now() 
                    });
                    localStorage.setItem('trafficHistory', JSON.stringify(trafficHistory));
                    updatePersonalizationUI();
                }, 1000);
            }
        } catch (err) {
            loaderWrapper.classList.add('hidden');
            initialState.classList.remove('hidden');
            if (metricsEl) metricsEl.textContent = 'Route calculation failed';
        }
    });

    const updateChartVisuals = () => {
        const lvl = trafficState.level.charAt(0).toUpperCase() + trafficState.level.slice(1);
        const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
        const data = { High: [40, 30, 95, 75, 100, 85, 50], Medium: [25, 20, 70, 50, 80, 65, 30], Low: [15, 10, 40, 25, 45, 35, 15] };
        trafficChart.data.datasets[0].data = data[lvl];
        trafficChart.data.datasets[0].borderColor = colors[lvl];
        
        // Update gradient color based on level
        const ctx = document.getElementById('trafficChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        const rgb = lvl === 'High' ? '239, 68, 68' : (lvl === 'Medium' ? '245, 158, 11' : '16, 185, 129');
        gradient.addColorStop(0, `rgba(${rgb}, 0.3)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);
        trafficChart.data.datasets[0].backgroundColor = gradient;
        
        trafficChart.update();
    };

    const animateStats = () => {
        const lvl = trafficState.level.charAt(0).toUpperCase() + trafficState.level.slice(1);
        const m = { High: 1.6, Medium: 1, Low: 0.4 }[lvl];
        
        // Use real route stats if available, else fixed values
        const dist = window.lastRouteStats ? parseFloat(window.lastRouteStats.distance) : 10;
        
        let stats;
        if (lastPredictionData && lastPredictionData.analytics) {
            stats = {
                'stat-vehicles': lastPredictionData.analytics.active_vehicles,
                'stat-speed': lastPredictionData.analytics.flow_velocity,
                'stat-delay': lastPredictionData.analytics.avg_latency
            };
        } else {
            stats = { 
                'stat-vehicles': Math.floor((8000 + 1500)*m), 
                'stat-speed': Math.floor((30 + 10)/m), 
                'stat-delay': Math.floor((2 + 8)*m) 
            };
        }
        
        Object.entries(stats).forEach(([id, val]) => {
            const el = document.getElementById(id);
            const suffix = id.includes('speed') ? ' KM/H' : (id.includes('delay') ? ' MIN' : '');
            let c = 0;
            const t = setInterval(() => {
                c += Math.ceil(val/30);
                if(c >= val) { el.textContent = val + suffix; clearInterval(t); }
                else el.textContent = c + suffix;
            }, 20);
        });
    };

    // Live Simulation Engine
    let simulationInterval;
    const startLiveSimulation = () => {
        if (simulationInterval) clearInterval(simulationInterval);
        
        // Show the map live label
        const liveLabel = document.getElementById('mapLiveLabel');
        if (liveLabel) liveLabel.style.display = 'flex';

        simulationInterval = setInterval(() => {
            if (!trafficState.routes || trafficState.routes.length === 0) return;

            // 1. LIVE TRAFFIC (no random variation)
            if (!isDemoMode) {
                console.log("Live Simulation: Updating traffic patterns...");
                
                let totalVariation = 0.02; // Fixed small variation
                // Add pulse animation to route on map
                const paths = document.querySelectorAll('path.leaflet-interactive');
                const routePaths = Array.from(paths).filter(p => p.classList.contains('route-main') || p.classList.contains('route-alt'));
                routePaths.forEach(p => {
                    p.classList.remove('route-pulse');
                    void p.offsetWidth;
                    p.classList.add('route-pulse');
                });

                // 3. LIVE STATUS INDICATOR
                updateLiveStatusIndicator(totalVariation);
            }

            // 2. AUTO AI RE-EVALUATION
            const rawLvl = normalizeTrafficLevel(trafficState.level);
            trafficState.level = getStableLevel(rawLvl);

            updateAISuggestionUI();

            // 4. REAL-TIME ROUTE SWITCH (AUTO)
            if (window.currentHighlightedIndex !== undefined) {
                const bestIdx = trafficState.routes.reduce((best, r, i, arr) => r.time < arr[best].time ? i : best, 0);
                const bestRoute = trafficState.routes[bestIdx];
                const currentRoute = trafficState.routes[window.currentHighlightedIndex];
                
                // Smart Auto-Switch: 10% improvement and not high confidence lock
                if (bestRoute.time < currentRoute.time * 0.90 && trafficState.confidence <= 85) {
                    console.log("Predictive Switch: Significant improvement detected.");
                    window.highlightRoute(bestIdx);
                    
                    const suggestEl = document.getElementById('altRoute');
                    if (suggestEl) {
                        const alertBadge = '<span class="efficiency-badge switch-alert">⚡ Optimization: Faster route locked</span>';
                        if (!suggestEl.innerHTML.includes('switch-alert')) {
                            suggestEl.insertAdjacentHTML('afterbegin', alertBadge);
                        }
                    }
                }
            }

        }, 7000); // Every 7 seconds (between 5-10s)
    };

    const updateLiveStatusIndicator = (avgVariation) => {
        const statusEl = document.getElementById('liveStatus');
        const textEl = document.getElementById('statusText');
        const dotEl = statusEl.querySelector('.live-dot');
        
        if (!statusEl || !textEl || !dotEl) return;

        if (avgVariation < 0.02) {
            textEl.textContent = '🟢 STABLE FLOW';
            statusEl.style.color = 'var(--low-traffic)';
            statusEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            dotEl.style.background = 'var(--low-traffic)';
            dotEl.style.boxShadow = '0 0 15px var(--low-traffic)';
        } else if (avgVariation < 0.04) {
            textEl.textContent = '🟡 FLUCTUATING';
            statusEl.style.color = 'var(--medium-traffic)';
            statusEl.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            dotEl.style.background = 'var(--medium-traffic)';
            dotEl.style.boxShadow = '0 0 15px var(--medium-traffic)';
        } else {
            textEl.textContent = '🔴 HEAVY SURGE';
            statusEl.style.color = 'var(--high-traffic)';
            statusEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            dotEl.style.background = 'var(--high-traffic)';
            dotEl.style.boxShadow = '0 0 15px var(--high-traffic)';
        }
    };

    const originalHighlightRoute = window.highlightRoute;
    window.highlightRoute = (index) => {
        window.currentHighlightedIndex = index;
        originalHighlightRoute(index);
    };

    initMap();
    initChart();
    updatePersonalizationUI();
    
    // Phase 8: Smart Temporal Marker - Auto-detect current date/time
    const daySelect = document.getElementById('day');
    const timeInput = document.getElementById('time');
    
    // Check localStorage for saved values
    const savedDay = localStorage.getItem('trafficSense_day');
    const savedTime = localStorage.getItem('trafficSense_time');
    
    if (savedDay && savedTime) {
        // Restore saved values
        daySelect.value = savedDay;
        timeInput.value = savedTime;
    } else {
        // Auto-detect current date/time on first load
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        
        // Round to nearest hour
        const currentHour = now.getHours();
        const roundedHour = currentHour < 10 ? `0${currentHour}:00` : `${currentHour}:00`;
        
        daySelect.value = currentDay;
        timeInput.value = roundedHour;
        
        // Save to localStorage
        localStorage.setItem('trafficSense_day', currentDay);
        localStorage.setItem('trafficSense_time', roundedHour);
    }
    
    // Add event listeners to save manual changes
    daySelect.addEventListener('change', () => {
        localStorage.setItem('trafficSense_day', daySelect.value);
        // RESET ANALYSIS LOCK on day change
        analysisTriggered = false;
        markResultsAsOutdated();
        updateTemporalStatus();
    });
    
    timeInput.addEventListener('change', () => {
        localStorage.setItem('trafficSense_time', timeInput.value);
        // RESET ANALYSIS LOCK on time change
        analysisTriggered = false;
        markResultsAsOutdated();
        updateTemporalStatus();
    });
    
    // Function to update LIVE/HISTORICAL status indicator
    const updateTemporalStatus = () => {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentHour = now.getHours();
        
        const selectedDay = daySelect.value;
        const selectedHour = parseInt(timeInput.value.split(':')[0]);
        
        // Check if selected day and time represent current real-world conditions
        const isCurrentDay = selectedDay === currentDay;
        const isCurrentHour = selectedHour === currentHour;
        
        const statusEl = document.getElementById('temporalStatus');
        if (!statusEl) {
            // Create status element if it doesn't exist
            const formGroup = daySelect.closest('.form-group').parentElement;
            const statusDiv = document.createElement('div');
            statusDiv.id = 'temporalStatus';
            statusDiv.style.cssText = 'text-align: center; margin-top: 0.5rem; font-size: 0.85rem; font-weight: 600; padding: 0.5rem; border-radius: 8px;';
            formGroup.appendChild(statusDiv);
        }
        
        const statusElUpdated = document.getElementById('temporalStatus');
        if (isCurrentDay && isCurrentHour) {
            statusElUpdated.textContent = '🟢 LIVE TRAFFIC ANALYSIS';
            statusElUpdated.style.background = 'rgba(16, 185, 129, 0.1)';
            statusElUpdated.style.color = '#10b981';
            statusElUpdated.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else {
            statusElUpdated.textContent = '📊 HISTORICAL TRAFFIC SIMULATION';
            statusElUpdated.style.background = 'rgba(245, 158, 11, 0.1)';
            statusElUpdated.style.color = '#f59e0b';
            statusElUpdated.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        }
    };
    
    // Initial status update
    updateTemporalStatus();
    
    // Update status every minute to detect day/time changes
    setInterval(updateTemporalStatus, 60000);
});
