# TrafficSense AI - Android Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Steps](#detailed-steps)
4. [API Configuration](#api-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Make sure you have these installed:
- [Node.js & npm](https://nodejs.org/) (v16 or higher)
- [Android Studio](https://developer.android.com/studio) (with Android SDK)
- [Java JDK 11 or higher](https://adoptium.net/)

---

## Quick Start

From the `mobile` directory:

```bash
# 1. Install dependencies (already done)
npm install

# 2. Sync web assets to Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

Then run the app from Android Studio!

---

## Detailed Steps

### Step 1: Start the Backend Server

First, make sure your Flask backend is running!

Open a new terminal and from the project root directory:

```bash
cd "d:\traffic sense ai"
cd backend

# Install Python dependencies if you haven't already
pip install -r ../requirements.txt

# Start the server
python app.py
```

The server will start on `http://localhost:5000`

### Step 2: Sync and Open Android Studio

From the `mobile` directory:

```bash
cd "d:\traffic sense ai\mobile"

# Sync latest web assets (run this whenever you change frontend code!)
npx cap sync android

# Open the project in Android Studio
npx cap open android
```

### Step 3: Run in Android Studio

1. Android Studio will open and sync Gradle (wait for this to finish)
2. Select an emulator or connect a physical Android device
3. Click the ▶️ Run button

---

## API Configuration

The API service (`api.js`) automatically switches URLs based on environment:

| Environment | Base URL |
|-------------|----------|
| Android Emulator | `http://10.0.2.2:5000` (special IP for host machine access) |
| Local Browser | `http://localhost:5000` |
| Production | `https://traffic-sense-ai-vd45.onrender.com` |

### How to Verify

Open Chrome DevTools in Android Studio's emulator (chrome://inspect) and check the console - you'll see which URL is being used.

### For Production Deployment

To switch to production mode, modify `api.js` or just ensure you're not running locally!

---

## Troubleshooting

### Problem: Can't Connect to Backend from Emulator

1. Make sure your Flask server is running on `0.0.0.0` not just `localhost`
   - Check `app.py` has `app.run(host='0.0.0.0', port=5000)`
2. Check Windows Firewall allows incoming connections on port 5000
3. Verify in emulator browser that `http://10.0.2.2:5000` loads

### Problem: Gradle Sync Failed

1. Make sure you have correct SDK versions installed in Android Studio
2. Check `android/build.gradle` and `android/app/build.gradle` for correct settings

### Problem: Web Assets Not Updating

Always run `npx cap sync android` after changing any files in `public/` directory!

---

## Project Structure

```
mobile/
├── public/                    # Your web app files (Capacitor serves these)
│   ├── index.html            # Entry point
│   └── static/
│       ├── css/
│       ├── js/
│       │   ├── api.js        # Centralized API service (IMPORTANT!)
│       │   └── main.js       # Main app logic
│       └── ...
├── android/                   # Auto-generated Android project
├── capacitor.config.js       # Capacitor configuration
└── package.json
```

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npx cap sync android` | Copy web assets to Android project |
| `npx cap open android` | Open project in Android Studio |
| `npx cap run android` | Run directly on connected device/emulator |

---

## Next Steps

1. Customize app icons: See [Capacitor Icons Guide](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
2. Add push notifications
3. Test on real devices
4. Build release APK/AAB for Google Play Store
