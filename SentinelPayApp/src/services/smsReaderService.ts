/**
 * smsReaderService.ts — SMS Reader Service TypeScript Coordinator
 *
 * Task 5.1: Create SmsReaderService TypeScript coordinator
 * Requirements: 6.1, 6.2
 *
 * This service coordinates with the native SmsReceiverModule to monitor incoming SMS messages.
 * It provides a clean TypeScript interface for SMS monitoring with proper lifecycle management.
 *
 * The service bridges the gap between React Native and the existing native Android modules:
 * - SmsReceiverModule.java (broadcasts SMS events)
 * - SmsClassifier.java (provides ML-based fraud scoring)
 */

import {
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
  EmitterSubscription,
} from 'react-native';
import PushNotification from 'react-native-push-notification';

// ─── Native Module Import ─────────────────────────────────────────────────────
const { SmsReceiverModule } = NativeModules;

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * SMS message data received from native module
 */
export interface SmsMessage {
  sender: string;       // Phone number or sender ID (e.g., "HDFCBK")
  body: string;         // Message content
  timestamp: number;    // Unix timestamp in milliseconds
  fraudScore?: number;  // Optional fraud score from TFLite classifier (0.0-1.0)
}

/**
 * SMS classification result after analysis
 */
export interface SmsClassificationResult {
  riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  confidence: number;
  containsOtp: boolean;
  isTrustedSender: boolean;
  fraudScore: number; // Raw fraud score from ML classifier (0.0-1.0)
}

// ─── SMS Reader Service Class ──────────────────────────────────────────────────

/**
 * SmsReaderService - Coordinates SMS monitoring and classification
 *
 * This service provides lifecycle management for SMS monitoring:
 * 1. Request READ_SMS permission from the user
 * 2. Start monitoring incoming SMS via native SmsReceiverModule
 * 3. Listen to 'onSmsReceived' events from the native layer
 * 4. Stop monitoring when no longer needed
 *
 * The native SmsReceiverModule handles:
 * - BroadcastReceiver registration for SMS_RECEIVED intent
 * - SMS content extraction (sender, body, timestamp)
 * - TFLite classification via SmsClassifier.java
 * - Event emission to React Native layer
 */
class SmsReaderService {
  private eventEmitter: NativeEventEmitter | null = null;
  private subscription: EmitterSubscription | null = null;
  private isMonitoring: boolean = false;
  private messageCallback: ((message: SmsMessage) => void) | null = null;

  /**
   * Request READ_SMS permission from the user (Android only)
   *
   * Requirements: 6.1
   *
   * On Android, this requests both READ_SMS and RECEIVE_SMS permissions.
   * On iOS, SMS reading is not supported due to platform restrictions.
   *
   * @returns Promise<boolean> - true if permissions granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[SmsReaderService] SMS reading not supported on iOS');
      return false;
    }

    if (!SmsReceiverModule) {
      console.error('[SmsReaderService] SmsReceiverModule not available');
      return false;
    }

    try {
      console.log('[SmsReaderService] Requesting SMS permissions...');
      
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      const readSmsGranted = granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
      const receiveSmsGranted = granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;

      const allGranted = readSmsGranted && receiveSmsGranted;

      if (allGranted) {
        console.log('[SmsReaderService] SMS permissions granted');
      } else {
        console.warn('[SmsReaderService] SMS permissions denied', {
          readSms: readSmsGranted,
          receiveSms: receiveSmsGranted,
        });
      }

      return allGranted;
    } catch (error) {
      console.error('[SmsReaderService] Error requesting SMS permissions:', error);
      return false;
    }
  }

  /**
   * Start monitoring incoming SMS messages
   *
   * Requirements: 6.2
   *
   * This method:
   * 1. Creates a NativeEventEmitter for SmsReceiverModule
   * 2. Subscribes to 'onSmsReceived' events from native layer
   * 3. Calls native startListening() to register BroadcastReceiver
   *
   * The native module will emit events when SMS messages are received,
   * including the fraud score from the TFLite classifier.
   *
   * Note: Call requestPermissions() before starting monitoring.
   */
  startMonitoring(): void {
    if (!SmsReceiverModule) {
      console.error('[SmsReaderService] SmsReceiverModule not available');
      return;
    }

    if (this.isMonitoring) {
      console.log('[SmsReaderService] Already monitoring SMS');
      return;
    }

    try {
      // Create event emitter for native module
      this.eventEmitter = new NativeEventEmitter(SmsReceiverModule);

      // Subscribe to SMS received events
      this.subscription = this.eventEmitter.addListener(
        'onSmsReceived',
        this.handleSmsReceived.bind(this)
      );

      // Start native BroadcastReceiver
      SmsReceiverModule.startListening();

      this.isMonitoring = true;
      console.log('[SmsReaderService] SMS monitoring started');
    } catch (error) {
      console.error('[SmsReaderService] Error starting SMS monitoring:', error);
      this.cleanup();
    }
  }

  /**
   * Stop monitoring incoming SMS messages
   *
   * Requirements: 6.2
   *
   * This method:
   * 1. Removes the event listener subscription
   * 2. Calls native stopListening() to unregister BroadcastReceiver
   * 3. Cleans up resources
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('[SmsReaderService] Not currently monitoring SMS');
      return;
    }

    try {
      // Stop native BroadcastReceiver
      if (SmsReceiverModule) {
        SmsReceiverModule.stopListening();
      }

      // Clean up subscriptions and resources
      this.cleanup();

      this.isMonitoring = false;
      console.log('[SmsReaderService] SMS monitoring stopped');
    } catch (error) {
      console.error('[SmsReaderService] Error stopping SMS monitoring:', error);
    }
  }

  /**
   * Set callback to be invoked when SMS messages are received
   *
   * @param callback - Function to call with received SMS message
   */
  setMessageCallback(callback: (message: SmsMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Remove message callback
   */
  clearMessageCallback(): void {
    this.messageCallback = null;
  }

  /**
   * Check if currently monitoring SMS
   *
   * @returns boolean - true if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Classify an SMS message using ML classifier and rule-based detection
   *
   * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7
   *
   * This method combines:
   * 1. ML fraud score from native SmsClassifier (0.0-1.0)
   * 2. Trusted sender detection (bank pattern matching)
   * 3. OTP keyword detection
   * 4. Risk level determination based on combined signals
   *
   * @param message - SMS message to classify
   * @returns Promise<SmsClassificationResult> - Classification result with risk level
   */
  async classifyMessage(message: SmsMessage): Promise<SmsClassificationResult> {
    // Extract fraud score from message (set by native module)
    const fraudScore = message.fraudScore ?? 0.0;

    // Check if sender is trusted (bank or known service)
    const isTrustedSender = this.checkTrustedSender(message.sender);

    // Check if message contains OTP-related keywords
    const containsOtp = this.containsOtpKeywords(message.body);

    // Determine risk level based on combined signals
    const riskLevel = this.determineRiskLevel(fraudScore, isTrustedSender, containsOtp);

    // Confidence is based on fraud score magnitude
    const confidence = Math.abs(fraudScore);

    return {
      riskLevel,
      confidence,
      containsOtp,
      isTrustedSender,
      fraudScore,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  /**
   * Check if sender is from a trusted source (bank or known service)
   *
   * Requirements: 6.4
   *
   * Trusted sender patterns:
   * - Bank sender IDs: [A-Z]{2}-[A-Z]{6} (e.g., "HD-HDFCBK", "IC-ICICI", "AX-HDFCBK")
   * - Known short codes: Numeric codes from banks (e.g., "600000", "500000")
   *
   * @param sender - Sender phone number or ID
   * @returns boolean - true if sender is trusted
   * @private
   */
  private checkTrustedSender(sender: string): boolean {
    if (!sender || sender.trim() === '') {
      return false;
    }

    const senderUpper = sender.trim().toUpperCase();

    // Pattern 1: Bank sender ID format [A-Z]{2}-[A-Z]{6}
    // Examples: HD-HDFCBK, IC-ICICI, AX-HDFCBK, SB-SBIINB, KB-KOTAKB
    const bankIdPattern = /^[A-Z]{2}-[A-Z]{6}$/;
    if (bankIdPattern.test(senderUpper)) {
      return true;
    }

    // Pattern 2: Known bank short codes (6-digit numeric)
    const shortCodePattern = /^[0-9]{6}$/;
    if (shortCodePattern.test(sender)) {
      // Common bank short codes in India
      const trustedShortCodes = [
        '600000', // HDFC Bank
        '500000', // ICICI Bank
        '400000', // SBI
        '700000', // Axis Bank
        '800000', // Kotak Bank
      ];
      return trustedShortCodes.includes(sender);
    }

    // Pattern 3: Known service names (case-insensitive)
    const trustedServices = [
      'HDFCBK',
      'ICICIB',
      'SBIINB',
      'AXISBK',
      'KOTAKB',
      'YESBNK',
      'PAYTM',
      'GOOGLEPAY',
      'PHONEPE',
      'AMAZONPAY',
    ];

    return trustedServices.some(service => senderUpper.includes(service));
  }

  /**
   * Check if message body contains OTP-related keywords
   *
   * Requirements: 6.5
   *
   * OTP keywords (case-insensitive):
   * - "OTP"
   * - "verification code"
   * - "one time password"
   * - "one-time password"
   * - "authentication code"
   * - "passcode"
   * - "PIN"
   * - "security code"
   *
   * @param body - Message body text
   * @returns boolean - true if message contains OTP keywords
   * @private
   */
  private containsOtpKeywords(body: string): boolean {
    if (!body || body.trim() === '') {
      return false;
    }

    const bodyLower = body.toLowerCase();

    const otpKeywords = [
      'otp',
      'verification code',
      'one time password',
      'one-time password',
      'authentication code',
      'passcode',
      'security code',
      // Also check for common phrases
      'verify your',
      'confirm your',
      'login code',
      'verification pin',
    ];

    return otpKeywords.some(keyword => bodyLower.includes(keyword));
  }

  /**
   * Determine risk level based on combined signals
   *
   * Requirements: 6.6, 6.7, 6.14
   *
   * Risk level determination logic:
   * - DANGEROUS: High ML fraud score (>0.7) OR (contains OTP AND not trusted sender)
   * - SUSPICIOUS: Medium ML fraud score (0.3-0.7) OR (contains OTP but uncertain sender)
   * - SAFE: Low ML fraud score (<0.3) AND (no OTP OR trusted sender)
   *
   * @param fraudScore - ML fraud score from TFLite classifier (0.0-1.0)
   * @param isTrustedSender - Whether sender is from trusted source
   * @param containsOtp - Whether message contains OTP keywords
   * @returns 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'
   * @private
   */
  private determineRiskLevel(
    fraudScore: number,
    isTrustedSender: boolean,
    containsOtp: boolean
  ): 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' {
    if (fraudScore >= 0.70) return 'DANGEROUS';
    if (containsOtp && !isTrustedSender) return 'DANGEROUS';
    if (fraudScore >= 0.40) return 'SUSPICIOUS';
    return 'SAFE';
  }

  /**
   * Handle SMS received event from native module
   *
   * @param event - SMS message data from native layer
   * @private
   */
  private async handleSmsReceived(event: any): Promise<void> {
    try {
      const message: SmsMessage = {
        sender: event.sender || '',
        body: event.body || '',
        timestamp: event.timestamp || Date.now(),
        fraudScore: event.fraudScore !== undefined ? event.fraudScore : undefined,
      };

      console.log(`[SmsReaderService] SMS received from ${message.sender}`, {
        bodyLength: message.body.length,
        fraudScore: message.fraudScore,
      });

      // Classify message for risk assessment via TFLite ML Model + Whitelist
      const classification = await this.classifyMessage(message);

      // Send realtime Truecaller-style pop-up notification for ALL incoming SMS messages!
      await this.sendWarningNotification(message, classification);

      // Invoke callback if set
      if (this.messageCallback) {
        this.messageCallback(message);
      }
    } catch (error) {
      console.error('[SmsReaderService] Error handling SMS received event:', error);
    }
  }

  /**
   * Send realtime Truecaller-style notification for incoming SMS messages
   *
   * @param message - The SMS message evaluated by ML model
   * @param classification - The classification result (SAFE, SUSPICIOUS, DANGEROUS)
   * @private
   */
  private async sendWarningNotification(
    message: SmsMessage,
    classification: SmsClassificationResult
  ): Promise<void> {
    try {
      const isDangerous = classification.riskLevel === 'DANGEROUS';
      const isSuspicious = classification.riskLevel === 'SUSPICIOUS';
      const isSafe = classification.riskLevel === 'SAFE';

      const riskEmoji = isDangerous ? '🚨' : isSuspicious ? '⚠️' : '✅';
      const riskLabel = isDangerous ? 'HIGH RISK' : isSuspicious ? 'SUSPICIOUS' : 'LEGIT';
      const color = isDangerous ? '#ef4444' : isSuspicious ? '#fbbf24' : '#10b981'; // Red / Yellow / Green

      // Truncate sender for display (Requirement 6.9)
      const senderDisplay = message.sender.length > 30
        ? message.sender.substring(0, 30) + '...'
        : message.sender;

      // Build title: Truecaller-style pop-up header
      const title = `${riskEmoji} ${riskLabel} SMS: ${senderDisplay}`;

      // Build advice based on classification
      let advice = '';
      if (isDangerous) {
        if (classification.containsOtp && !classification.isTrustedSender) {
          advice = '⚠️ DO NOT share this OTP! Legitimate services NEVER ask for OTPs over phone or SMS.';
        } else {
          advice = '🚨 High scam likelihood. Do not click links or share personal details.';
        }
      } else if (isSuspicious) {
        advice = '⚠️ Be cautious. Verify sender before taking any action.';
      } else {
        advice = '✅ Verified safe message. Low fraud risk detected by SentinelPay AI.';
      }

      // Truncate message body for preview
      const bodyPreview = message.body.length > 100
        ? message.body.substring(0, 100) + '...'
        : message.body;

      // Build notification message (Requirement 6.9)
      const notificationMessage = `From: ${senderDisplay}\n\nMessage: ${bodyPreview}\n\n${advice}`;

      // Send notification with actions (Requirement 6.10)
      PushNotification.localNotification({
        channelId: 'sentinelpay-sms-alerts', // Dedicated high-priority SMS channel
        id: `sms-warning-${Date.now()}`, // Unique notification ID
        title,
        message: notificationMessage,
        playSound: true,
        soundName: 'default',
        importance: 'high',
        vibrate: true,
        vibration: 300,
        priority: 'high',
        color,

        // Actionable notification
        actions: isSafe ? ['view_details'] : ['view_details', 'mark_safe'],
        invokeApp: true,

        // Icon
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',

        // Data payload for action handling
        userInfo: {
          type: 'sms_warning',
          sender: message.sender,
          timestamp: message.timestamp,
          riskLevel: classification.riskLevel,
          fraudScore: classification.fraudScore,
          containsOtp: classification.containsOtp,
          isTrustedSender: classification.isTrustedSender,
        },
      });

      console.log(`[SmsReaderService] Realtime evaluation notification sent for ${riskLabel} from ${message.sender}`);
    } catch (error) {
      console.error('[SmsReaderService] Failed to send warning notification:', error);
    }
  }

  /**
   * Clean up event subscriptions and emitter
   *
   * @private
   */
  private cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.eventEmitter = null;
  }
}

// ─── Export Singleton Instance ─────────────────────────────────────────────────

/**
 * Singleton instance of SmsReaderService
 *
 * Usage:
 *   import { smsReaderService } from './services/smsReaderService';
 *
 *   // Request permissions
 *   const granted = await smsReaderService.requestPermissions();
 *
 *   // Set callback to handle and classify incoming messages
 *   smsReaderService.setMessageCallback(async (message) => {
 *     console.log('SMS received:', message);
 *
 *     // Classify the message
 *     const classification = await smsReaderService.classifyMessage(message);
 *     console.log('Classification:', classification);
 *
 *     // Warn user if dangerous
 *     if (classification.riskLevel === 'DANGEROUS') {
 *       // Show warning notification
 *     }
 *   });
 *
 *   // Start monitoring
 *   if (granted) {
 *     smsReaderService.startMonitoring();
 *   }
 *
 *   // Stop monitoring when done
 *   smsReaderService.stopMonitoring();
 */
export const smsReaderService = new SmsReaderService();

// Export class for testing
export default SmsReaderService;
