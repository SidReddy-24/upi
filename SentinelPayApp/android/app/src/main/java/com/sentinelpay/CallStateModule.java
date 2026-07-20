package com.sentinelpay;

import android.content.Context;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import javax.annotation.Nullable;

/**
 * CallStateModule — Java native bridge for phone call state detection.
 *
 * Listens for IDLE / RINGING / OFFHOOK (active call) states and emits
 * events to React Native. Used to flag payments made during an active call.
 *
 * JS usage:
 *   import { NativeModules, NativeEventEmitter } from 'react-native';
 *   const emitter = new NativeEventEmitter(NativeModules.CallStateModule);
 *   emitter.addListener('onCallStateChanged', ({ state, isCallActive }) => { ... });
 *   NativeModules.CallStateModule.startListening();
 *   NativeModules.CallStateModule.isCallActive(promise);
 */
public class CallStateModule extends ReactContextBaseJavaModule {

    private static final String TAG = "CallStateModule";
    private static final String MODULE_NAME = "CallStateModule";
    private static final String EVENT_CALL_STATE = "onCallStateChanged";

    // Call state constants exposed to JS
    private static final String STATE_IDLE    = "IDLE";
    private static final String STATE_RINGING = "RINGING";
    private static final String STATE_OFFHOOK = "OFFHOOK";

    private final ReactApplicationContext reactContext;
    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;
    private boolean isListening = false;
    private String currentCallState = STATE_IDLE;

    public CallStateModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Start listening to phone call state changes.
     * Must be called from JS after READ_PHONE_STATE permission is granted.
     */
    @ReactMethod
    public void startListening() {
        if (isListening) return;

        telephonyManager = (TelephonyManager)
            reactContext.getSystemService(Context.TELEPHONY_SERVICE);

        phoneStateListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String phoneNumber) {
                String newState;
                switch (state) {
                    case TelephonyManager.CALL_STATE_RINGING:
                        newState = STATE_RINGING;
                        break;
                    case TelephonyManager.CALL_STATE_OFFHOOK:
                        newState = STATE_OFFHOOK;
                        break;
                    default:
                        newState = STATE_IDLE;
                        break;
                }

                currentCallState = newState;
                Log.d(TAG, "Call state changed: " + newState);

                WritableMap params = Arguments.createMap();
                params.putString("state", newState);
                params.putBoolean("isCallActive", STATE_OFFHOOK.equals(newState));
                emitEvent(EVENT_CALL_STATE, params);
            }
        };

        telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
        isListening = true;
        Log.d(TAG, "Call state listener started");
    }

    /**
     * Stop listening to call state changes.
     */
    @ReactMethod
    public void stopListening() {
        if (!isListening || telephonyManager == null || phoneStateListener == null) return;
        telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
        phoneStateListener = null;
        isListening = false;
        Log.d(TAG, "Call state listener stopped");
    }

    /**
     * Synchronously check if a call is currently active.
     * Resolves a Promise with { isCallActive: boolean, state: string }
     */
    @ReactMethod
    public void isCallActive(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();
            result.putBoolean("isCallActive", STATE_OFFHOOK.equals(currentCallState));
            result.putString("state", currentCallState);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("CALL_STATE_ERROR", e.getMessage());
        }
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
