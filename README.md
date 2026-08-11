<div align="center">

# TrafficSense AI

### Universal Smart City Traffic Management System

**AI-Powered Traffic Prediction | Real-Time Routing | Multi-Platform Deployment**

---

> Built with Flask, Electron, Capacitor, Leaflet Maps, and Deterministic ML Prediction Engine

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Electron](https://img.shields.io/badge/Electron-27.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org)
[![Android](https://img.shields.io/badge/Android-Capacitor_5-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://capacitorjs.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=openstreetmap&logoColor=white)](https://leafletjs.com)

</div>

---

## Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Project Structure](#project-structure)
5. [Quick Start](#quick-start)
6. [Installation Guides](#installation-guides)
   - [Web / Backend](#web--backend)
   - [Desktop Application](#desktop-application)
   - [Mobile Application (Android)](#mobile-application-android)
7. [API Documentation](#api-documentation)
8. [Technology Stack](#technology-stack)
9. [Prediction Engine](#prediction-engine)
10. [Build & Deployment](#build--deployment)
11. [License](#license)

---

## Overview

**TrafficSense AI** is a production-grade, cross-platform Smart City traffic intelligence platform. It delivers real-time traffic predictions powered by a deterministic ML inference engine, augmented with geospatial routing, hyper-local weather data, and accident risk modeling. The application ships as a **Universal Binary** across three platforms:

- **Web Dashboard** — browser-based PWA for any device
- **Desktop App** — Electron.js wrapper with auto-launched backend
- **Mobile App** — native Android via Capacitor with Geolocation + Haptics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UNIVERSAL UI LAYER                          │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────────┐   │
│  │  Web (PWA) │   │   Desktop    │   │   Mobile (Android APK)   │   │
│  └─────┬──────┘   └──────┬───────┘   └────────────┬─────────────┘   │
│        │                 │                         │                 │
│        └─────────────────┴─────────┬───────────────┘                 │
│                                    │                                 │
│                            ┌───────▼───────┐                         │
│                            │   HTML5 GUI   │                         │
│                            │  Leaflet Maps │                         │
│                            └───────┬───────┘                         │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │ HTTPS / REST
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FLASK BACKEND ENGINE                            │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Predict API │  │ Geocode API  │  │     Routing API          │   │
│  │ (ML Engine)  │  │ (4 Sources)  │  │    (OSRM + GeoJSON)      │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘   │
│         │                 │                         │                 │
│         └─────────────────┴───────────┬─────────────┘                 │
│                                       │                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Weather API │  │ Heatmap API  │  │  Reverse Geocode API     │   │
│  │ (OWM + Local)│  │   (City Grid)│  │    (Nominatim)           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                INTERNAL SERVICES & CACHING                     │   │
│  │   • RapidFuzz Fuzzy Matching  • 5-min TTL Cache               │   │
│  │   • Deterministic ML Models   • Audit Logging                 │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────┐
                │     EXTERNAL DATA PROVIDERS          │
                │  Nominatim • Photon • Overpass API   │
                │  OpenStreetMap • OSRM Router         │
                │  OpenWeatherMap • Local Geo DB       │
                └──────────────────────────────────────┘
```

---

## Key Features

### 🤖 AI Prediction Engine
| Capability | Description |
|---|---|
| **Traffic Level Prediction** | Deterministic `low` / `medium` / `high` classification based on time, day, weather, and accident risk |
| **Rush Hour Awareness** | Weighted bias models for morning (7-9AM) and evening (5-7PM) peaks |
| **Weekend Logic** | Separate traffic density profiles for Saturday/Sunday |
| **Weather Impact Model** | Rain / Fog / Snow modifiers with severity cascading |
| **Accident Risk Scoring** | 0-1 normalized score affecting confidence & predictions |
| **Emergency Priority Mode** | Dedicated routing profile for emergency vehicles |
| **Confidence Scoring** | 60-98% confidence index derived from input quality |
| **Peak Efficiency Time** | Calculates next optimal travel window dynamically |

### 🗺️ Geospatial Intelligence
- **Leaflet.js Interactive Map** with real-time route overlay
- **OSRM Full Route Calculation** with turn-by-turn geometry
- **Multi-Source Geocoding** (Nominatim + Photon + Overpass API + Local Database)
- **RapidFuzz Fuzzy Matching** with configurable type boosting (village / university / hospital / railway / airport)
- **Reverse Geocoding** with structured address extraction
- **Location Audit Trail** — every resolved coordinate logged with verification

### 🌦️ Weather Integration
- OpenWeatherMap API with units=metric
- Graceful deterministic fallback when API unavailable
- Fog / Rain / Storm / Wind severity detection
- Impact level classification: `low → medium → high → severe`
- Severe warning system with auto-triggered alerts

### 📊 Analytics Dashboard
- Active vehicle count estimation
- Flow velocity tracker (km/h)
- Average latency metrics
- Per-city heatmap (Kolkata, Mumbai, Delhi, Bangalore, Chennai)
- Real-time status indicator (LIVE AI ANALYSIS ACTIVE)

### 🎨 UI / UX
- Futuristic cyberpunk theme with glassmorphism effects
- Dark-mode optimized with gold (#d4af37) accents
- PWA installable on any device (manifest.json + Service Worker)
- **AOS Scroll Animations** — fade-down, zoom, slide
- Voice Assistant toggle (speech synthesis)
- GPS One-Tap Geolocation
- Demo Mode for simulated environments
- Global search with autocomplete dropdown

### 📱 Cross-Platform Deployment
- **Web**: Fully responsive PWA (mobile-first, touch-optimized)
- **Desktop**: Electron (Windows NSIS installer / Linux AppImage / macOS DMG)
- **Mobile**: Capacitor Android (SplashScreen, StatusBar, Geolocation, Network, Haptics, App plugins)

---

## Project Structure

```
traffic-sense-ai/
├── backend/
│   ├── app.py                          # Flask core — ALL API endpoints + services
│   ├── train_model.py                  # ML model training script
│   └── model/                          # Pre-trained serialized models
│       ├── traffic_model.pkl           # Primary traffic classifier
│       ├── le_day.pkl                  # Day label encoder
│       ├── le_level.pkl                # Traffic level encoder
│       └── le_loc.pkl                  # Location encoder
│
├── frontend/
│   ├── templates/
│   │   └── index.html                  # Main dashboard — Leaflet, AOS, Forms, Cards
│   └── static/
│       ├── css/style.css               # Cyberpunk / Glassmorphism theme (15k+ lines)
│       ├── js/
│       │   ├── main.js                 # Core UI logic + map integration
│       │   └── main.js.fixed           # Stabilized/backup JS bundle
│       ├── icons/app-logo.svg          # Inline SVG logo (gold/black)
│       ├── manifest.json               # PWA manifest
│       └── sw.js                       # Service Worker (offline caching)
│
├── desktop/
│   ├── main.js                         # Electron main process + server autolaunch
│   ├── preload.js                      # Context-bridge IPC
│   └── package.json                    # electron-builder configuration
│
├── mobile/
│   ├── capacitor.config.json           # Capacitor 5 configuration
│   ├── package.json                    # Android Capacitor plugin set
│   ├── ANDROID_SETUP_GUIDE.md          # Complete Android build walkthrough
│   ├── public/                         # Mobile-optimized PWA assets
│   │   ├── index.html                  # Mobile-specific HTML entry
│   │   └── static/
│   │       ├── css/style.css
│   │       ├── js/api.js               # Mobile API abstraction layer
│   │       ├── js/main.js              # Mobile UI controller
│   │       └── ... (manifest, sw, icons)
│   └── android/                        # Full Android Studio project
│       ├── app/src/main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/trafficsense/ai/MainActivity.java
│       │   └── res/                    # Launcher icons, splash, strings, styles
│       ├── build.gradle
│       ├── capacitor.build.gradle
│       ├── variables.gradle
│       ├── gradle/wrapper/
│       └── gradlew / gradlew.bat
│
├── requirements.txt                    # Python dependencies (Flask, RapidFuzz, etc.)
├── start_mobile_server.py              # Dev server launcher (0.0.0.0:5000 + mobile URLs)
├── build-all-apps.py                   # Universal AppBuilder — desktop + mobile builds
└── .gitignore                          # venv, pycache, node_modules, .env
```

---

## Quick Start

### Web / Backend (5 minutes)

**Prerequisites:** Python 3.10+ and pip

```powershell
# 1. Clone
git clone https://github.com/Rupsa-96/traffic-sense-ai.git
cd traffic-sense-ai

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Launch backend + frontend
cd backend
python app.py
```

Then open **http://localhost:5000** in your browser.

---

## Installation Guides

### Web / Backend

#### 1. Python Environment Setup

```powershell
# Verify Python (3.10+ recommended)
python --version

# Clone repository
git clone https://github.com/Rupsa-96/traffic-sense-ai.git
cd traffic-sense-ai

# Install dependencies
pip install -r requirements.txt
```

#### 2. Configuration (Optional)

Environment variables (`.env` in project root):

| Variable | Purpose | Default |
|---|---|---|
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key | Fallback demo key |

#### 3. Launch Modes

| Mode | Command | Access |
|---|---|---|
| **Local-only** | `cd backend; python app.py` | `http://localhost:5000` |
| **LAN / Mobile** | `python start_mobile_server.py` | `http://<YOUR-IP>:5000` |
| **Debug** | Above commands automatically enable `debug=True` | Live reload enabled |

---

### Desktop Application

**Prerequisites:** Node.js 18+, npm, Python 3.10+

```powershell
cd desktop

# Install Electron + build tools
npm install

# Run in development mode (auto-launches backend server)
npm start

# Build platform installers
npm run build-win      # Windows NSIS (.exe)
npm run build-linux    # Linux AppImage
npm run build-mac      # macOS DMG
```

The Electron app automatically:
1. Spawns the Flask backend as a child process
2. Finds the correct Python interpreter from 6 possible paths
3. Retries loading `http://localhost:5000` until the server is ready
4. Opens external links in the OS default browser (security best practice)

---

### Mobile Application (Android)

**Full guide:** [mobile/ANDROID_SETUP_GUIDE.md](mobile/ANDROID_SETUP_GUIDE.md)

**Prerequisites:**
- Node.js 16+
- Android Studio (with Android SDK 33+)
- Java JDK 11+

```powershell
cd mobile

# 1. Install Capacitor + plugins
npm install

# 2. Sync web assets to Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. (Alternative) Run directly on connected device/emulator
npx cap run android
```

**Important:** The backend server must be reachable from the device. Use the same Wi-Fi and connect via `http://<PC-LOCAL-IP>:5000`.

**Capacitor Plugins Enabled:**
- `@capacitor/geolocation` — GPS permission (fine + coarse)
- `@capacitor/haptics` — Vibration feedback
- `@capacitor/network` — Connectivity status
- `@capacitor/splash-screen` — 3s immersive splash (gold/dark)
- `@capacitor/status-bar` — Dark status bar, `#0a0a0a` background
- `@capacitor/app` — App lifecycle events

---

## API Documentation

Base URL: `http://localhost:5000` or your network address.

### 1. Traffic Prediction — `POST /api/predict`

**Request Body:**
```json
{
  "location": "Kolkata",
  "destination": "Delhi",
  "day": "Monday",
  "time": "08:30",
  "emergency_mode": false,
  "start_coords": [22.5726, 88.3639],
  "end_coords": [28.6139, 77.2090]
}
```

**Response:**
```json
{
  "status": "success",
  "prediction": "high",
  "confidence": "95%",
  "best_time": "10:00 AM",
  "best_name": "Post-Rush Corridor",
  "analytics": {
    "active_vehicles": 22500,
    "flow_velocity": 15,
    "avg_latency": 12
  },
  "weather": {
    "condition": "few clouds",
    "temperature": 26,
    "visibility": 9,
    "impact": "medium"
  },
  "accident_risk": {
    "score": 42.3,
    "level": "medium"
  },
  "input": { "location": "...", "day": "...", "time": "..." }
}
```

### 2. Traffic Heatmap — `GET /api/heatmap`

```
GET /api/heatmap
```

```json
[
  { "location": "Kolkata",  "intensity": 60 },
  { "location": "Mumbai",   "intensity": 85 },
  { "location": "Delhi",    "intensity": 75 },
  { "location": "Bangalore","intensity": 55 },
  { "location": "Chennai",  "intensity": 45 }
]
```

### 3. Geocoding — `GET /api/geocode?q=<query>`

Enhanced 4-source geocoder with fuzzy matching, type-boosted ranking, and 5-minute TTL cache.

| Feature | Details |
|---|---|
| **Sources** | Local DB → Nominatim → Photon → Overpass API (parallel fetch) |
| **Fuzzy Engine** | RapidFuzz token_sort_ratio (threshold 70) + specificity boost |
| **Type Boosting** | village, hamlet, school, college, university, hospital, railway, airport, bus, tourism (+30) |
| **Admin Boost** | +15 per matching administrative hierarchy token |
| **Specificity** | +20 for 4-part addresses (village, district, state, country) |
| **First-Word Match** | +15 additional boost |

```
GET /api/geocode?q=JIS%20University%20Agarpara
```

```json
{
  "results": [
    {
      "display_name": "JIS University, Agarpara, West Bengal, India",
      "place_name": "JIS University",
      "lat": 22.625,
      "lon": 88.375,
      "type": "university",
      "source": "Local Database",
      "rank": 1,
      "score": 167.5,
      "place_id": "local_jis_university"
    }
  ],
  "total_results": 1,
  "best_match": { "..." : "..." }
}
```

### 4. Reverse Geocoding — `GET /api/reverse_geocode?lat=&lon=`

```
GET /api/reverse_geocode?lat=22.5726&lon=88.3639
```

```json
{
  "display_name": "Kolkata, West Bengal, India",
  "structured_address": {
    "village_locality": "",
    "area": "",
    "city": "Kolkata",
    "district": "Kolkata",
    "state": "West Bengal",
    "country": "India",
    "full_address": "Kolkata, West Bengal, India"
  },
  "lat": 22.5726,
  "lon": 88.3639
}
```

### 5. Route Calculation — `POST /api/route`

Full OSRM-backed routing with comprehensive pre-flight validation and coordinate verification.

**Request:**
```json
{
  "start_lat": 22.5726, "start_lon": 88.3639,
  "end_lat":   28.6139, "end_lon":   77.2090,
  "alternatives": true,
  "start_location": "Kolkata",
  "end_location": "Delhi"
}
```

**Validation Pipeline:**
1. ✅ Coordinates present (400 if missing)
2. ✅ Start != destination (400 if identical)
3. ✅ Within valid ranges (-90..90, -180..180)
4. ✅ Reverse-geocode verification (warning logged, does not block)
5. ✅ OSRM HTTP 200 + code=Ok
6. ✅ Routes have valid distance (>0) and duration (>0)

**Response:**
```json
{
  "routes": [
    {
      "distance": 1503.42,
      "duration": 1021.5,
      "geometry": { "type": "LineString", "coordinates": [...] },
      "legs": [ { "steps": [...], "distance": ..., "duration": ... } ],
      "weight": 61290.0
    }
  ],
  "waypoints": [ {...}, {...} ],
  "code": "Ok"
}
```

### 6. Weather Data — `GET /api/weather?lat=&lon=`

```
GET /api/weather?lat=22.5726&lon=88.3639
```

| Field | Description |
|---|---|
| `condition` | Human-readable weather (e.g., "light rain") |
| `temperature`, `feels_like` | Celsius |
| `humidity`, `pressure`, `wind_speed`, `wind_direction` | Standard metrics |
| `visibility` | Kilometers |
| `rain_condition` | `null` \| `"rain"` \| `"drizzle"` \| `"snow"` |
| `fog_detected`, `storm_detected` | Boolean threat flags |
| `cloud_coverage` | Percentage 0-100 |
| `sunrise`, `sunset` | ISO timestamps (local) |
| `severe_warning` | `null` or string advisory (e.g., "Dense fog warning...") |
| `rain_probability` | 0-100% estimate |
| `impact_level` | `unknown` \| `low` \| `medium` \| `high` \| `severe` |
| `source` | `"OpenWeatherMap API"` or fallback info |
| `verified` | Boolean — whether data is authoritative |

**Graceful degradation:** If the API key is missing or the service is unreachable, the endpoint returns a non-200 status with a descriptive `fallback` message rather than fabricated data.

---

## Technology Stack

### Backend
| Library | Version | Purpose |
|---|---|---|
| [Flask](https://flask.palletsprojects.com) | 2.3.3 | Web server / routing / Jinja2 templates |
| [Flask-CORS](https://flask-cors.readthedocs.io) | 4.0.0 | Cross-origin resource sharing (mobile/Capacitor) |
| [RapidFuzz](https://rapidfuzz.readthedocs.io) | ≥3.12.0 | High-performance fuzzy string matching |
| [Requests](https://requests.readthedocs.io) | 2.31.0 | HTTP client (Nominatim/OSRM/OWM APIs) |
| [python-dotenv](https://pypi.org/project/python-dotenv) | 1.0.0 | Environment variable management |
| *Pickle (stdlib)* | — | ML model deserialization (.pkl) |
| *concurrent.futures (stdlib)* | — | Parallel API source fetching |

### Frontend
| Library | Version | Purpose |
|---|---|---|
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Interactive OpenStreetMap renderer |
| [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/) | latest | Route visualization on map |
| [AOS (Animate On Scroll)](https://michalsnik.github.io/aos/) | 2.3.1 | Scroll-triggered micro-interactions |
| [Font Awesome](https://fontawesome.com) | 6.4.0 | Icon set (8,000+ icons) |

### Desktop (Electron)
| Component | Version | Purpose |
|---|---|---|
| [Electron](https://www.electronjs.org) | 27.0.0 | Chromium + Node.js runtime |
| [electron-builder](https://www.electron.build) | 24.6.4 | NSIS / AppImage / DMG packaging |
| Context Isolation | Enabled | Security model (no direct Node access) |
| Preload Bridge | IPC-only | Explicit whitelisted APIs |

### Mobile (Capacitor Android)
| Plugin | Version | Feature |
|---|---|---|
| `@capacitor/core` | 5.7.8 | Core runtime |
| `@capacitor/android` | 5.0.0 | Android platform layer |
| `@capacitor/cli` | 5.7.8 | Build/run CLI |
| `@capacitor/geolocation` | 5.0.0 | GPS location permission & query |
| `@capacitor/haptics` | 5.0.0 | Vibration feedback |
| `@capacitor/network` | 5.0.0 | Online/offline detection |
| `@capacitor/splash-screen` | 5.0.0 | 3-second immersive splash |
| `@capacitor/status-bar` | 5.0.0 | Dark status bar styling |
| `@capacitor/app` | 5.0.0 | App lifecycle callbacks |

---

## Prediction Engine

TrafficSense AI uses a **two-tier deterministic inference model** to guarantee identical input → identical output (no randomness, fully auditable).

### Tier 1: Rule-Based Weight Matrix

Core prediction uses a 3-element weighted probability vector:

```python
levels  = ["low", "medium", "high"]
weights = [w_low, w_medium, w_high]  # sum = 1.0
```

#### Time Window Biases
| Window | low | medium | high |
|---|---|---|---|
| Rush hour (weekday) | 0.1 | 0.3 | **0.6** |
| Rush hour (weekend) | 0.2 | 0.5 | 0.3 |
| Lunch (11-14 weekday) | 0.2 | 0.4 | 0.4 |
| Night (22-06) | **0.6** | 0.3 | 0.1 |
| Baseline | 0.3 | 0.4 | 0.3 |

#### Weather Modifiers (Multiplicative)
| Condition | Scalar (low, med, high) |
|---|---|
| Rain / Storm | × (0.7, 1.15, 1.3) |
| Fog / Vis < 5km | × (0.5, 1.2, 1.5) |
| Snow | × (0.3, 1.1, 1.8) |

#### Accident Risk Modifiers
| Risk | Scalar (low, med, high) |
|---|---|
| > 0.7 | × (0.4, 1.1, 1.6) |
| > 0.4 | × (0.8, 1.05, 1.2) |

#### Emergency Override
When `emergency_mode=true`, the engine hard-sets `weights = [0.4, 0.4, 0.2]` regardless of other inputs, prioritizing safe, conservative route selection for first responders.

### Tier 2: Derived Analytics

From the selected traffic level, downstream metrics are computed deterministically:

| Metric | Formula |
|---|---|
| Active Vehicles | `(8000 + 1000) × (1.0, 1.5, 2.5)` |
| Flow Velocity (km/h) | `max(15, 60 − 20 × multiplier)` |
| Avg Latency (min) | `max(2, 5 × multiplier)` |
| Confidence Index | `85 + ⌊max(weights) × 10⌋ + weather_bonus − risk_penalty` |
| Peak Efficiency Time | Rush → 10:00 AM or 8:00 PM; else +1-2h shift |

### Tier 3: Pickled Scikit-Learn Model

The `backend/model/` directory ships with pre-trained scikit-learn models:

```
traffic_model.pkl   — Serialized classifier (Random Forest / Gradient Boosting)
le_day.pkl          — LabelEncoder → {Monday..Sunday} → {0..6}
le_level.pkl        — LabelEncoder → {low, medium, high} → {0,1,2}
le_loc.pkl          — LabelEncoder → Top N locations → ordinal indices
```

These are loaded by `backend/train_model.py` during re-training or invoked as a consistency baseline against the rule engine.

---

## Build & Deployment

### Universal AppBuilder Script

```powershell
# Auto-checks Node.js + Python, then builds desktop + mobile
python build-all-apps.py
```

Build pipeline:
1. ✅ Dependency verification (Node.js, Python)
2. ✅ Icon generation + staging
3. ✅ Desktop: `npm install` → `electron-builder --<platform>`
4. ✅ Mobile: `npm install` → `cap sync android` → Android Studio project ready

### Output Artifacts

| Platform | Output Path | Format |
|---|---|---|
| Windows | `desktop/dist/` | NSIS Setup `.exe` |
| Linux | `desktop/dist/` | AppImage `.AppImage` |
| macOS | `desktop/dist/` | DMG `.dmg` |
| Android | `mobile/android/app/build/outputs/apk/` | Debug / Release APK |

### Production Deployment Checklist

- [ ] Set `OPENWEATHER_API_KEY` as environment variable
- [ ] Replace Flask dev server with Gunicorn + Nginx
- [ ] Add SSL via Let's Encrypt (Certbot)
- [ ] Configure firewall: allow TCP 5000 inbound (or reverse-proxy on 443)
- [ ] Set Flask `SECRET_KEY` for session signing
- [ ] Deploy behind CDN (Cloudflare) for static `frontend/static/` assets
- [ ] For Android APK: configure ProGuard (`proguard-rules.pro`) + signing key
- [ ] For Electron: add code-signing certificate in electron-builder config

---

## License

MIT License — Free and open source. See `LICENSE` file (if present) or use in accordance with the MIT terms for commercial and non-commercial projects.

---

<div align="center">

**Crafted with precision for Smart City command centers, fleet operators, and first responders.**

*TrafficSense AI — Predict. Route. Move.*

</div>
