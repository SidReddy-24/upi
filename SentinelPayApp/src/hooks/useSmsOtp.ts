/**
 * useSmsOtp — React hook for SMS OTP detection (Phase 4)
 *
 * How it works:
 *  1. Requests READ_SMS + RECEIVE_SMS runtime permissions
 *  2. Calls NativeModules.SmsReceiverModule.startListening() so the
 *     Java BroadcastReceiver starts emitting events
 *  3. Listens for 'onSmsReceived' events via NativeEventEmitter
 *  4. Runs OTP regex on each incoming body
 *  5. If OTP found → stores timestamp in AsyncStorage key
 *     'sentinelpay_last_otp_at' and sets otpInLast60s = true
 *
 * otpInLast60s resets automatically when 60 seconds have elapsed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ASYNC_KEY_OTP_AT = 'sentinelpay_last_otp_at';
const OTP_WINDOW_MS    = 60_000; // 60 seconds
const OTP_REGEX        = /\b\d{4,8}\b/;

export interface UseSmsOtpResult {
  otpInLast60s: boolean;
  permissionGranted: boolean;
}

export function useSmsOtp(): UseSmsOtpResult {
  const [otpInLast60s, setOtpInLast60s]         = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore state on mount (e.g. screen re-mount) ──────────────────────────
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(ASYNC_KEY_OTP_AT);
      if (stored) {
        const elapsed = Date.now() - parseInt(stored, 10);
        if (elapsed < OTP_WINDOW_MS) {
          setOtpInLast60s(true);
          // schedule auto-reset for remaining window
          timerRef.current = setTimeout(
            () => setOtpInLast60s(false),
            OTP_WINDOW_MS - elapsed,
          );
        }
      }
    })();
  }, []);

  // ── Cleanup timer on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const markOtpReceived = useCallback(async () => {
    const now = Date.now();
    await AsyncStorage.setItem(ASYNC_KEY_OTP_AT, String(now));
    setOtpInLast60s(true);

    // Clear any existing timer, start a new 60s countdown
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOtpInLast60s(false), OTP_WINDOW_MS);
  }, []);

  // ── Request permissions + start native listener ─────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return; // SMS only on Android

    const SmsModule = NativeModules.SmsReceiverModule;
    if (!SmsModule) {
      console.warn('[useSmsOtp] SmsReceiverModule not found — native build required');
      return;
    }

    let emitter: NativeEventEmitter;
    let subscription: ReturnType<NativeEventEmitter['addListener']>;

    (async () => {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);

        const bothGranted =
          granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
            PermissionsAndroid.RESULTS.GRANTED;

        setPermissionGranted(bothGranted);

        if (!bothGranted) {
          console.warn('[useSmsOtp] SMS permissions denied');
          return;
        }

        SmsModule.startListening();

        emitter = new NativeEventEmitter(SmsModule);
        subscription = emitter.addListener(
          'onSmsReceived',
          (data: { sender: string; body: string; timestamp: number }) => {
            console.log('[useSmsOtp] SMS from:', data.sender);
            if (OTP_REGEX.test(data.body)) {
              console.log('[useSmsOtp] OTP detected in SMS!');
              markOtpReceived();
            }
          },
        );
      } catch (err) {
        console.error('[useSmsOtp] Error setting up SMS listener:', err);
      }
    })();

    return () => {
      try {
        SmsModule?.stopListening?.();
        subscription?.remove?.();
      } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { otpInLast60s, permissionGranted };
}
