/**
 * smsDb.ts - Local SMS database using AsyncStorage
 * 
 * Stores SMS messages with fraud scores for the SMS Tracker feature.
 * All data is stored locally on-device (100% privacy-first).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SMS_STORAGE_KEY = 'sentinelpay_sms_messages';
const SMS_STATS_KEY = 'sentinelpay_sms_stats';
const SMS_SCANNER_STATE_KEY = 'sentinelpay_sms_scanner_state';

export interface SmsMessage {
  id: string; // Unique ID: sender + timestamp
  sender: string;
  body: string;
  timestamp: number;
  fraudScore: number; // 0.0 to 1.0
  classification: 'fraud' | 'suspicious' | 'genuine';
  userOverride?: 'safe' | 'fraud'; // User manual classification
  scannedAt: number; // When we processed it
}

export interface SmsStats {
  totalMessages: number;
  fraudCount: number;
  suspiciousCount: number;
  genuineCount: number;
  lastScanTimestamp: number;
}

export interface ScannerState {
  hasScannedHistorical: boolean;
  lastHistoricalScanTimestamp: number;
  totalHistoricalScanned: number;
}

/**
 * Generate unique message ID from sender and timestamp
 */
export function generateMessageId(sender: string, timestamp: number): string {
  return `${sender}_${timestamp}`;
}

/**
 * Classify message based on fraud score, sender ID, and body text
 */
export function classifyMessage(
  fraudScore: number,
  sender?: string,
  body?: string
): 'fraud' | 'suspicious' | 'genuine' {
  const text = (body || '').toLowerCase();
  const snd = (sender || '').toUpperCase();

  // 1. Phishing / Scam explicit keywords -> High Fraud
  const isScamLinkOrPhish =
    text.includes('bit.ly') ||
    text.includes('tinyurl') ||
    text.includes('claim prize') ||
    text.includes('won lottery') ||
    text.includes('account suspended') ||
    text.includes('update kyc now') ||
    text.includes('part time job') ||
    text.includes('telegram.me') ||
    text.includes('earn daily') ||
    text.includes('click here to verify');

  if (isScamLinkOrPhish) return 'fraud';

  // 2. Real Bank Transaction keywords / senders -> Genuine (Safe)
  const isBankKeywords =
    text.includes('debited') ||
    text.includes('credited') ||
    text.includes('transferred') ||
    text.includes('received') ||
    text.includes('available balance') ||
    text.includes('avbl bal') ||
    text.includes('a/c') ||
    text.includes('acct') ||
    text.includes('upi ref') ||
    text.includes('vpa') ||
    text.includes('spent on card') ||
    text.includes('atm withdrawal');

  const isBankSender =
    /^[A-Z]{2}-[A-Z0-9]{3,8}$/.test(snd) ||
    ['HDFC', 'ICICI', 'AXIS', 'SBI', 'KOTAK', 'PAYTM', 'YESBNK', 'INDBNK', 'BOI', 'UNION', 'FED', 'RBL', 'CANARA', 'PNB', 'IDFC', 'BOB'].some((b) => snd.includes(b));

  if ((isBankKeywords || isBankSender) && !text.includes('share pin') && !text.includes('share password')) {
    return 'genuine';
  }

  // 3. Fallback based on ML score
  if (fraudScore >= 0.7) return 'fraud';
  if (fraudScore >= 0.4) return 'suspicious';
  return 'genuine';
}

/**
 * Get all SMS messages from storage (strictly sorted newest first)
 */
export async function getAllMessages(): Promise<SmsMessage[]> {
  try {
    const data = await AsyncStorage.getItem(SMS_STORAGE_KEY);
    if (!data) return [];
    const list: SmsMessage[] = JSON.parse(data);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[smsDb] Error reading messages:', error);
    return [];
  }
}

/**
 * Get messages with pagination
 */
export async function getMessagesPaginated(
  offset: number = 0,
  limit: number = 50
): Promise<SmsMessage[]> {
  const all = await getAllMessages();
  return all.slice(offset, offset + limit);
}

/**
 * Get messages filtered by classification (sorted newest first)
 */
export async function getMessagesByClassification(
  classification: 'fraud' | 'suspicious' | 'genuine' | 'all'
): Promise<SmsMessage[]> {
  const all = await getAllMessages();
  if (classification === 'all') return all;
  return all.filter((msg) => msg.classification === classification);
}

/**
 * Get messages in a date range
 */
export async function getMessagesByDateRange(
  startTimestamp: number,
  endTimestamp: number
): Promise<SmsMessage[]> {
  const all = await getAllMessages();
  return all.filter(
    (msg) => msg.timestamp >= startTimestamp && msg.timestamp <= endTimestamp
  );
}

/**
 * Get a single message by ID
 */
export async function getMessageById(id: string): Promise<SmsMessage | null> {
  const all = await getAllMessages();
  return all.find((msg) => msg.id === id) || null;
}

/**
 * Store a single SMS message
 */
export async function storeMessage(message: SmsMessage): Promise<void> {
  try {
    const messages = await getAllMessages();
    
    // Check if message already exists
    const existingIndex = messages.findIndex((m) => m.id === message.id);
    
    if (existingIndex >= 0) {
      // Update existing message
      messages[existingIndex] = message;
    } else {
      // Add new message
      messages.unshift(message);
    }
    
    messages.sort((a, b) => b.timestamp - a.timestamp);
    await AsyncStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(messages));
    await updateStats();
  } catch (error) {
    console.error('[smsDb] Error storing message:', error);
    throw error;
  }
}

/**
 * Store multiple SMS messages in batch (sorted newest first)
 */
export async function storeMessagesBatch(messages: SmsMessage[]): Promise<void> {
  try {
    const existing = await getAllMessages();
    const existingIds = new Set(existing.map((m) => m.id));
    
    // Only add new messages
    const newMessages = messages.filter((m) => !existingIds.has(m.id));
    
    if (newMessages.length > 0) {
      const updated = [...existing, ...newMessages].sort((a, b) => b.timestamp - a.timestamp);
      await AsyncStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(updated));
      await updateStats();
    }
  } catch (error) {
    console.error('[smsDb] Error storing batch:', error);
    throw error;
  }
}

/**
 * Update a message (for user overrides)
 */
export async function updateMessage(
  id: string,
  updates: Partial<SmsMessage>
): Promise<void> {
  try {
    const messages = await getAllMessages();
    const index = messages.findIndex((m) => m.id === id);
    
    if (index >= 0) {
      messages[index] = { ...messages[index], ...updates };
      await AsyncStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(messages));
      await updateStats();
    }
  } catch (error) {
    console.error('[smsDb] Error updating message:', error);
    throw error;
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(id: string): Promise<void> {
  try {
    const messages = await getAllMessages();
    const filtered = messages.filter((m) => m.id !== id);
    await AsyncStorage.setItem(SMS_STORAGE_KEY, JSON.stringify(filtered));
    await updateStats();
  } catch (error) {
    console.error('[smsDb] Error deleting message:', error);
    throw error;
  }
}

/**
 * Clear all SMS messages
 */
export async function clearAllMessages(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SMS_STORAGE_KEY);
    await updateStats();
  } catch (error) {
    console.error('[smsDb] Error clearing messages:', error);
    throw error;
  }
}

/**
 * Get SMS statistics
 */
export async function getStats(): Promise<SmsStats> {
  try {
    const data = await AsyncStorage.getItem(SMS_STATS_KEY);
    if (!data) {
      return {
        totalMessages: 0,
        fraudCount: 0,
        suspiciousCount: 0,
        genuineCount: 0,
        lastScanTimestamp: 0,
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('[smsDb] Error reading stats:', error);
    return {
      totalMessages: 0,
      fraudCount: 0,
      suspiciousCount: 0,
      genuineCount: 0,
      lastScanTimestamp: 0,
    };
  }
}

/**
 * Update statistics (called automatically after message changes)
 */
async function updateStats(): Promise<void> {
  try {
    const messages = await getAllMessages();
    
    const stats: SmsStats = {
      totalMessages: messages.length,
      fraudCount: messages.filter((m) => m.classification === 'fraud').length,
      suspiciousCount: messages.filter((m) => m.classification === 'suspicious').length,
      genuineCount: messages.filter((m) => m.classification === 'genuine').length,
      lastScanTimestamp: Date.now(),
    };
    
    await AsyncStorage.setItem(SMS_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('[smsDb] Error updating stats:', error);
  }
}

/**
 * Get fraud messages in last N hours
 */
export async function getFraudMessagesInLastHours(hours: number): Promise<SmsMessage[]> {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const all = await getAllMessages();
  return all.filter(
    (msg) => msg.classification === 'fraud' && msg.timestamp >= cutoff
  );
}

/**
 * Get highest fraud score in last N hours
 */
export async function getHighestFraudScoreInLastHours(hours: number): Promise<number> {
  const fraudMessages = await getFraudMessagesInLastHours(hours);
  if (fraudMessages.length === 0) return 0;
  return Math.max(...fraudMessages.map((m) => m.fraudScore));
}

/**
 * Scanner state management
 */
export async function getScannerState(): Promise<ScannerState> {
  try {
    const data = await AsyncStorage.getItem(SMS_SCANNER_STATE_KEY);
    if (!data) {
      return {
        hasScannedHistorical: false,
        lastHistoricalScanTimestamp: 0,
        totalHistoricalScanned: 0,
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('[smsDb] Error reading scanner state:', error);
    return {
      hasScannedHistorical: false,
      lastHistoricalScanTimestamp: 0,
      totalHistoricalScanned: 0,
    };
  }
}

export async function updateScannerState(state: Partial<ScannerState>): Promise<void> {
  try {
    const current = await getScannerState();
    const updated = { ...current, ...state };
    await AsyncStorage.setItem(SMS_SCANNER_STATE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[smsDb] Error updating scanner state:', error);
    throw error;
  }
}

export async function resetScannerState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SMS_SCANNER_STATE_KEY);
  } catch (error) {
    console.error('[smsDb] Error resetting scanner state:', error);
    throw error;
  }
}
