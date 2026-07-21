#!/bin/bash
echo "🔨 Building SentinelPay APK..."

# Navigate to project directory
cd "$(dirname "$0")"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean
cd ..

# Build release APK
echo "📦 Building release APK (this may take a few minutes)..."
cd android
./gradlew assembleRelease

if [ $? -eq 0 ]; then
    # Copy to Desktop
    echo "📲 Copying APK to Desktop..."
    cp app/build/outputs/apk/release/app-release.apk ~/Desktop/SentinelPay-v1.0.apk
    
    # Get file size
    SIZE=$(du -h ~/Desktop/SentinelPay-v1.0.apk | cut -f1)
    
    echo ""
    echo "✅ Build complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📍 APK location: ~/Desktop/SentinelPay-v1.0.apk"
    echo "📊 Size: $SIZE"
    echo ""
    echo "To install on device:"
    echo "  adb install ~/Desktop/SentinelPay-v1.0.apk"
    echo ""
    echo "Or transfer manually:"
    echo "  1. Copy APK to phone's Downloads folder"
    echo "  2. Open file on phone and install"
else
    echo ""
    echo "❌ Build failed!"
    echo "Check the error messages above for details."
    exit 1
fi
