# Installing SentinelPay (Demo APK)

This guide explains how to install the `app-release.apk` on a physical Android device without using the Google Play Store (sideloading).

## Prerequisites
- An Android device running Android 8.0 (Oreo) or higher.
- A USB cable, or a way to transfer the APK to your phone (e.g., Google Drive, email, or a messaging app).

## Step 1: Enable "Install Unknown Apps"
Before installing an app from outside the Play Store, you must grant permission to the app you're using to open the APK file (e.g., Chrome, Files by Google, or your File Manager).

1. Open **Settings** on your Android device.
2. Tap **Apps** (or **Apps & notifications**).
3. Tap **Special app access**.
4. Tap **Install unknown apps**.
5. Select the app you'll use to open the APK (e.g., Chrome, Files, or Drive) and toggle **Allow from this source** to ON.

## Step 2: Transfer the APK
If you built the APK on your laptop, you need to move it to your phone. 
The APK file is located at:
`/SentinelPayApp/android/app/build/outputs/apk/release/app-release.apk`

**Options for transfer:**
- **USB:** Connect your phone to your computer, select "File Transfer" on the phone, and copy the APK to your phone's `Downloads` folder.
- **Cloud:** Upload the APK to Google Drive, then open the Drive app on your phone.
- **Direct Send:** Send it to yourself via Telegram, Slack, or email.

## Step 3: Install the APK
1. Open your File Manager or the app you used to download the APK.
2. Tap on `app-release.apk`.
3. A prompt will appear asking "Do you want to install this application?". Tap **Install**.
4. If Google Play Protect warns you that the app is unrecognized, tap **More details** (or the small arrow) and select **Install anyway**. This happens because the demo APK is self-signed and not published on the Play Store.

## Step 4: Open and Test
1. Once installed, tap **Open**.
2. You will see the SentinelPay Onboarding screen.
3. **IMPORTANT:** The first time you use the Send Money feature, Android will ask you for permissions (SMS, Phone State, and Camera). Please grant these permissions so the FraudShield AI can accurately score your transactions based on real-time device signals.

## Troubleshooting
- **"App not installed" error:** This usually means you already have a version of SentinelPay installed with a different signature (e.g., a debug build). Uninstall the existing app first, then try again.
- **Can't reach API (Network Error):** Ensure your backend is running and the `API_BASE_URL` in `fraudShieldApi.ts` is pointed to your laptop's local network IP (e.g., `192.168.1.5:8000`) rather than `10.0.2.2` if you are using a real device over WiFi.
