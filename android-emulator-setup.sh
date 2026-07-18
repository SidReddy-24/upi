#!/bin/bash
# Android Emulator Quick Setup Script
# Run this after installing Android Studio OR use Homebrew method below

echo "🔧 Android Emulator Setup Helper"
echo "================================"
echo ""

# Check if Android Studio is installed
if [ -d "/Applications/Android Studio.app" ]; then
    echo "✅ Android Studio found"
    ANDROID_HOME="$HOME/Library/Android/sdk"
else
    echo "❌ Android Studio not found"
    echo ""
    echo "Please install Android Studio first:"
    echo "https://developer.android.com/studio"
    echo ""
    echo "Or install via Homebrew:"
    echo "  brew install --cask android-studio"
    exit 1
fi

# Set Android environment variables
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

echo ""
echo "📦 Environment variables set:"
echo "ANDROID_HOME=$ANDROID_HOME"
echo ""

# Check if emulator exists
if [ -f "$ANDROID_HOME/emulator/emulator" ]; then
    echo "✅ Emulator binary found"
else
    echo "❌ Emulator not found. Open Android Studio and install SDK components."
    exit 1
fi

# List available AVDs
echo ""
echo "📱 Available Android Virtual Devices:"
$ANDROID_HOME/emulator/emulator -list-avds

if [ $? -ne 0 ] || [ -z "$($ANDROID_HOME/emulator/emulator -list-avds)" ]; then
    echo ""
    echo "⚠️  No emulators found. Create one:"
    echo ""
    echo "Option 1 - Via Android Studio:"
    echo "  1. Open Android Studio"
    echo "  2. Tools → Device Manager"
    echo "  3. Create Device → Pixel 6 → API 34"
    echo ""
    echo "Option 2 - Via Command Line:"
    echo "  avdmanager create avd -n Pixel_6_API_34 -k \"system-images;android-34;google_apis;arm64-v8a\" -d pixel_6"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start an emulator, run:"
echo "  emulator -avd <device-name>"
echo ""
echo "Or for React Native:"
echo "  cd SentinelPayApp"
echo "  npx react-native run-android"
