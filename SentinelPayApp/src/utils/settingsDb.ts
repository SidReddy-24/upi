/**
 * Settings Database — AsyncStorage for user preferences
 * 
 * Stores:
 * - Transaction hold configuration
 * - Guardian settings
 * - Notification preferences
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'sentinelpay_settings';

export interface UserSettings {
  // Transaction Hold Period
  holdEnabled: boolean;
  holdDuration: number; // seconds (10-30)
  holdThresholdAmount: number; // rupees
  
  // Guardian/Family Guard
  guardianEnabled: boolean;
  guardianThresholdAmount: number;
  
  // Notifications
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  holdEnabled: false,
  holdDuration: 15, // 15 seconds default
  holdThresholdAmount: 5000, // Hold transactions above ₹5,000
  
  guardianEnabled: false,
  guardianThresholdAmount: 10000, // Guardian approval for > ₹10,000
  
  smsNotificationsEnabled: true,
  pushNotificationsEnabled: true,
};

export async function getSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('[SettingsDB] getSettings error:', e);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<void> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[SettingsDB] updateSettings error:', e);
    throw e;
  }
}

export async function resetSettings(): Promise<void> {
  await AsyncStorage.removeItem(SETTINGS_KEY);
}
