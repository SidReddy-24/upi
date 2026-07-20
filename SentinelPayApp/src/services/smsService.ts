/**
 * smsService.ts — SMS intelligence layer
 *
 * Bridges the Java SmsReceiverModule, classifies messages,
 * detects OTPs, and persists state for the fraud scoring pipeline.
 *
 * Usage:
 *   import { startSmsListener, stopSmsListener, checkOtpRisk } from './smsService';
 */
import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { SmsReceiverModule } = NativeModules;

// ─── AsyncStorage keys ─────────────────────────────────────────────────────────
const KEY_LAST_OTP_AT    = 'sentinelpay_last_otp_at';
const KEY_LAST_SMS_CLASS = 'sentinelpay_last_sms_class';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type SmsClass = 'OTP' | 'SCAM' | 'PHISHING' | 'BANKING' | 'LEGIT' | 'UNKNOWN';

export interface SmsEvent {
  sender: string;
  body: string;
  timestamp: number;
}

export interface SmsAnalysis {
  classification: SmsClass;
  isOtp: boolean;
  otpCode: string | null;
  riskFlag: boolean;   // true if SCAM or PHISHING
  rawEvent: SmsEvent;
}

// ─── OTP detection regex ───────────────────────────────────────────────────────
// Matches 4–8 digit codes, common OTP patterns in Indian banking SMS
const OTP_PATTERNS = [
  /\b(\d{4,8})\b.*(?:OTP|otp|one.?time|passcode|pin|code)/i,
  /(?:OTP|otp|one.?time|passcode|pin|code).*\b(\d{4,8})\b/i,
  /\b(\d{6})\b/,   // bare 6-digit fallback (most Indian bank OTPs are 6 digits)
];

// ─── Rule-based SMS classification (no TFLite yet) ────────────────────────────
const SCAM_KEYWORDS = [
  'won', 'winner', 'lottery', 'prize', 'claim now', 'click here', 'free gift',
  'account suspended', 'verify immediately', 'urgent action', 'blocked',
  'KYC expired', 'update KYC', 'your account will be', 'refund pending',
];

const PHISHING_KEYWORDS = [
  'bit.ly', 'tinyurl', 'http://', 'login now', 'verify your account',
  'update your details', 'enter your pin', 'confirm password',
];

const BANKING_SENDERS = [
  'HDFCBK', 'ICICIBK', 'AXISBK', 'SBICRD', 'KOTAKB', 'PAYTMB',
  'YESBNK', 'INDBNK', 'BOIIND', 'UNIONB', 'VM-ICICI', 'AD-HDFC',
];

function classifySms(event: SmsEvent): SmsClass {
  const body   = event.body.toLowerCase();
  const sender = (event.sender || '').toUpperCase();

  // OTP — check first, most common
  if (OTP_PATTERNS.some(p => p.test(event.body))) return 'OTP';

  // Phishing — link-based
  if (PHISHING_KEYWORDS.some(k => body.includes(k.toLowerCase()))) return 'PHISHING';

  // Scam — social engineering
  if (SCAM_KEYWORDS.some(k => body.includes(k.toLowerCase()))) return 'SCAM';

  // Known banking sender IDs
  if (BANKING_SENDERS.some(s => sender.includes(s))) return 'BANKING';

  return 'LEGIT';
}

function extractOtp(body: string): string | null {
  for (const pattern of OTP_PATTERNS) {
    const match = body.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return null;
}

// ─── Subscription handle ───────────────────────────────────────────────────────
let subscription: ReturnType<NativeEventEmitter['addListener']> | null = null;
let emitter: NativeEventEmitter | null = null;

// External callback so screens can react to SMS events
let onSmsCallback: ((analysis: SmsAnalysis) => void) | null = null;

export function setOnSmsReceived(cb: (analysis: SmsAnalysis) => void) {
  onSmsCallback = cb;
}

// ─── Permission request ────────────────────────────────────────────────────────
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      granted[PermissionsAndroid.PERMISSIONS.READ_SMS]    === PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

// ─── Start / stop ──────────────────────────────────────────────────────────────
export async function startSmsListener(): Promise<void> {
  if (!SmsReceiverModule) {
    console.warn('[SMS] SmsReceiverModule not available');
    return;
  }
  if (subscription) return; // already running

  const granted = await requestSmsPermission();
  if (!granted) {
    console.warn('[SMS] Permission denied');
    return;
  }

  emitter = new NativeEventEmitter(SmsReceiverModule);
  subscription = emitter.addListener('onSmsReceived', async (event: SmsEvent) => {
    const classification = classifySms(event);
    const isOtp = classification === 'OTP';
    const otpCode = isOtp ? extractOtp(event.body) : null;
    const riskFlag = classification === 'SCAM' || classification === 'PHISHING';

    // Persist OTP timestamp for fraud scoring
    if (isOtp) {
      await AsyncStorage.setItem(KEY_LAST_OTP_AT, String(Date.now()));
      console.log('[SMS] OTP detected, timestamp saved');
    }

    // Persist last classification
    await AsyncStorage.setItem(KEY_LAST_SMS_CLASS, classification);

    const analysis: SmsAnalysis = {
      classification,
      isOtp,
      otpCode,
      riskFlag,
      rawEvent: event,
    };

    console.log(`[SMS] Classified: ${classification} from ${event.sender}`);
    if (onSmsCallback) onSmsCallback(analysis);
  });

  SmsReceiverModule.startListening();
  console.log('[SMS] Listener started');
}

export function stopSmsListener(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  if (SmsReceiverModule) {
    SmsReceiverModule.stopListening();
  }
  console.log('[SMS] Listener stopped');
}

// ─── OTP risk check (used by SendMoneyScreen) ─────────────────────────────────
const OTP_RISK_WINDOW_MS = 60 * 1000; // 60 seconds

export async function checkOtpRisk(): Promise<{
  otpInLast60s: boolean;
  secondsAgo: number | null;
}> {
  const raw = await AsyncStorage.getItem(KEY_LAST_OTP_AT);
  if (!raw) return { otpInLast60s: false, secondsAgo: null };

  const lastOtpAt = parseInt(raw, 10);
  const elapsed = Date.now() - lastOtpAt;
  const otpInLast60s = elapsed < OTP_RISK_WINDOW_MS;
  return {
    otpInLast60s,
    secondsAgo: Math.floor(elapsed / 1000),
  };
}
