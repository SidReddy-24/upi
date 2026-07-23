package com.sentinelpay;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

/**
 * SmsReaderModule — Java native bridge for reading SMS history.
 *
 * Reads all existing SMS messages from the device content provider.
 * Requires READ_SMS permission.
 *
 * JS usage:
 *   import { NativeModules } from 'react-native';
 *   const messages = await NativeModules.SmsReaderModule.readAllSms();
 */
public class SmsReaderModule extends ReactContextBaseJavaModule {

    private static final String TAG = "SmsReaderModule";
    private static final String MODULE_NAME = "SmsReaderModule";

    private final ReactApplicationContext reactContext;
    private SmsClassifier smsClassifier;

    public SmsReaderModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.smsClassifier = new SmsClassifier(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Read all SMS messages from device inbox
     * Returns array of {sender, body, timestamp, fraudScore}
     */
    @ReactMethod
    public void readAllSms(Promise promise) {
        try {
            Log.d(TAG, "Reading all SMS messages...");
            
            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.parse("content://sms/inbox");
            
            String[] projection = new String[] { "address", "body", "date" };
            Cursor cursor = contentResolver.query(
                uri,
                projection,
                null,
                null,
                "date DESC" // Newest first
            );

            if (cursor == null) {
                promise.reject("SMS_READ_ERROR", "Failed to query SMS inbox");
                return;
            }

            WritableArray messages = Arguments.createArray();
            int count = 0;

            while (cursor.moveToNext()) {
                try {
                    String sender = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                    long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow("date"));

                    // Classify SMS using TFLite model
                    float fraudScore = 0.0f;
                    if (smsClassifier != null && body != null) {
                        fraudScore = smsClassifier.classify(body);
                    }

                    WritableMap message = Arguments.createMap();
                    message.putString("sender", sender != null ? sender : "Unknown");
                    message.putString("body", body != null ? body : "");
                    message.putDouble("timestamp", timestamp);
                    message.putDouble("fraudScore", fraudScore);

                    messages.pushMap(message);
                    count++;

                } catch (Exception e) {
                    Log.w(TAG, "Error processing SMS: " + e.getMessage());
                    // Continue with next message
                }
            }

            cursor.close();
            
            Log.d(TAG, "Read " + count + " SMS messages");
            promise.resolve(messages);

        } catch (SecurityException e) {
            Log.e(TAG, "Permission denied: " + e.getMessage());
            promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted");
        } catch (Exception e) {
            Log.e(TAG, "Error reading SMS: " + e.getMessage());
            promise.reject("SMS_READ_ERROR", e.getMessage());
        }
    }

    /**
     * Read SMS messages in batches (for large datasets)
     * @param offset Starting index
     * @param limit Number of messages to read
     */
    @ReactMethod
    public void readSmsBatch(int offset, int limit, Promise promise) {
        try {
            Log.d(TAG, "Reading SMS batch: offset=" + offset + ", limit=" + limit);
            
            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.parse("content://sms/inbox");
            
            String[] projection = new String[] { "address", "body", "date" };
            Cursor cursor = contentResolver.query(
                uri,
                projection,
                null,
                null,
                "date DESC LIMIT " + limit + " OFFSET " + offset
            );

            if (cursor == null) {
                promise.reject("SMS_READ_ERROR", "Failed to query SMS inbox");
                return;
            }

            WritableArray messages = Arguments.createArray();
            int count = 0;

            while (cursor.moveToNext()) {
                try {
                    String sender = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                    long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow("date"));

                    // Classify SMS using TFLite model
                    float fraudScore = 0.0f;
                    if (smsClassifier != null && body != null) {
                        fraudScore = smsClassifier.classify(body);
                    }

                    WritableMap message = Arguments.createMap();
                    message.putString("sender", sender != null ? sender : "Unknown");
                    message.putString("body", body != null ? body : "");
                    message.putDouble("timestamp", timestamp);
                    message.putDouble("fraudScore", fraudScore);

                    messages.pushMap(message);
                    count++;

                } catch (Exception e) {
                    Log.w(TAG, "Error processing SMS: " + e.getMessage());
                }
            }

            cursor.close();
            
            Log.d(TAG, "Read batch of " + count + " SMS messages");
            
            WritableMap result = Arguments.createMap();
            result.putArray("messages", messages);
            result.putInt("count", count);
            result.putBoolean("hasMore", count == limit);
            
            promise.resolve(result);

        } catch (SecurityException e) {
            Log.e(TAG, "Permission denied: " + e.getMessage());
            promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted");
        } catch (Exception e) {
            Log.e(TAG, "Error reading SMS batch: " + e.getMessage());
            promise.reject("SMS_READ_ERROR", e.getMessage());
        }
    }

    /**
     * Get total SMS count
     */
    @ReactMethod
    public void getSmsCount(Promise promise) {
        try {
            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.parse("content://sms/inbox");
            
            Cursor cursor = contentResolver.query(
                uri,
                new String[] { "_id" },
                null,
                null,
                null
            );

            if (cursor == null) {
                promise.resolve(0);
                return;
            }

            int count = cursor.getCount();
            cursor.close();
            
            Log.d(TAG, "Total SMS count: " + count);
            promise.resolve(count);

        } catch (Exception e) {
            Log.e(TAG, "Error getting SMS count: " + e.getMessage());
            promise.resolve(0);
        }
    }

    @Override
    public void invalidate() {
        if (smsClassifier != null) {
            smsClassifier.close();
        }
        super.invalidate();
    }
}
