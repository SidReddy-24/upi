/**
 * useCallState — React hook for phone call detection (Phase 5)
 *
 * How it works:
 *  1. Requests READ_PHONE_STATE runtime permission
 *  2. Calls NativeModules.CallStateModule.startListening()
 *  3. Queries current state immediately via isCallActive()
 *  4. Subscribes to 'onCallStateChanged' events via NativeEventEmitter
 *  5. Returns { isCallActive, callState, permissionGranted }
 *
 * Usage in SendMoneyScreen:
 *   const { isCallActive } = useCallState();
 *   // pass isCallActive to /score payload + show warning banner
 */
import { useCallback, useEffect, useState } from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';

export type CallState = 'IDLE' | 'RINGING' | 'OFFHOOK' | 'UNKNOWN';

export interface UseCallStateResult {
  isCallActive: boolean;
  callState: CallState;
  permissionGranted: boolean;
}

export function useCallState(): UseCallStateResult {
  const [callState, setCallState]               = useState<CallState>('UNKNOWN');
  const [isCallActive, setIsCallActive]         = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const applyState = useCallback(
    (state: string, active: boolean) => {
      setCallState(state as CallState);
      setIsCallActive(active);
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const CallModule = NativeModules.CallStateModule;
    if (!CallModule) {
      console.warn('[useCallState] CallStateModule not found — native build required');
      return;
    }

    let emitter: NativeEventEmitter;
    let subscription: ReturnType<NativeEventEmitter['addListener']>;

    (async () => {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          {
            title: 'Phone State Permission',
            message:
              'SentinelPay needs this to detect if you are on a call while making a payment.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );

        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setPermissionGranted(granted);

        if (!granted) {
          console.warn('[useCallState] Phone state permission denied');
          setCallState('IDLE');
          return;
        }

        // Query current state immediately
        CallModule.isCallActive()
          .then((res: { isCallActive: boolean; state: string }) => {
            applyState(res.state, res.isCallActive);
          })
          .catch(() => applyState('IDLE', false));

        // Start ongoing listener
        CallModule.startListening();

        emitter = new NativeEventEmitter(CallModule);
        subscription = emitter.addListener(
          'onCallStateChanged',
          (data: { state: string; isCallActive: boolean }) => {
            console.log('[useCallState] State changed:', data.state);
            applyState(data.state, data.isCallActive);
          },
        );
      } catch (err) {
        console.error('[useCallState] Error setting up call listener:', err);
        applyState('IDLE', false);
      }
    })();

    return () => {
      try {
        CallModule?.stopListening?.();
        subscription?.remove?.();
      } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isCallActive, callState, permissionGranted };
}
