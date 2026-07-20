/**
 * useDeviceFingerprint — Phase 7.2
 *
 * Generates a stable device fingerprint using only React Native's Platform API.
 * No extra native dependency needed — zero rebuild required.
 *
 * Signals collected:
 *  - device_id      : stable UUID stored in AsyncStorage (persists across restarts)
 *  - os_type        : 'ANDROID' | 'IOS'
 *  - os_version     : Platform.Version (Android API level or iOS string)
 *  - is_emulator    : heuristic from Platform.constants (Brand==='google' + Model contains 'sdk')
 *  - is_rooted      : false (root detection requires a native module — deferred)
 *  - app_version    : '1.0.0'
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceInfo } from '../types';

const DEVICE_ID_KEY = 'sentinelpay_device_id';
const APP_VERSION = '1.0.0';

/** Simple UUID v4 generator (no external dep) */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Heuristic emulator detection from Platform.constants (Android only) */
function detectEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const c = Platform.constants as unknown as Record<string, string>;
    const brand = (c.Brand ?? c.brand ?? '').toLowerCase();
    const model = (c.Model ?? c.model ?? '').toLowerCase();
    const fingerprint = (c.Fingerprint ?? c.fingerprint ?? '').toLowerCase();
    return (
      brand === 'google' ||
      brand === 'generic' ||
      model.includes('sdk') ||
      model.includes('emulator') ||
      fingerprint.includes('generic') ||
      fingerprint.includes('emulator')
    );
  } catch {
    return false;
  }
}

/** Returns a stable device_id, creating one on first run */
async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `SP_${Platform.OS.toUpperCase()}_${uuidv4()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export interface DeviceFingerprintResult {
  deviceInfo: DeviceInfo;
  ready: boolean;
}

export function useDeviceFingerprint(): DeviceFingerprintResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    device_id: 'DEV_SP_PENDING',
    os_type: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    os_version: String(Platform.Version),
    is_rooted: false,
    is_emulator: detectEmulator(),
    app_version: APP_VERSION,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOrCreateDeviceId().then(device_id => {
      if (!mounted) return;
      setDeviceInfo({
        device_id,
        os_type: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        os_version: String(Platform.Version),
        is_rooted: false,
        is_emulator: detectEmulator(),
        app_version: APP_VERSION,
      });
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  return { deviceInfo, ready };
}
