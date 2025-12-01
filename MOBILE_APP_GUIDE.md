# SMCF Mobile App Setup Guide

## 🚀 Getting the App on Your Phone

### Method 1: Direct Install via USB (Recommended for Testing)

1. **Enable Developer Options on Your Phone:**

   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - You'll see "You are now a developer!"

2. **Enable USB Debugging:**

   - Go to Settings → Developer Options
   - Enable "USB Debugging"
   - Enable "Install via USB"

3. **Connect Your Phone to Computer:**

   - Use a USB cable to connect your Android phone
   - When prompted on your phone, tap "Allow USB Debugging"

4. **Verify Connection:**

   ```bash
   adb devices
   ```

   You should see your device listed.

5. **Run the App:**

   ```bash
   cd /home/crash/Desktop/smcf/smcf
   npm run android
   ```

   This will:

   - Build the web app
   - Sync with Capacitor
   - Build the Android APK
   - Install and launch on your phone automatically

### Method 2: Build APK and Install Manually

1. **Build the Release APK:**

   ```bash
   cd /home/crash/Desktop/smcf/smcf
   npm run cap:build:android
   ```

2. **Find the APK:**
   The APK will be located at:

   ```
   /home/crash/Desktop/smcf/smcf/android/app/build/outputs/apk/release/app-release.apk
   ```

3. **Transfer to Your Phone:**

   - **Via USB:** Copy the APK file to your phone's storage
   - **Via Email:** Email the APK to yourself
   - **Via Cloud:** Upload to Google Drive/Dropbox
   - **Via ADB:**
     ```bash
     adb install android/app/build/outputs/apk/release/app-release.apk
     ```

4. **Install on Phone:**
   - Open the APK file on your phone
   - Tap "Install"
   - If prompted, enable "Install from Unknown Sources"

### Method 3: Wireless Debugging (No Cable Needed)

1. **Ensure phone and computer are on same WiFi**

2. **Enable Wireless Debugging on Phone:**

   - Settings → Developer Options → Wireless Debugging → ON

3. **Pair Device:**

   ```bash
   adb pair <IP>:<PORT>
   # Enter pairing code shown on phone
   ```

4. **Connect:**

   ```bash
   adb connect <IP>:<PORT>
   ```

5. **Run the app:**
   ```bash
   npm run android
   ```

## 🔧 Quick Commands

```bash
# Open Android Studio to build manually
npm run cap:open:android

# Build and run on connected device
npm run android

# Build release APK only
npm run cap:build:android

# Sync changes after updating web code
npm run cap:sync

# Check connected devices
adb devices
```

## 📱 Testing the App

Once installed, the app will:

- ✅ Connect to production backend: https://smcf-c99o.onrender.com
- ✅ Show native splash screen with SMCF logo
- ✅ Display mobile-optimized UI
- ✅ Show network status notifications
- ✅ Support offline detection
- ✅ Use native status bar styling

## 🛠️ Troubleshooting

### "adb: command not found"

Install Android SDK Platform Tools:

```bash
sudo apt install android-tools-adb android-tools-fastboot
```

### "Device unauthorized"

- Check your phone for USB debugging prompt
- Revoke USB debugging authorizations in Developer Options
- Reconnect and allow again

### "Gradle build failed"

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### App doesn't connect to backend

- Check that `.env.production` has correct API URL
- Rebuild: `npm run build:mobile && npx cap sync`
- Check phone internet connection

### Changes not showing in app

```bash
# Always run after code changes:
npm run cap:sync
```

## 📦 Building for Google Play Store

To build a signed release APK for Play Store:

1. **Generate Keystore:**

   ```bash
   keytool -genkey -v -keystore smcf-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias smcf
   ```

2. **Configure Signing:**
   Edit `android/app/build.gradle` and add signing config

3. **Build Signed APK:**

   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. **APK Location:**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

## 🔄 Update Workflow

When you make changes to the web app:

```bash
# 1. Make your code changes
# 2. Build for mobile
npm run build:mobile

# 3. Sync to native project
npx cap sync

# 4. Run on device
npm run android
```

## 🌐 Environment Variables

The app uses these environment variables from `.env.production`:

- `VITE_API_URL` - Backend API endpoint
- Automatically loaded during build

Current backend: **https://smcf-c99o.onrender.com**

## 📸 Features Enabled in Mobile App

- ✅ Native splash screen
- ✅ Status bar customization (dark theme)
- ✅ Network monitoring
- ✅ Offline detection with toast notifications
- ✅ Mobile-responsive layouts
- ✅ Touch-optimized buttons (44px minimum)
- ✅ Safe area handling for notches
- ✅ No overscroll bounce
- ✅ Native app behavior

## 🎯 App Details

- **App Name:** SMCF
- **Package ID:** com.smcf.app
- **Version:** 1.0.0
- **Platform:** Android 7.0+ (API 24+)
