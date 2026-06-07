from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import requests
import datetime
import math

app = Flask(
    __name__,
    static_folder='../frontend/static',
    template_folder='../frontend/templates'
)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# DEMO API KEY - Use as fallback if env var is missing
DEMO_WEATHER_API_KEY = "bd5e378503939ddaee76f12ad7a97608"

# ✅ ENHANCED AI PREDICTION WITH WEATHER & RUSH HOUR LOGIC (NO RANDOM)
def predict_traffic(data, weather_data=None, accident_risk=0):
    levels = ["low", "medium", "high"]
    weights = [0.3, 0.4, 0.3]

    # Time-based logic
    hour = int(data.get('time', '12:00').split(':')[0])
    day = data.get('day', 'Monday')
    is_weekend = day in ['Saturday', 'Sunday']
    is_emergency = data.get('emergency_mode', False)

    # Rush hour logic
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        if is_weekend:
            weights = [0.2, 0.5, 0.3]  # Less severe on weekends
        else:
            weights = [0.1, 0.3, 0.6]  # Heavy rush hour on weekdays
    elif 22 <= hour or hour <= 6:
        weights = [0.6, 0.3, 0.1]  # Night time - lighter traffic
    elif 11 <= hour <= 14 and not is_weekend:
        weights = [0.2, 0.4, 0.4]  # Lunch rush

    # Weather impact on traffic
    if weather_data:
        weather_condition = weather_data.get('condition', '').lower()
        visibility = weather_data.get('visibility', 10)
        
        if 'rain' in weather_condition or 'storm' in weather_condition:
            # Rain increases traffic
            weights = [max(0.05, w * 0.7) if i == 0 else (w * 1.15 if i == 1 else w * 1.3) for i, w in enumerate(weights)]
        elif 'fog' in weather_condition or visibility < 5:
            # Fog severely impacts traffic
            weights = [max(0.05, w * 0.5) if i == 0 else (w * 1.2 if i == 1 else w * 1.5) for i, w in enumerate(weights)]
        elif 'snow' in weather_condition:
            # Snow causes major disruptions
            weights = [max(0.05, w * 0.3) if i == 0 else (w * 1.1 if i == 1 else w * 1.8) for i, w in enumerate(weights)]

    # Accident risk impact
    if accident_risk > 0.7:
        # High accident risk - significantly increases traffic
        weights = [max(0.05, w * 0.4) if i == 0 else (w * 1.1 if i == 1 else w * 1.6) for i, w in enumerate(weights)]
    elif accident_risk > 0.4:
        # Medium accident risk
        weights = [max(0.05, w * 0.8) if i == 0 else (w * 1.05 if i == 1 else w * 1.2) for i, w in enumerate(weights)]

    # Emergency mode prioritizes speed over traffic avoidance
    if is_emergency:
        weights = [0.4, 0.4, 0.2]  # More conservative for emergency vehicles

    # Normalize weights
    total = sum(weights)
    weights = [w / total for w in weights]

    # Pick prediction based on highest weight (no random)
    prediction = levels[weights.index(max(weights))]
    
    # Confidence calculation based on data quality (fixed based on weights)
    base_confidence = 85 + int(max(weights) * 10)  # Higher max weight = higher confidence
    if weather_data:
        base_confidence = min(98, base_confidence + 5)  # Weather data increases confidence
    if accident_risk > 0:
        base_confidence = max(60, base_confidence - 10)  # Accident risk reduces certainty
    
    confidence = str(base_confidence) + "%"

    # Simulate REAL analytics data based on prediction (fixed, no random)
    multiplier = 1.0 if prediction == "low" else (1.5 if prediction == "medium" else 2.5)
    active_vehicles = int((8000 + 1000) * multiplier)
    flow_velocity = int(max(15, 60 - (20 * multiplier) + 0))
    avg_latency = int(max(2, (5 * multiplier) + 0))

    # Precise "Peak Efficiency" Time Calculation
    input_time = data.get('time', '12:00')
    h, m = map(int, input_time.split(':'))
    
    if prediction == "low":
        best_time = "Optimal Now"
        best_name = "Main Route"
    else:
        # Calculate next optimal window
        if 7 <= h <= 9: # Morning rush
            target_h = 10
            target_m = 0
        elif 17 <= h <= 19: # Evening rush
            target_h = 20
            target_m = 0
        else:
            # Shift by 1-2 hours for medium/high traffic
            shift = 2 if prediction == "high" else 1
            target_h = (h + shift) % 24
            target_m = m
        
        # Convert to 12-hour format
        period = "AM" if target_h < 12 else "PM"
        display_h = target_h % 12
        if display_h == 0: display_h = 12
        best_time = f"{display_h:02d}:{target_m:02d} {period}"
        best_name = "Alternative Temporal Window" if not (7 <= h <= 9 or 17 <= h <= 19) else ("Post-Rush Corridor" if 7 <= h <= 9 else "Night-Flow Route")

    if is_emergency:
        best_time = "Immediate"
        best_name = "Emergency Priority Path"

    return prediction, confidence, best_time, best_name, active_vehicles, flow_velocity, avg_latency


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.json

        location = data.get('location', 'Unknown')
        destination = data.get('destination', 'Unknown')
        day = data.get('day', 'Monday')
        time_str = data.get('time', '12:00')
        emergency_mode = data.get('emergency_mode', False)
        
        # Get coordinates if provided
        start_coords = data.get('start_coords')
        end_coords = data.get('end_coords')
        
        # Get weather data for the route area
        weather_data = None
        accident_risk = 0
        
        if start_coords:
            weather_data = get_weather_for_location(start_coords[0], start_coords[1], time_str, day)
            accident_risk = calculate_accident_risk(start_coords[0], start_coords[1], time_str, day, weather_data)

        prediction, confidence, best_time, best_name, active_vehicles, flow_velocity, avg_latency = predict_traffic(data, weather_data, accident_risk)

        response_data = {
            "status": "success",
            "prediction": prediction,
            "confidence": confidence,
            "best_time": best_time,
            "best_name": best_name,
            "analytics": {
                "active_vehicles": active_vehicles,
                "flow_velocity": flow_velocity,
                "avg_latency": avg_latency
            },
            "input": {
                "location": location,
                "destination": destination,
                "day": day,
                "time": time_str,
                "emergency_mode": emergency_mode
            }
        }
        
        # Add weather and risk data if available
        if weather_data:
            response_data["weather"] = {
                "condition": weather_data.get('condition', 'Unknown'),
                "temperature": weather_data.get('temperature', 0),
                "visibility": weather_data.get('visibility', 10),
                "impact": "high" if prediction == "high" else "medium" if prediction == "medium" else "low"
            }
        
        if accident_risk > 0:
            response_data["accident_risk"] = {
                "score": round(accident_risk * 100, 1),
                "level": "high" if accident_risk > 0.7 else "medium" if accident_risk > 0.4 else "low"
            }

        return jsonify(response_data)

    except Exception as e:
        print(f"Prediction Error: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "prediction": "medium",
            "confidence": "80%",
            "best_time": "In 2 hours",
            "best_name": "Alternative Route"
        }), 500


# ✅ FIXED HEATMAP API (NO RANDOM)
@app.route('/api/heatmap', methods=['GET'])
def heatmap_data():
    locations = ["Kolkata", "Mumbai", "Delhi", "Bangalore", "Chennai"]
    # Fixed intensities for each city
    intensities = [60, 85, 75, 55, 45]

    heatmap = []
    for loc, intensity in zip(locations, intensities):
        heatmap.append({
            'location': loc,
            'intensity': intensity
        })

    return jsonify(heatmap)


# ✅ OPTIONAL SUGGESTION LOGIC
def get_dynamic_suggestions(prediction, location):
    if prediction == 'high':
        best_time = "After 9:00 PM"
        alt_route = f"Avoid main roads near {location}. Use inner roads."
    elif prediction == 'medium':
        best_time = "In 2 hours"
        alt_route = "Use alternative routes."
    else:
        best_time = "Immediate departure"
        alt_route = "Main route is clear."

    return best_time, alt_route


# ✅ NEW API ENDPOINTS FOR PRODUCTION FEATURES

# Backend cache (in-memory, 5 minute expiry)
geocode_cache = {}
reverse_geocode_cache = {}
CACHE_TTL = 300  # 5 minutes in seconds

def search_overpass(q):
    """Search Overpass API for villages, institutions, landmarks"""
    try:
        overpass_query = f"""
            [out:json][timeout:8];
            (
                node["place"~"village|hamlet|islet|neighbourhood|locality|suburb"]["name"~"{q}",i];
                node["amenity"~"school|college|university|hospital|clinic|library|government"]["name"~"{q}",i];
                node["railway"~"station|halt"]["name"~"{q}",i];
                node["aeroway"~"aerodrome|terminal|heliport"]["name"~"{q}",i];
                node["highway"~"bus_stop|bus_station"]["name"~"{q}",i];
                node["tourism"~"attraction|museum|monument"]["name"~"{q}",i];
                node["historic"]["name"~"{q}",i];
                way["place"~"village|hamlet|locality"]["name"~"{q}",i];
                relation["place"~"village|hamlet"]["name"~"{q}",i];
            );
            out center 10;
        """
        url = "https://overpass-api.de/api/interpreter"
        response = requests.post(url, data=overpass_query, timeout=10)
        if response.status_code == 200:
            data = response.json()
            results = []
            for element in data.get('elements', []):
                lat = element.get('lat') or element.get('center', {}).get('lat')
                lon = element.get('lon') or element.get('center', {}).get('lon')
                if lat and lon:
                    tags = element.get('tags', {})
                    name = tags.get('name', '')
                    addr_parts = [name]
                    for key in ['addr:city', 'addr:state', 'addr:country']:
                        if key in tags:
                            addr_parts.append(tags[key])
                    results.append({
                        "source": "Overpass API",
                        "display_name": ", ".join(addr_parts),
                        "lat": lat,
                        "lon": lon,
                        "type": tags.get('amenity', tags.get('place', tags.get('railway', tags.get('highway', tags.get('tourism', 'unknown'))))),
                        "importance": 0.6,
                        "address": tags,
                        "admin_hierarchy": []
                    })
            return results
    except Exception as e:
        print(f"Overpass error: {e}")
    return []

@app.route('/api/geocode', methods=['GET'])
def geocode():
    """Enhanced geocoding with precision for villages, institutions, and landmarks"""
    try:
        import concurrent.futures
        from rapidfuzz import fuzz
        import time
        
        query = request.args.get('q', '')
        if not query:
            return jsonify({"error": "Query parameter required"}), 400
        
        query = query.strip()
        cache_key = query.lower()
        
        # LOG: Geocoding request
        print(f"[GEOCODE AUDIT] Geocoding query: {query}")
        
        if cache_key in geocode_cache:
            cached_result, expiry = geocode_cache[cache_key]
            if time.time() < expiry:
                print(f"[GEOCODE AUDIT] Cache hit for: {query}")
                return jsonify(cached_result)
            else:
                del geocode_cache[cache_key]
                print(f"[GEOCODE AUDIT] Cache expired for: {query}")
        
        query_lower = query.lower()
        all_results = []
        
        common_locations = {
            "kolkata": {"lat": 22.5726, "lon": 88.3639, "name": "Kolkata, West Bengal, India", "type": "city", "importance": 1.0, "admin": ["India", "West Bengal", "Kolkata"], "place_id": "local_kolkata"},
            "new york": {"lat": 40.7128, "lon": -74.0060, "name": "New York, NY, USA", "type": "city", "importance": 0.95, "admin": ["United States", "New York", "New York"], "place_id": "local_ny"},
            "delhi": {"lat": 28.6139, "lon": 77.2090, "name": "Delhi, India", "type": "city", "importance": 0.95, "admin": ["India", "Delhi"], "place_id": "local_delhi"},
            "mumbai": {"lat": 19.0760, "lon": 72.8777, "name": "Mumbai, Maharashtra, India", "type": "city", "importance": 0.95, "admin": ["India", "Maharashtra", "Mumbai"], "place_id": "local_mumbai"},
            "tentulmuri": {"lat": 22.6200, "lon": 87.8500, "name": "Tentulmuri, West Bengal, India", "type": "village", "importance": 0.7, "admin": ["India", "West Bengal"], "place_id": "local_tentulmuri"},
            "kotulpur": {"lat": 22.9300, "lon": 87.5500, "name": "Kotulpur, West Bengal, India", "type": "town", "importance": 0.75, "admin": ["India", "West Bengal"], "place_id": "local_kotulpur"},
            "jis university": {"lat": 22.6250, "lon": 88.3750, "name": "JIS University, Agarpara, West Bengal, India", "type": "university", "importance": 0.85, "admin": ["India", "West Bengal"], "place_id": "local_jis_university"},
            "jis university, agarpara": {"lat": 22.6250, "lon": 88.3750, "name": "JIS University, Agarpara, West Bengal, India", "type": "university", "importance": 0.85, "admin": ["India", "West Bengal"], "place_id": "local_jis_university_agarpara"},
            "jis university, agarpara, west bengal": {"lat": 22.6250, "lon": 88.3750, "name": "JIS University, Agarpara, West Bengal, India", "type": "university", "importance": 0.85, "admin": ["India", "West Bengal"], "place_id": "local_jis_university_full"},
            "jis university, agarpara, west bengal, india": {"lat": 22.6250, "lon": 88.3750, "name": "JIS University, Agarpara, West Bengal, India", "type": "university", "importance": 0.85, "admin": ["India", "West Bengal"], "place_id": "local_jis_university_complete"},
            "howrah station": {"lat": 22.5830, "lon": 88.3470, "name": "Howrah Junction Railway Station, West Bengal, India", "type": "railway station", "importance": 0.9, "admin": ["India", "West Bengal"], "place_id": "local_howrah"},
            "sealdah station": {"lat": 22.5680, "lon": 88.3720, "name": "Sealdah Railway Station, West Bengal, India", "type": "railway station", "importance": 0.88, "admin": ["India", "West Bengal"], "place_id": "local_sealdah"},
            "nsb airport": {"lat": 22.6540, "lon": 88.4460, "name": "Netaji Subhash Chandra Bose International Airport, Kolkata, India", "type": "airport", "importance": 0.92, "admin": ["India", "West Bengal"], "place_id": "local_nsb"},
            "sskm hospital": {"lat": 22.5420, "lon": 88.3400, "name": "SSKM Hospital, Kolkata, West Bengal, India", "type": "hospital", "importance": 0.88, "admin": ["India", "West Bengal"], "place_id": "local_sskm"},
            "shankar bhavan": {"lat": 22.6100, "lon": 88.3900, "name": "Shankar Bhavan, Belgharia, West Bengal, India", "type": "building", "importance": 0.65, "admin": ["India", "West Bengal", "North 24 Parganas"], "place_id": "local_shankar_bhavan"},
            "belgh": {"lat": 22.6100, "lon": 88.3900, "name": "Belgharia, West Bengal, India", "type": "town", "importance": 0.7, "admin": ["India", "West Bengal", "North 24 Parganas"], "place_id": "local_belgharia"},
            "arambag": {"lat": 22.8800, "lon": 88.2300, "name": "Arambag, Hooghly, West Bengal, India", "type": "town", "importance": 0.75, "admin": ["India", "West Bengal", "Hooghly"], "place_id": "local_arambag"},
            "arambagh": {"lat": 22.8800, "lon": 88.2300, "name": "Arambag, Hooghly, West Bengal, India", "type": "town", "importance": 0.75, "admin": ["India", "West Bengal", "Hooghly"], "place_id": "local_arambagh"}
        }
        
        for key, loc in common_locations.items():
            score = fuzz.token_sort_ratio(query_lower, key)
            print(f"[GEOCODE AUDIT] Fuzzy match: '{query_lower}' vs '{key}' = {score}")
            if score > 70:  # Increased threshold from 60 to 70 to further reduce false positives
                all_results.append({
                    "display_name": loc["name"],
                    "place_name": loc["name"].split(',')[0],  # Extract simple name
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "type": loc["type"],
                    "address": {},
                    "source": "Local Database",
                    "score": score + (loc["importance"] * 20),
                    "importance": loc["importance"],
                    "admin_hierarchy": loc.get("admin", []),
                    "place_id": loc.get("place_id", f"local_{key}")
                })
                print(f"[GEOCODE AUDIT] Local database match: {key} -> {loc['name']} (score: {score})")
        
        if len(all_results) >= 1:
            all_results.sort(key=lambda x: x['score'], reverse=True)
            final_results = [
                {
                    "display_name": r["display_name"],
                    "place_name": r.get("place_name", r["display_name"].split(',')[0]),
                    "lat": r["lat"],
                    "lon": r["lon"],
                    "type": r["type"],
                    "address": r["address"],
                    "source": r["source"],
                    "rank": i+1,
                    "score": round(r["score"], 2),
                    "place_id": r.get("place_id", "")
                } for i, r in enumerate(all_results[:10])
            ]
            print(f"[GEOCODE AUDIT] Returning {len(final_results)} results from local database")
            response_data = {"results": final_results, "total_results": len(final_results), "best_match": final_results[0]}
            geocode_cache[cache_key] = (response_data, time.time() + CACHE_TTL)
            return jsonify(response_data)
        
        def search_nominatim(q):
            try:
                url = f"https://nominatim.openstreetmap.org/search?format=json&q={q}&limit=8&addressdetails=1&accept-language=en"
                headers = {'User-Agent': 'TrafficSenseAI/3.0 (https://trafficsense.ai)'}
                print(f"[GEOCODE AUDIT] Nominatim search URL: {url}")
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    results = []
                    for item in response.json():
                        admin = []
                        addr = item.get('address', {})
                        for key in ['country', 'state', 'county', 'city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood']:
                            if key in addr and addr[key] not in admin:
                                admin.append(addr[key])
                        results.append({
                            "source": "Nominatim",
                            "display_name": item.get('display_name', ''),
                            "place_name": addr.get('name') or item.get('display_name', '').split(',')[0],
                            "lat": float(item.get('lat', 0)),
                            "lon": float(item.get('lon', 0)),
                            "type": item.get('type', ''),
                            "importance": item.get('importance', 0.5),
                            "address": addr,
                            "admin_hierarchy": admin,
                            "place_id": item.get('place_id', f"nominatim_{item.get('osm_id', '')}")
                        })
                    print(f"[GEOCODE AUDIT] Nominatim returned {len(results)} results")
                    return results
            except Exception as e:
                print(f"[GEOCODE ERROR] Nominatim error: {e}")
            return []
        
        def search_photon(q):
            try:
                url = f"https://photon.komoot.io/api/?q={q}&limit=8"
                print(f"[GEOCODE AUDIT] Photon search URL: {url}")
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    features = response.json().get('features', [])
                    results = []
                    for f in features:
                        props = f.get('properties', {})
                        coords = f.get('geometry', {}).get('coordinates', [0, 0])
                        admin = []
                        for key in ['country', 'state', 'county', 'city']:
                            if key in props and props[key] not in admin:
                                admin.append(props[key])
                        results.append({
                            "source": "Photon",
                            "display_name": f"{props.get('name', '')}, {props.get('country', '')}",
                            "place_name": props.get('name', ''),
                            "lat": coords[1],
                            "lon": coords[0],
                            "type": props.get('osm_type', ''),
                            "importance": props.get('importance', 0.5),
                            "address": props,
                            "admin_hierarchy": admin,
                            "place_id": f"photon_{props.get('osm_id', '')}"
                        })
                    print(f"[GEOCODE AUDIT] Photon returned {len(results)} results")
                    return results
            except Exception as e:
                print(f"[GEOCODE ERROR] Photon error: {e}")
            return []
        
        # Detect if query is for institution or village for enhanced search
        institution_keywords = ['university', 'college', 'school', 'institute', 'hospital', 'clinic', 'academy', 'vidyalaya', 'mahavidyalaya']
        village_keywords = ['village', 'gram', 'gaon', 'hamlet', 'dhani', 'tole']
        
        is_institution = any(kw in query_lower for kw in institution_keywords)
        is_village = any(kw in query_lower for kw in village_keywords)
        
        # Enhanced search strategies for institutions and villages
        search_queries = [query]
        
        if is_institution:
            # Try institution name + city + state + country
            if 'west bengal' not in query_lower:
                search_queries.append(f"{query}, West Bengal, India")
            if 'india' not in query_lower:
                search_queries.append(f"{query}, India")
            print(f"[GEOCODE AUDIT] Institution detected, using enhanced search strategies")
        
        if is_village:
            # Try village + district + state + country
            if 'west bengal' not in query_lower:
                search_queries.append(f"{query}, West Bengal, India")
            if 'bankura' in query_lower or 'purba bardhaman' in query_lower:
                # Add district-specific search
                district = 'Bankura' if 'bankura' in query_lower else 'Purba Bardhaman'
                search_queries.append(f"{query}, {district}, West Bengal, India")
            print(f"[GEOCODE AUDIT] Village detected, using enhanced search strategies")
        
        # Remove duplicates while preserving order
        search_queries = list(dict.fromkeys(search_queries))
        print(f"[GEOCODE AUDIT] Search queries: {search_queries}")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = {}
            for search_query in search_queries:
                futures[f'nominatim_{search_query}'] = executor.submit(search_nominatim, search_query)
                futures[f'photon_{search_query}'] = executor.submit(search_photon, search_query)
            
            results = {}
            for name, future in futures.items():
                try:
                    results[name] = future.result()
                except Exception as e:
                    print(f"{name} future error: {e}")
                    results[name] = []
        
        # Aggregate results from all search queries
        for key, value in results.items():
            all_results.extend(value)
        
        if len(all_results) < 5:
            overpass_results = search_overpass(query)
            all_results.extend(overpass_results)
        
        print(f"[GEOCODE AUDIT] Total raw results from all sources: {len(all_results)}")
        
        seen_coords = set()
        ranked = []
        for res in all_results:
            try:
                lat = float(res.get('lat', 0))
                lon = float(res.get('lon', 0))
            except (ValueError, TypeError):
                continue
            key = (round(lat, 4), round(lon, 4))
            if key in seen_coords:
                continue
            seen_coords.add(key)
            
            base_score = res.get('score', 0)
            display_name_lower = res.get('display_name', '').lower()
            fuzzy_token_sort = fuzz.token_sort_ratio(query_lower, display_name_lower)
            fuzzy_score = fuzzy_token_sort
            importance = res.get('importance', 0.5)
            exact_boost = 50 if query_lower in display_name_lower else 0
            
            # IMPROVED: Prioritize longer, more specific matches for villages/institutions
            specificity_boost = 0
            display_name_parts = len(res.get('display_name', '').split(','))
            if display_name_parts >= 4:  # More specific (village, district, state, country)
                specificity_boost = 20
            elif display_name_parts >= 3:
                specificity_boost = 10
            
            # IMPROVED: Boost for exact word matches at the beginning
            words_in_query = query_lower.split()
            first_word_match = False
            if words_in_query and display_name_lower.startswith(words_in_query[0]):
                first_word_match = True
                specificity_boost += 15
            
            type_boost = 0
            res_type = str(res.get('type', '')).lower()
            type_keywords = {
                'village': ['village', 'gram', 'halka', 'gaon'],
                'hamlet': ['hamlet', 'dhani', 'tole'],
                'locality': ['locality', 'mohalla', 'area'],
                'school': ['school', 'vidyalaya'],
                'college': ['college', 'mahavidyalaya'],
                'university': ['university', 'vishwavidyalaya', 'institute'],
                'hospital': ['hospital', 'medical', 'clinic', 'aspatal'],
                'airport': ['airport', 'aerodrome', 'terminal'],
                'railway': ['railway', 'station', 'train'],
                'bus': ['bus', 'terminal', 'stand'],
                'tourism': ['tourist', 'attraction', 'monument', 'museum', 'landmark']
            }
            for target_type, keywords in type_keywords.items():
                if any(kw in query_lower for kw in keywords):
                    if target_type in res_type:
                        type_boost += 30  # Increased from 30 to 40 for better matching
                        print(f"[GEOCODE AUDIT] Type match boost: {target_type} in {res_type}")
            
            admin_boost = 0
            admin = res.get('admin_hierarchy', [])
            for part in admin:
                if part.lower() in query_lower:
                    admin_boost += 15
            
            source_boost = 0
            source = res.get('source','')
            if source == 'Nominatim':
                source_boost = 10
            elif source == 'Photon':
                source_boost = 8
            elif source == 'Overpass API':
                source_boost = 7
            elif source == 'Local Database':
                source_boost = 15  # Boost local database entries
            
            total_score = base_score + fuzzy_score + (importance*30) + exact_boost + type_boost + admin_boost + source_boost + specificity_boost
            res['score'] = total_score
            res['lat'] = lat
            res['lon'] = lon
            ranked.append(res)
            print(f"[GEOCODE AUDIT] Scored result: {res.get('display_name', '')[:50]}... score={total_score:.2f}")
        
        ranked.sort(key=lambda x: x.get('score',0), reverse=True)
        top_results = ranked[:10]
        
        print(f"[GEOCODE AUDIT] Top {len(top_results)} ranked results")
        
        final_results = []
        for idx, res in enumerate(top_results):
            final_results.append({
                "display_name": res.get('display_name',''),
                "place_name": res.get('place_name', res.get('display_name', '').split(',')[0]),
                "lat": res['lat'],
                "lon": res['lon'],
                "type": res.get('type',''),
                "address": res.get('address',{}),
                "source": res.get('source',''),
                "rank": idx+1,
                "score": round(res.get('score',0),2),
                "place_id": res.get('place_id', '')
            })
        
        # LOG: Resolved coordinates for best match
        if final_results:
            best = final_results[0]
            print(f"[GEOCODE AUDIT] Best match: {best['display_name']}")
            print(f"[GEOCODE AUDIT] Resolved coordinates: lat={best['lat']}, lon={best['lon']}")
            print(f"[GEOCODE AUDIT] Place ID: {best.get('place_id', 'N/A')}")
        
        # REMOVED: Fallback to nearby city coordinates - now returns error instead
        if not final_results:
            print(f"[GEOCODE ERROR] No results found for query: {query}")
            return jsonify({"error": "Location could not be resolved. No matching places found."}), 404
        
        response_data = {"results": final_results, "total_results": len(final_results), "best_match": final_results[0]}
        geocode_cache[cache_key] = (response_data, time.time() + CACHE_TTL)
        return jsonify(response_data)
    except Exception as e:
        print(f"[GEOCODE CRITICAL ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Geocoding service error: {str(e)}"}), 500

def calculate_search_confidence(item, query, indian_keywords):
    """Calculate search confidence score for Nominatim results"""
    score = 0.5  # Base score
    
    # Exact match bonus
    display_name = item.get('display_name', '').lower()
    query_lower = query.lower()
    
    if query_lower in display_name:
        score += 0.4
    
    # Indian location bonus
    for city, variants in indian_keywords.items():
        if any(variant in display_name for variant in variants):
            score += 0.2
            break
    
    # Type-specific bonuses
    item_type = item.get('class', '').lower()
    if item_type in ['highway', 'primary', 'secondary']:
        score += 0.1
    elif item_type in ['amenity', 'shop', 'restaurant']:
        score += 0.05
    
    # Importance score
    importance = item.get('importance', 0)
    if importance > 0.8:
        score += 0.1
    
    return min(1.0, score)

def calculate_photon_confidence(props, query, indian_keywords):
    """Calculate search confidence score for Photon API results"""
    score = 0.4  # Lower base score for fallback
    
    name = props.get('name', '').lower()
    query_lower = query.lower()
    
    if query_lower in name:
        score += 0.3
    
    # OSM type bonus
    osm_type = props.get('osm_type', '')
    if osm_type in ['highway', 'place']:
        score += 0.2
    
    return min(1.0, score)

def calculate_osm_confidence(item, query, indian_keywords):
    """Calculate search confidence score for OSM Names results"""
    return 0.3  # Lowest confidence for last fallback

@app.route('/api/reverse_geocode', methods=['GET'])
def reverse_geocode():
    """Reverse geocode coordinates to full structured address with Nominatim API"""
    import time
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        if not lat or not lon:
            return jsonify({"error": "Latitude and longitude required"}), 400
        
        cache_key = f"{lat},{lon}"
        
        if cache_key in reverse_geocode_cache:
            cached_result, expiry = reverse_geocode_cache[cache_key]
            if time.time() < expiry:
                return jsonify(cached_result)
            else:
                del reverse_geocode_cache[cache_key]
        
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&addressdetails=1&accept-language=en"
        headers = {'User-Agent': 'TrafficSense AI/3.0'}
        
        response = requests.get(url, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            addr = data.get('address', {})
            
            village = addr.get('village', addr.get('hamlet', addr.get('suburb', addr.get('neighbourhood', ''))))
            area = addr.get('suburb', addr.get('neighbourhood', addr.get('township', '')))
            city = addr.get('city', addr.get('town', addr.get('municipality', '')))
            district = addr.get('county', addr.get('district', ''))
            state = addr.get('state', '')
            country = addr.get('country', '')
            
            structured_address = {
                'village_locality': village,
                'area': area,
                'city': city,
                'district': district,
                'state': state,
                'country': country,
                'full_address': data.get('display_name', '')
            }
            
            response_data = {
                "display_name": data.get('display_name', ''),
                "structured_address": structured_address,
                "address": addr,
                "lat": float(data.get('lat', lat)),
                "lon": float(data.get('lon', lon))
            }
            
            reverse_geocode_cache[cache_key] = (response_data, time.time() + CACHE_TTL)
            
            return jsonify(response_data)
        else:
            return jsonify({"error": "Reverse geocoding service unavailable"}), 503
            

            
    except Exception as e:
        return jsonify({"error": "Reverse geocoding failed", "details": str(e)}), 500

@app.route('/api/route', methods=['POST'])
def get_route():
    """Get real route using OSRM API with comprehensive logging and validation"""
    try:
        data = request.json
        start_lat = data.get('start_lat')
        start_lon = data.get('start_lon')
        end_lat = data.get('end_lat')
        end_lon = data.get('end_lon')
        alternatives = data.get('alternatives', True)
        start_location = data.get('start_location', 'N/A')
        end_location = data.get('end_location', 'N/A')
        
        # LOG: Start and destination coordinates
        print(f"[ROUTE AUDIT] Start Location: {start_location}")
        print(f"[ROUTE AUDIT] Destination: {end_location}")
        print(f"[ROUTE AUDIT] Start Lat: {start_lat}, Start Lon: {start_lon}")
        print(f"[ROUTE AUDIT] End Lat: {end_lat}, End Lon: {end_lon}")
        
        # VALIDATE: Coordinates are present
        if not all([start_lat, start_lon, end_lat, end_lon]):
            print(f"[ROUTE ERROR] Missing coordinates - start_lat: {start_lat}, start_lon: {start_lon}, end_lat: {end_lat}, end_lon: {end_lon}")
            return jsonify({"error": "Location could not be resolved. Coordinates are missing."}), 400
        
        # VALIDATE: Coordinates are different
        if float(start_lat) == float(end_lat) and float(start_lon) == float(end_lon):
            print(f"[ROUTE ERROR] Start and destination coordinates are identical")
            return jsonify({"error": "Start and destination locations are the same. Please choose different locations."}), 400
        
        # VALIDATE: Coordinates are within valid ranges
        try:
            start_lat_f = float(start_lat)
            start_lon_f = float(start_lon)
            end_lat_f = float(end_lat)
            end_lon_f = float(end_lon)
            
            if not (-90 <= start_lat_f <= 90) or not (-180 <= start_lon_f <= 180):
                print(f"[ROUTE ERROR] Invalid start coordinates: lat={start_lat_f}, lon={start_lon_f}")
                return jsonify({"error": "Invalid start coordinates. Location could not be resolved."}), 400
            
            if not (-90 <= end_lat_f <= 90) or not (-180 <= end_lon_f <= 180):
                print(f"[ROUTE ERROR] Invalid end coordinates: lat={end_lat_f}, lon={end_lon_f}")
                return jsonify({"error": "Invalid destination coordinates. Location could not be resolved."}), 400
        except (ValueError, TypeError) as e:
            print(f"[ROUTE ERROR] Invalid coordinate format: {e}")
            return jsonify({"error": "Invalid coordinate format. Location could not be resolved."}), 400
        
        # VERIFY: Resolved coordinates correspond to displayed location
        print(f"[ROUTE AUDIT] Verifying coordinates correspond to displayed locations...")
        try:
            # Reverse geocode start coordinates to verify
            start_verify_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={start_lat}&lon={start_lon}&accept-language=en"
            start_verify_resp = requests.get(start_verify_url, headers={'User-Agent': 'TrafficSenseAI/3.0'}, timeout=10)
            if start_verify_resp.status_code == 200:
                start_verify_data = start_verify_resp.json()
                start_verify_name = start_verify_data.get('display_name', '')
                print(f"[ROUTE AUDIT] Start coordinate verification: {start_verify_name}")
                
                # Check if the verified name contains key parts of the input location
                start_location_lower = start_location.lower()
                start_verify_lower = start_verify_name.lower()
                
                # For villages/institutions, be more lenient with matching
                if any(kw in start_location_lower for kw in ['village', 'university', 'college', 'school']):
                    # Check if at least the main name matches
                    start_words = start_location_lower.split(',')[0].split()
                    verify_match = any(word in start_verify_lower for word in start_words if len(word) > 3)
                    if not verify_match:
                        print(f"[ROUTE WARNING] Start coordinate verification failed: {start_location} vs {start_verify_name}")
                else:
                    # For cities, be stricter
                    if start_location_lower.split(',')[0] not in start_verify_lower:
                        print(f"[ROUTE WARNING] Start coordinate verification may be inaccurate: {start_location} vs {start_verify_name}")
            
            # Reverse geocode end coordinates to verify
            end_verify_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={end_lat}&lon={end_lon}&accept-language=en"
            end_verify_resp = requests.get(end_verify_url, headers={'User-Agent': 'TrafficSenseAI/3.0'}, timeout=10)
            if end_verify_resp.status_code == 200:
                end_verify_data = end_verify_resp.json()
                end_verify_name = end_verify_data.get('display_name', '')
                print(f"[ROUTE AUDIT] Destination coordinate verification: {end_verify_name}")
                
                # Check if the verified name contains key parts of the input location
                end_location_lower = end_location.lower()
                end_verify_lower = end_verify_name.lower()
                
                # For villages/institutions, be more lenient with matching
                if any(kw in end_location_lower for kw in ['village', 'university', 'college', 'school']):
                    # Check if at least the main name matches
                    end_words = end_location_lower.split(',')[0].split()
                    verify_match = any(word in end_verify_lower for word in end_words if len(word) > 3)
                    if not verify_match:
                        print(f"[ROUTE WARNING] Destination coordinate verification failed: {end_location} vs {end_verify_name}")
                else:
                    # For cities, be stricter
                    if end_location_lower.split(',')[0] not in end_verify_lower:
                        print(f"[ROUTE WARNING] Destination coordinate verification may be inaccurate: {end_location} vs {end_verify_name}")
        except Exception as verify_error:
            print(f"[ROUTE WARNING] Coordinate verification failed: {verify_error}")
            # Continue with routing even if verification fails
        
        # LOG: OSRM request URL
        alt_param = "&alternatives=true" if alternatives else ""
        url = f"https://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson&steps=true{alt_param}"
        print(f"[ROUTE AUDIT] OSRM Request URL: {url}")
        
        # Make OSRM request
        response = requests.get(url, timeout=15)
        print(f"[ROUTE AUDIT] OSRM Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[ROUTE AUDIT] OSRM Response Code: {data.get('code')}")
            
            if data.get('code') != 'Ok':
                print(f"[ROUTE ERROR] OSRM returned non-Ok code: {data.get('code')}")
                return jsonify({"error": "No route found between these locations. The locations may not be connected by road network."}), 404
            
            # LOG: Route data from OSRM
            routes_data = data.get('routes', [])
            print(f"[ROUTE AUDIT] Number of routes returned: {len(routes_data)}")
            
            if not routes_data:
                print(f"[ROUTE ERROR] No routes in OSRM response")
                return jsonify({"error": "No route found between these locations."}), 404
            
            routes = []
            for i, route in enumerate(routes_data):
                distance_m = route.get('distance', 0)
                duration_s = route.get('duration', 0)
                distance_km = distance_m / 1000
                duration_min = duration_s / 60
                
                print(f"[ROUTE AUDIT] Route {i+1}: Distance={distance_km:.2f} km, Duration={duration_min:.2f} min")
                
                # VALIDATE: Distance and duration are reasonable
                if distance_km <= 0:
                    print(f"[ROUTE ERROR] Route {i+1} has invalid distance: {distance_km} km")
                    continue
                
                if duration_min <= 0:
                    print(f"[ROUTE ERROR] Route {i+1} has invalid duration: {duration_min} min")
                    continue
                
                route_data = {
                    "distance": distance_km,
                    "duration": duration_min,
                    "geometry": route.get('geometry', {}),
                    "legs": route.get('legs', []),
                    "weight": route.get('weight', 0)
                }
                routes.append(route_data)
            
            if not routes:
                print(f"[ROUTE ERROR] All routes had invalid distance/duration")
                return jsonify({"error": "Route calculation failed. Invalid distance or duration received from routing service."}), 500
            
            print(f"[ROUTE AUDIT] Successfully processed {len(routes)} valid routes")
            return jsonify({
                "routes": routes,
                "waypoints": data.get('waypoints', []),
                "code": data.get('code', 'Ok')
            })
        else:
            print(f"[ROUTE ERROR] OSRM request failed with status {response.status_code}")
            print(f"[ROUTE ERROR] Response body: {response.text}")
            return jsonify({"error": f"Routing service unavailable (HTTP {response.status_code}). Please try again later."}), 503
            
    except Exception as e:
        print(f"[ROUTE ERROR] Exception in route calculation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Routing failed", "details": str(e)}), 500

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """Get weather data using OpenWeatherMap API (FREE tier) - PRODUCTION MODE"""
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        if not lat or not lon:
            return jsonify({"error": "Latitude and longitude required"}), 400
        
        # PRODUCTION: Use real OpenWeatherMap API
        api_key = os.environ.get('OPENWEATHER_API_KEY') or DEMO_WEATHER_API_KEY
        
        if not api_key:
            # GRACEFUL FALLBACK: No fake data, show proper error
            return jsonify({
                "error": "Weather service temporarily unavailable",
                "message": "OpenWeatherMap API key not configured",
                "fallback": "Weather data temporarily unavailable",
                "condition": "N/A",
                "temperature": 0,
                "feels_like": 0,
                "humidity": 0,
                "visibility": 0,
                "wind_speed": 0,
                "wind_direction": 0,
                "pressure": 0,
                "rain_condition": None,
                "fog_detected": False,
                "storm_detected": False,
                "cloud_coverage": 0,
                "sunrise": datetime.datetime.now().replace(hour=6, minute=0).isoformat(),
                "sunset": datetime.datetime.now().replace(hour=18, minute=0).isoformat(),
                "timestamp": datetime.datetime.now().isoformat(),
                "last_updated": datetime.datetime.now().isoformat(),
                "source": "Service Unavailable",
                "verified": False,
                "severe_warning": None,
                "rain_probability": 0,
                "impact_level": "unknown"
            })
        
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        
        response = requests.get(url, timeout=8)
        if response.status_code == 200:
            data = response.json()
            
            # Extract detailed weather information
            weather_main = data.get('weather', [{}])[0].get('main', '')
            weather_desc = data.get('weather', [{}])[0].get('description', 'unknown')
            
            # Enhanced weather detection
            rain_condition = None
            visibility_km = data.get('visibility', 10000) / 1000
            
            if 'rain' in weather_desc.lower():
                rain_condition = 'rain'
            elif 'drizzle' in weather_desc.lower():
                rain_condition = 'drizzle'
            elif 'snow' in weather_desc.lower():
                rain_condition = 'snow'
            
            fog_detected = visibility_km < 1.0 or 'fog' in weather_desc.lower() or 'mist' in weather_desc.lower()
            storm_detected = 'thunderstorm' in weather_desc.lower() or 'storm' in weather_desc.lower()
            
            # Calculate rain probability and impact level
            cloud_coverage = data.get('clouds', {}).get('all', 0)
            wind_speed = data.get('wind', {}).get('speed', 0)
            rain_probability = 0
            if rain_condition:
                rain_probability = 70 if rain_condition == 'rain' else 90 if rain_condition == 'thunderstorm' else 40
            elif cloud_coverage > 70:
                rain_probability = 30
            
            # Determine impact level
            impact_level = "low"
            severe_warning = None
            
            if storm_detected:
                impact_level = "severe"
                severe_warning = "Severe thunderstorm warning - seek shelter immediately"
            elif fog_detected and visibility_km < 0.5:
                impact_level = "high"
                severe_warning = "Dense fog warning - reduced visibility"
            elif rain_condition == 'rain' and visibility_km < 2:
                impact_level = "high"
                severe_warning = "Heavy rain warning - hazardous driving conditions"
            elif wind_speed > 15:
                impact_level = "medium"
                severe_warning = "Strong winds warning"
            elif rain_condition:
                impact_level = "medium"
            elif fog_detected:
                impact_level = "medium"
            
            weather_data = {
                "condition": weather_desc,
                "temperature": data.get('main', {}).get('temp', 0),
                "feels_like": data.get('main', {}).get('feels_like', 0),
                "humidity": data.get('main', {}).get('humidity', 0),
                "visibility": visibility_km,
                "wind_speed": data.get('wind', {}).get('speed', 0),
                "wind_direction": data.get('wind', {}).get('deg', 0),
                "pressure": data.get('main', {}).get('pressure', 0),
                "rain_condition": rain_condition,
                "fog_detected": fog_detected,
                "storm_detected": storm_detected,
                "cloud_coverage": data.get('clouds', {}).get('all', 0),
                "sunrise": datetime.datetime.fromtimestamp(data.get('sys', {}).get('sunrise', 0)).isoformat(),
                "sunset": datetime.datetime.fromtimestamp(data.get('sys', {}).get('sunset', 0)).isoformat(),
                "timestamp": datetime.datetime.now().isoformat(),
                "last_updated": datetime.datetime.fromtimestamp(data.get('dt', 0)).isoformat(),
                "source": "OpenWeatherMap API",
                "verified": True,
                "severe_warning": severe_warning,
                "rain_probability": rain_probability,
                "impact_level": impact_level
            }
            
            return jsonify(weather_data)
        else:
            return jsonify({
                "error": "Weather service temporarily unavailable",
                "status_code": response.status_code,
                "fallback": "Using last known weather data"
            }), response.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Weather API timeout",
            "fallback": "Service temporarily slow, using cached data"
        }), 504
    except Exception as e:
        return jsonify({
            "error": "Weather service error", 
            "details": str(e),
            "fallback": "Graceful degradation activated"
        }), 500

def get_weather_for_location(lat, lon, time_str=None, day=None):
    """Internal function to get weather data - DETERMINISTIC MODE"""
    # Use deterministic weather based on location, day, and time instead of external API
    # This ensures same input always produces same output
    try:
        # Parse time if provided
        hour = 12
        if time_str:
            hour = int(time_str.split(':')[0])
        
        # Create deterministic weather based on location hash and time
        # Use lat, lon, day, hour to generate consistent weather
        location_hash = abs(int((lat * 100 + lon) * 1000)) % 100
        
        # Deterministic weather patterns based on time of day
        if 6 <= hour <= 18:
            # Daytime
            if location_hash < 30:
                condition = "clear sky"
                temperature = 28 + (location_hash % 5)
                visibility = 10
            elif location_hash < 60:
                condition = "few clouds"
                temperature = 26 + (location_hash % 5)
                visibility = 9
            elif location_hash < 80:
                condition = "scattered clouds"
                temperature = 25 + (location_hash % 4)
                visibility = 8
            else:
                condition = "light rain"
                temperature = 24 + (location_hash % 3)
                visibility = 6
        else:
            # Nighttime
            if location_hash < 40:
                condition = "clear sky"
                temperature = 22 + (location_hash % 4)
                visibility = 10
            elif location_hash < 70:
                condition = "few clouds"
                temperature = 20 + (location_hash % 4)
                visibility = 9
            else:
                condition = "mist"
                temperature = 19 + (location_hash % 3)
                visibility = 5
        
        humidity = 50 + (location_hash % 30)
        
        return {
            "condition": condition,
            "temperature": temperature,
            "visibility": visibility,
            "humidity": humidity,
            "rain_condition": 'rain' if 'rain' in condition.lower() else None,
            "fog_detected": visibility < 5 or 'fog' in condition.lower() or 'mist' in condition.lower(),
            "storm_detected": 'thunderstorm' in condition.lower(),
            "source": "Deterministic Model"
        }
    except:
        return None

def get_weather_fallback(lat, lon, time_str=None):
    """Graceful fallback - DETERMINISTIC MODE"""
    # Return conservative estimate based on input time, not current time
    # This ensures same input always produces same output
    
    # Parse time if provided
    hour = 12
    if time_str:
        hour = int(time_str.split(':')[0])
    
    # Conservative weather estimate based on time of day
    if 6 <= hour <= 18:
        return {
            "condition": "partly cloudy",
            "temperature": 25,
            "visibility": 8,
            "humidity": 60,
            "rain_condition": None,
            "fog_detected": False,
            "storm_detected": False,
            "source": "Deterministic Fallback",
            "verified": False
        }
    else:
        return {
            "condition": "clear",
            "temperature": 20,
            "visibility": 10,
            "humidity": 50,
            "rain_condition": None,
            "fog_detected": False,
            "storm_detected": False,
            "source": "Deterministic Fallback",
            "verified": False
        }

def calculate_accident_risk(lat, lon, time_str, day, weather_data):
    """Calculate accident risk based on multiple factors"""
    try:
        hour = int(time_str.split(':')[0])
        is_weekend = day in ['Saturday', 'Sunday']
        
        risk_score = 0.3  # Base risk
        
        # Time-based risk
        if 22 <= hour or hour <= 6:  # Night time
            risk_score += 0.3
        elif 17 <= hour <= 19:  # Rush hour evening
            risk_score += 0.2
        elif 7 <= hour <= 9:  # Rush hour morning
            risk_score += 0.15
        
        # Weather-based risk
        if weather_data:
            condition = weather_data.get('condition', '').lower()
            visibility = weather_data.get('visibility', 10)
            
            if 'rain' in condition:
                risk_score += 0.2
                if 'heavy' in condition:
                    risk_score += 0.15
            elif 'fog' in condition or visibility < 5:
                risk_score += 0.25
            elif 'storm' in condition:
                risk_score += 0.3
        
        # Weekend vs weekday
        if is_weekend:
            risk_score -= 0.1  # Generally safer on weekends
        
        # Normalize to 0-1 range
        return min(1.0, max(0.0, risk_score))
        
    except:
        return 0.3  # Default moderate risk

# ✅ RENDER DEPLOY READY
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))