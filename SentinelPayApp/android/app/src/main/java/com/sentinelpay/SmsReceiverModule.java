package com.sentinelpay;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import javax.annotation.Nullable;

/**
 * SmsReceiverModule — Java native bridge for SMS reception.
 *
 * Registers a BroadcastReceiver for incoming SMS messages and emits
 * each message to React Native via DeviceEventEmitter.
 *
 * JS usage:
 *   import { NativeModules, NativeEventEmitter } from 'react-native';
 *   const emitter = new NativeEventEmitter(NativeModules.SmsReceiverModule);
 *   const sub = emitter.addListener('onSmsReceived', (data) => { ... });
 *   NativeModules.SmsReceiverModule.startListening();
 */
public class SmsReceiverModule extends ReactContextBaseJavaModule {

    private static final String TAG = "SmsReceiverModule";
    private static final String MODULE_NAME = "SmsReceiverModule";
    private static final String EVENT_SMS_RECEIVED = "onSmsReceived";

    private final ReactApplicationContext reactContext;
    private BroadcastReceiver smsReceiver;
    private boolean isListening = false;

    public SmsReceiverModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Start listening for incoming SMS messages.
     * Call this from JS once permissions are granted.
     */
    @ReactMethod
    public void startListening() {
        if (isListening) return;

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
                    Bundle bundle = intent.getExtras();
                    if (bundle == null) return;

                    Object[] pdus = (Object[]) bundle.get("pdus");
                    String format = bundle.getString("format");
                    if (pdus == null) return;

                    for (Object pdu : pdus) {
                        SmsMessage smsMessage;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                        } else {
                            smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                        }
                        if (smsMessage == null) continue;

                        String sender = smsMessage.getDisplayOriginatingAddress();
                        String body   = smsMessage.getMessageBody();
                        long   timestamp = smsMessage.getTimestampMillis();

                        WritableMap params = Arguments.createMap();
                        params.putString("sender", sender != null ? sender : "");
                        params.putString("body", body != null ? body : "");
                        params.putDouble("timestamp", timestamp);

                        Log.d(TAG, "SMS received from: " + sender);
                        emitEvent(EVENT_SMS_RECEIVED, params);
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
        reactContext.registerReceiver(smsReceiver, filter);
        isListening = true;
        Log.d(TAG, "SMS listener started");
    }

    /**
     * Stop listening for SMS messages and unregister the receiver.
     */
    @ReactMethod
    public void stopListening() {
        if (!isListening || smsReceiver == null) return;
        try {
            reactContext.unregisterReceiver(smsReceiver);
        } catch (Exception e) {
            Log.w(TAG, "Error unregistering SMS receiver: " + e.getMessage());
        }
        smsReceiver = null;
        isListening = false;
        Log.d(TAG, "SMS listener stopped");
    }

    private void emitEvent(String eventName, @Nullable WritableMap params) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @Override
    public void invalidate() {
        stopListening();
        super.invalidate();
    }
}
