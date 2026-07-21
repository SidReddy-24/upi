# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep TensorFlow Lite classes
-keep class org.tensorflow.lite.** { *; }
-keep class org.tensorflow.lite.task.** { *; }
-keep class org.tensorflow.lite.support.** { *; }

# Keep React Native modules
-keep class com.sentinelpay.** { *; }
-keep class com.facebook.react.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}
