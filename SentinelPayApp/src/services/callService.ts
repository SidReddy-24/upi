/**
 * callService.ts — Phone call state detection bridge.
 *
 * Wraps the Java CallStateModule to provide:
 *  - Real-time call state events
 *  - One-shot active call check for SendMoney screen
 *  - Permission handling
 */
import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';

const { CallStateModule } = NativeModules;

export type CallState = 'IDLE' | 'RINGING' | 'OFFHOOK';

export interface CallStateEvent {
  state: CallState;
  isCallActive: boolean;
}

// ─── Permission ────────────────────────────────────────────────────────────────
export async function requestPhonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      {
        title: 'Phone Permission',
        message: 'SentinelPay needs phone access to detect if you are on a call during a payment.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ─── Subscription handle ───────────────────────────────────────────────────────
let subscription: ReturnType<NativeEventEmitter['addListener']> | null = null;
let onCallStateCallback: ((event: CallStateEvent) => void) | null = null;

export function setOnCallStateChanged(cb: (event: CallStateEvent) => void) {
  onCallStateCallback = cb;
}

// ─── Start / stop ──────────────────────────────────────────────────────────────
export async function startCallListener(): Promise<void> {
  if (!CallStateModule) {
    console.warn('[Call] CallStateModule not available');
    return;
  }
  if (subscription) return;

  const granted = await requestPhonePermission();
  if (!granted) {
    console.warn('[Call] Permission denied');
    return;
  }

  const emitter = new NativeEventEmitter(CallStateModule);
  subscription = emitter.addListener('onCallStateChanged', (event: CallStateEvent) => {
    console.log(`[Call] State: ${event.state}, active: ${event.isCallActive}`);
    if (onCallStateCallback) onCallStateCallback(event);
  });

  CallStateModule.startListening();
  console.log('[Call] Listener started');
}

export function stopCallListener(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  if (CallStateModule) {
    CallStateModule.stopListening();
  }
}

// ─── One-shot check (used in SendMoneyScreen before scoring) ──────────────────
export async function getCallState(): Promise<CallStateEvent> {
  if (!CallStateModule) return { state: 'IDLE', isCallActive: false };
  try {
    const result = await CallStateModule.isCallActive();
    return result as CallStateEvent;
  } catch {
    return { state: 'IDLE', isCallActive: false };
  }
}
