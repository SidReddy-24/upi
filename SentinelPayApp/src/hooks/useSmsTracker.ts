/**
 * useSmsTracker.ts - React Native hook for SMS tracking
 * 
 * Manages permissions, historical scanning, and real-time monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import {
  SmsMessage,
  generateMessageId,
  classifyMessage,
  storeMessage,
  storeMessagesBatch,
  getScannerState,
  updateScannerState,
  getStats,
} from '../utils/smsDb';

const { SmsReaderModule, SmsReceiverModule } = NativeModules;

export interface SmsTrackerState {
  // Permissions
  hasReadPermission: boolean;
  hasReceivePermission: boolean;
  permissionsGranted: boolean;
  
  // Scanner state
  isScanning: boolean;
  scanProgress: number; // 0-100
  totalScanned: number;
  hasScannedHistorical: boolean;
  
  // Real-time monitoring
  isMonitoring: boolean;
  
  // Stats
  totalMessages: number;
  fraudCount: number;
  suspiciousCount: number;
  genuineCount: number;
  
  // Errors
  error: string | null;
}

export function useSmsTracker() {
  const [state, setState] = useState<SmsTrackerState>({
    hasReadPermission: false,
    hasReceivePermission: false,
    permissionsGranted: false,
    isScanning: false,
    scanProgress: 0,
    totalScanned: 0,
    hasScannedHistorical: false,
    isMonitoring: false,
    totalMessages: 0,
    fraudCount: 0,
    suspiciousCount: 0,
    genuineCount: 0,
    error: null,
  });

  /**
   * Request READ_SMS permission
   */
  const requestReadPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS History Access',
          message:
            'SentinelPay needs access to read your SMS messages to detect fraud and protect you from scams. All processing is done on your device and messages are never uploaded to the cloud.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      setState((prev) => ({ ...prev, hasReadPermission: hasPermission }));
      return hasPermission;
    } catch (err) {
      console.error('[useSmsTracker] Error requesting READ_SMS permission:', err);
      setState((prev) => ({ ...prev, error: 'Failed to request READ_SMS permission' }));
      return false;
    }
  }, []);

  /**
   * Request RECEIVE_SMS permission
   */
  const requestReceivePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'Real-Time SMS Monitoring',
          message:
            'SentinelPay needs access to monitor incoming SMS messages in real-time to immediately detect and alert you about potential fraud. All analysis is done on your device.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      setState((prev) => ({ ...prev, hasReceivePermission: hasPermission }));
      return hasPermission;
    } catch (err) {
      console.error('[useSmsTracker] Error requesting RECEIVE_SMS permission:', err);
      setState((prev) => ({ ...prev, error: 'Failed to request RECEIVE_SMS permission' }));
      return false;
    }
  }, []);

  /**
   * Request all permissions
   */
  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    const readGranted = await requestReadPermission();
    const receiveGranted = await requestReceivePermission();
    const allGranted = readGranted && receiveGranted;
    
    setState((prev) => ({ ...prev, permissionsGranted: allGranted }));
    return allGranted;
  }, [requestReadPermission, requestReceivePermission]);

  /**
   * Scan historical SMS messages (batch processing)
   */
  const scanHistoricalSms = useCallback(async (): Promise<void> => {
    if (!state.hasReadPermission) {
      setState((prev) => ({ ...prev, error: 'READ_SMS permission not granted' }));
      return;
    }

    if (!SmsReaderModule) {
      setState((prev) => ({ ...prev, error: 'SmsReaderModule not available' }));
      return;
    }

    setState((prev) => ({ ...prev, isScanning: true, error: null, scanProgress: 0 }));

    try {
      // Get total SMS count
      const totalCount = await SmsReaderModule.getSmsCount();
      console.log(`[useSmsTracker] Total SMS to scan: ${totalCount}`);

      if (totalCount === 0) {
        setState((prev) => ({
          ...prev,
          isScanning: false,
          scanProgress: 100,
          hasScannedHistorical: true,
        }));
        await updateScannerState({
          hasScannedHistorical: true,
          lastHistoricalScanTimestamp: Date.now(),
          totalHistoricalScanned: 0,
        });
        return;
      }

      // Batch processing: 50 messages at a time
      const batchSize = 50;
      let offset = 0;
      let totalScanned = 0;

      while (offset < totalCount) {
        const result = await SmsReaderModule.readSmsBatch(offset, batchSize);
        const rawMessages = result.messages || [];

        // Convert to SmsMessage format
        const messages: SmsMessage[] = rawMessages.map((raw: any) => ({
          id: generateMessageId(raw.sender, raw.timestamp),
          sender: raw.sender,
          body: raw.body,
          timestamp: raw.timestamp,
          fraudScore: raw.fraudScore,
          classification: classifyMessage(raw.fraudScore),
          scannedAt: Date.now(),
        }));

        // Store batch
        await storeMessagesBatch(messages);

        totalScanned += messages.length;
        offset += batchSize;

        // Update progress
        const progress = Math.min(100, Math.floor((totalScanned / totalCount) * 100));
        setState((prev) => ({ ...prev, scanProgress: progress, totalScanned }));

        console.log(`[useSmsTracker] Scanned ${totalScanned}/${totalCount} messages (${progress}%)`);
      }

      // Mark as complete
      await updateScannerState({
        hasScannedHistorical: true,
        lastHistoricalScanTimestamp: Date.now(),
        totalHistoricalScanned: totalScanned,
      });

      // Update stats
      const stats = await getStats();
      setState((prev) => ({
        ...prev,
        isScanning: false,
        scanProgress: 100,
        hasScannedHistorical: true,
        totalMessages: stats.totalMessages,
        fraudCount: stats.fraudCount,
        suspiciousCount: stats.suspiciousCount,
        genuineCount: stats.genuineCount,
      }));

      console.log(`[useSmsTracker] Historical scan complete: ${totalScanned} messages`);
    } catch (err) {
      console.error('[useSmsTracker] Error scanning historical SMS:', err);
      setState((prev) => ({
        ...prev,
        isScanning: false,
        error: `Failed to scan SMS: ${err}`,
      }));
    }
  }, [state.hasReadPermission]);

  /**
   * Start real-time SMS monitoring
   */
  const startMonitoring = useCallback((): (() => void) | void => {
    if (!state.hasReceivePermission) {
      setState((prev) => ({ ...prev, error: 'RECEIVE_SMS permission not granted' }));
      return;
    }

    if (!SmsReceiverModule) {
      setState((prev) => ({ ...prev, error: 'SmsReceiverModule not available' }));
      return;
    }

    try {
      const emitter = new NativeEventEmitter(SmsReceiverModule);
      
      const subscription = emitter.addListener('onSmsReceived', async (data: any) => {
        console.log('[useSmsTracker] New SMS received:', data.sender);

        // Create SmsMessage
        const message: SmsMessage = {
          id: generateMessageId(data.sender, data.timestamp),
          sender: data.sender,
          body: data.body,
          timestamp: data.timestamp,
          fraudScore: data.fraudScore,
          classification: classifyMessage(data.fraudScore),
          scannedAt: Date.now(),
        };

        // Store message
        await storeMessage(message);

        // Update stats
        const stats = await getStats();
        setState((prev) => ({
          ...prev,
          totalMessages: stats.totalMessages,
          fraudCount: stats.fraudCount,
          suspiciousCount: stats.suspiciousCount,
          genuineCount: stats.genuineCount,
        }));

        // Trigger notification if fraud detected
        if (message.classification === 'fraud') {
          console.log(`[useSmsTracker] FRAUD SMS detected from ${message.sender}`);
          // Notification will be handled by notification manager
        }
      });

      SmsReceiverModule.startListening();
      setState((prev) => ({ ...prev, isMonitoring: true }));
      console.log('[useSmsTracker] Real-time monitoring started');

      // Return cleanup function
      return () => {
        subscription.remove();
        SmsReceiverModule.stopListening();
        setState((prev) => ({ ...prev, isMonitoring: false }));
        console.log('[useSmsTracker] Real-time monitoring stopped');
      };
    } catch (err) {
      console.error('[useSmsTracker] Error starting monitoring:', err);
      setState((prev) => ({ ...prev, error: `Failed to start monitoring: ${err}` }));
    }
  }, [state.hasReceivePermission]);

  /**
   * Stop real-time monitoring
   */
  const stopMonitoring = useCallback((): void => {
    if (SmsReceiverModule) {
      SmsReceiverModule.stopListening();
      setState((prev) => ({ ...prev, isMonitoring: false }));
      console.log('[useSmsTracker] Monitoring stopped');
    }
  }, []);

  /**
   * Refresh stats
   */
  const refreshStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await getStats();
      setState((prev) => ({
        ...prev,
        totalMessages: stats.totalMessages,
        fraudCount: stats.fraudCount,
        suspiciousCount: stats.suspiciousCount,
        genuineCount: stats.genuineCount,
      }));
    } catch (err) {
      console.error('[useSmsTracker] Error refreshing stats:', err);
    }
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const init = async () => {
      // Check scanner state
      const scannerState = await getScannerState();
      setState((prev) => ({
        ...prev,
        hasScannedHistorical: scannerState.hasScannedHistorical,
      }));

      // Load stats
      await refreshStats();
    };

    init();
  }, [refreshStats]);

  return {
    state,
    requestReadPermission,
    requestReceivePermission,
    requestAllPermissions,
    scanHistoricalSms,
    startMonitoring,
    stopMonitoring,
    refreshStats,
  };
}
