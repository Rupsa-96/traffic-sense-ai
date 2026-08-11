// ============================================================================
// TRAFFICSENSE AI - CENTRALIZED API SERVICE
// ============================================================================
// This file handles all API communication, with automatic switching between
// local emulator (Android Studio) and production URLs.
// ============================================================================

const TrafficSenseAPI = (() => {
    // ========================================================================
    // CONFIGURATION - AUTO-DETECT ENVIRONMENT
    // ========================================================================
    
    // Detect if running in Android WebView/Capacitor
    const isCapacitor = typeof window !== 'undefined' && 
                        typeof window.Capacitor !== 'undefined' &&
                        window.Capacitor.isNativePlatform();
    
    // Detect if running on Android (user agent check as fallback)
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    // Base URL configuration
    const CONFIG = {
        // For Android Emulator: 10.0.2.2 is the special IP to reach host machine
        LOCAL_EMULATOR: 'http://10.0.2.2:5000',
        // For direct local testing (browser on same machine)
        LOCAL_BROWSER: 'http://localhost:5000',
        // Production server (Render)
        PRODUCTION: 'https://traffic-sense-ai-vd45.onrender.com'
    };
    
    // Auto-select the correct base URL
    let BASE_URL;
    if (isCapacitor && isAndroid) {
        BASE_URL = CONFIG.LOCAL_EMULATOR;
        console.log('[TrafficSenseAPI] Running in Android Emulator - using host IP');
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        BASE_URL = CONFIG.LOCAL_BROWSER;
        console.log('[TrafficSenseAPI] Running in local browser');
    } else {
        BASE_URL = CONFIG.PRODUCTION;
        console.log('[TrafficSenseAPI] Running in production mode');
    }
    
    console.log('[TrafficSenseAPI] Base URL:', BASE_URL);

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================
    
    // Generic fetch wrapper with error handling
    const apiRequest = async (endpoint, options = {}) => {
        const url = `${BASE_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        try {
            const startTime = performance.now();
            const response = await fetch(url, finalOptions);
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return { success: true, data, responseTime };
        } catch (error) {
            console.error('[TrafficSenseAPI] Request failed:', error);
            return { 
                success: false, 
                error: error.message,
                data: null 
            };
        }
    };

    // ========================================================================
    // API ENDPOINTS
    // ========================================================================
    
    return {
        // Configuration info
        config: {
            baseUrl: BASE_URL,
            isCapacitor,
            isAndroid,
            isLocal: BASE_URL !== CONFIG.PRODUCTION
        },
        
        // --------------------------------------------------------------------
        // 1. Traffic Prediction
        // --------------------------------------------------------------------
        predictTraffic: async (predictionData) => {
            return await apiRequest('/api/predict', {
                method: 'POST',
                body: JSON.stringify(predictionData),
            });
        },
        
        // --------------------------------------------------------------------
        // 2. Geocoding & Location Services
        // --------------------------------------------------------------------
        geocode: async (query) => {
            return await apiRequest(`/api/geocode?q=${encodeURIComponent(query)}`);
        },
        
        reverseGeocode: async (lat, lon) => {
            return await apiRequest(`/api/reverse_geocode?lat=${lat}&lon=${lon}`);
        },
        
        // --------------------------------------------------------------------
        // 3. Routing
        // --------------------------------------------------------------------
        getRoute: async (routeData) => {
            return await apiRequest('/api/route', {
                method: 'POST',
                body: JSON.stringify(routeData),
            });
        },
        
        // --------------------------------------------------------------------
        // 4. Heatmap Data
        // --------------------------------------------------------------------
        getHeatmapData: async () => {
            return await apiRequest('/api/heatmap');
        },
        
        // --------------------------------------------------------------------
        // 5. Health Check
        // --------------------------------------------------------------------
        healthCheck: async () => {
            // Try to reach root endpoint
            try {
                const response = await fetch(`${BASE_URL}/`);
                return { success: response.ok, status: response.status };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },
        
        // --------------------------------------------------------------------
        // 6. Helper: Switch Base URL Manually (for debugging)
        // --------------------------------------------------------------------
        setBaseUrl: (newUrl) => {
            BASE_URL = newUrl;
            console.log('[TrafficSenseAPI] Base URL changed to:', BASE_URL);
        }
    };
})();

// Make it globally available
window.TrafficSenseAPI = TrafficSenseAPI;

console.log('[TrafficSenseAPI] Service initialized successfully');
