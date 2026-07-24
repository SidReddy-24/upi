/**
 * notificationService.ts — Local push notification service.
 *
 * Sends in-app notifications for transaction events using react-native-push-notification.
 * Supports Android notification channels (required for API 26+) with proper color coding
 * and actionable notifications.
 *
 * Requirements: 1.5, 1.6
 */
import PushNotification, {
  PushNotificationObject,
} from 'react-native-push-notification';
import { Platform, PermissionsAndroid } from 'react-native';
import type { TransactionNotificationPayload } from '../types';
import { formatTransactionNotification } from '../utils/formatters';
import type { TransactionNotification } from '../types';

// Notification channel configuration for Android API 26+
const CHANNEL_ID = 'sentinelpay-transactions';
const CHANNEL_NAME = 'Transaction Notifications';

// Color coding based on transaction status
const STATUS_COLORS = {
  APPROVE: '#4ade80', // green
  REVIEW: '#fbbf24',  // yellow
  REJECT: '#ef4444',  // red
};

/**
 * NotificationService class for managing local push notifications.
 * Must be configured before use by calling configure().
 */
class NotificationService {
  private configured = false;

  /**
   * Configure the notification service and create Android notification channel.
   * Must be called once during app initialization before sending notifications.
   *
   * Android API 26+ requires notification channels. This method:
   * - Creates a channel with ID 'sentinelpay-transactions'
   * - Sets channel name to 'Transaction Notifications'
   * - Sets importance to HIGH (shows on screen)
   * - Uses ic_launcher icon for notifications
   */
  configure(): void {
    if (this.configured) {
      console.log('[NotificationService] Already configured');
      return;
    }

    // Create notification channel for Android API 26+ (Transactions)
    PushNotification.createChannel(
      {
        channelId: CHANNEL_ID,
        channelName: CHANNEL_NAME,
        channelDescription: 'Notifications for transaction confirmations and fraud alerts',
        importance: 4, // Importance.HIGH - Shows on screen, makes sound
        vibrate: true,
        soundName: 'default',
      },
      (created) => {
        if (created) {
          console.log(`[NotificationService] Channel "${CHANNEL_ID}" created`);
        } else {
          console.log(`[NotificationService] Channel "${CHANNEL_ID}" already exists`);
        }
      },
    );

    // Create high-priority SMS channel for Realtime Truecaller-style popups
    PushNotification.createChannel(
      {
        channelId: 'sentinelpay-sms-alerts',
        channelName: 'Realtime SMS Fraud Detection (Truecaller AI)',
        channelDescription: 'Realtime AI pop-up notifications for all incoming SMS messages',
        importance: 4, // Importance.HIGH - Pop-up banner at top of screen
        vibrate: true,
        soundName: 'default',
      },
      (created) => {
        if (created) {
          console.log('[NotificationService] SMS Channel "sentinelpay-sms-alerts" created');
        }
      },
    );

    // Configure notification handlers
    PushNotification.configure({
      // Called when notification is opened/tapped
      onNotification: (notification: any) => {
        console.log('[NotificationService] Notification tapped:', notification);
        
        // Handle "View Details" action - check both userInfo and data
        const txnId = notification.userInfo?.txnId || notification.data?.txnId;
        if (notification.userInteraction && txnId) {
          this.handleNotificationAction('view_details', txnId);
        }

        // Required for iOS - call finish after handling
        if (notification.finish) {
          notification.finish('UIBackgroundFetchResultNoData');
        }
      },

      // Permissions request results (iOS)
      onRegistrationError: (err) => {
        console.error('[NotificationService] Registration error:', err);
      },

      // IOS only: should we request permissions immediately
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should app pop initial notification when in foreground (default: false)
      popInitialNotification: true,

      // Request permissions immediately for iOS
      requestPermissions: Platform.OS === 'ios',
    });

    this.configured = true;
    console.log('[NotificationService] Configured successfully');
  }

  /**
   * Request notification permissions from the user.
   * For Android 13+ (API 33), this requests POST_NOTIFICATIONS permission.
   * For iOS, this requests alert, badge, and sound permissions.
   *
   * @returns Promise<boolean> - true if permissions granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Android 13+ requires explicit POST_NOTIFICATIONS permission
        // For older Android versions, notifications are enabled by default
        // react-native-push-notification handles this automatically
        console.log('[NotificationService] Requesting Android notification permissions');
        if (Platform.Version as number >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      } else if (Platform.OS === 'ios') {
        // iOS requires explicit permission request
        console.log('[NotificationService] Requesting iOS notification permissions');
        
        return new Promise((resolve) => {
          PushNotification.checkPermissions((permissions) => {
            console.log('[NotificationService] Current permissions:', permissions);
            
            // If already granted, return true
            if (permissions.alert && permissions.sound) {
              resolve(true);
              return;
            }

            // Request permissions
            PushNotification.requestPermissions(['alert', 'badge', 'sound']).then(
              (granted) => {
                console.log('[NotificationService] Permissions granted:', granted);
                resolve(!!granted);
              },
            );
          });
        });
      }

      return true;
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Send a transaction notification to the user.
   * Implements Requirements 1.1, 1.2, 1.3, 1.4, 1.7, 1.8, 1.9, 1.10.
   *
   * Features:
   * - 2-second timeout for notification delivery
   * - Color coding based on status (green/yellow/red)
   * - "View Details" action for deep linking
   * - Works when app is in background
   * - Graceful error handling (logs but doesn't throw)
   *
   * @param payload - Transaction notification data
   * @param recipient - 'sender' or 'receiver' (determines notification text)
   */
  async sendTransactionNotification(
    payload: TransactionNotificationPayload,
    recipient: 'sender' | 'receiver',
  ): Promise<void> {
    if (!this.configured) {
      console.warn('[NotificationService] Not configured, call configure() first');
      this.configure();
    }

    try {
      // Create notification with 2-second timeout
      const notificationPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Notification delivery timeout (>2s)'));
        }, 2000);

        try {
          const notification = this.buildNotification(payload, recipient);
          PushNotification.localNotification(notification);
          clearTimeout(timeout);
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      await notificationPromise;
      console.log(`[NotificationService] Notification sent for txn ${payload.txnId}`);
    } catch (error: any) {
      // Log failure without blocking transaction completion (Requirement 1.9)
      console.error(
        `[NotificationService] Failed to send notification for txn ${payload.txnId}:`,
        error?.message ?? error,
      );
    }
  }

  /**
   * Build notification object with proper formatting and actions.
   * Uses formatTransactionNotification() from Task 2.1 for message formatting.
   * @private
   */
  private buildNotification(
    payload: TransactionNotificationPayload,
    recipient: 'sender' | 'receiver',
  ): PushNotificationObject {
    const { amount, counterpartyVpa, status, fraudScore, timestamp, txnId } = payload;

    // Convert status to formatter format (APPROVE -> APPROVED, REVIEW -> FLAGGED, REJECT -> BLOCKED)
    let formatterStatus: 'APPROVED' | 'FLAGGED' | 'BLOCKED';
    if (status === 'APPROVE') {
      formatterStatus = 'APPROVED';
    } else if (status === 'REVIEW') {
      formatterStatus = 'FLAGGED';
    } else {
      formatterStatus = 'BLOCKED';
    }

    // Use formatter from Task 2.1 to generate the message
    const txnNotification: TransactionNotification = {
      amount,
      counterpartyVpa,
      status: formatterStatus,
      fraudScore,
      timestamp,
    };

    const formattedMessage = formatTransactionNotification(txnNotification);

    // Determine title based on recipient and status
    let title = '';
    if (recipient === 'sender') {
      if (status === 'APPROVE') {
        title = '✅ Payment Sent';
      } else if (status === 'REVIEW') {
        title = '⚠️ Payment Flagged';
      } else {
        title = '❌ Payment Blocked';
      }
    } else {
      // receiver
      title = '💰 Payment Received';
    }

    // Get color based on status (Requirement 1.10)
    const color = STATUS_COLORS[status];

    return {
      channelId: CHANNEL_ID,
      id: txnId, // Use transaction ID as notification ID
      title,
      message: formattedMessage, // Use formatted message from Task 2.1
      playSound: true,
      soundName: 'default',
      importance: 'high',
      vibrate: true,
      vibration: 300,
      priority: 'high',
      color, // Android only - notification color
      
      // Actionable notification (Requirement 1.7)
      actions: ['view_details'],
      invokeApp: true,
      
      // Small icon - using default launcher icon (Requirement 1.10)
      smallIcon: 'ic_launcher',
      largeIcon: 'ic_launcher',
      
      // Data payload for deep linking
      userInfo: {
        txnId,
        action: 'view_details',
      },
    };
  }

  /**
   * Handle notification action (e.g., "View Details" button).
   * Opens the transaction detail screen.
   *
   * @param action - Action identifier
   * @param txnId - Transaction ID
   */
  handleNotificationAction(action: string, txnId: string): void {
    console.log(`[NotificationService] Action "${action}" for transaction ${txnId}`);

    if (action === 'view_details') {
      // TODO: Deep link to TransactionDetail screen
      // This will be wired up in Task 15.1 when integrating all services
      console.log(`[NotificationService] Navigate to TransactionDetail: ${txnId}`);
    }
  }

  /**
   * Send a Truecaller-style Realtime SMS Heads-Up Pop-up notification.
   */
  showSmsFraudAlert(sender: string, classification: string, fraudScore: number, snippet: string): void {
    if (!this.configured) {
      this.configure();
    }

    const isFraud = classification === 'fraud' || classification === 'SCAM' || classification === 'PHISHING';
    const isSuspicious = classification === 'suspicious';

    const title = isFraud
      ? `🚨 FRAUD SMS DETECTED: ${sender}`
      : isSuspicious
      ? `⚠️ SUSPICIOUS SMS: ${sender}`
      : `✓ Genuine SMS: ${sender}`;

    const body = `Risk Score: ${Math.round(fraudScore * 100)}% • "${snippet.substring(0, 70)}..."`;
    const color = isFraud ? '#EF4444' : isSuspicious ? '#F59E0B' : '#10B981';

    PushNotification.localNotification({
      channelId: 'sentinelpay-sms-alerts',
      title,
      message: body,
      color,
      vibrate: true,
      vibration: 500,
      playSound: true,
      soundName: 'default',
      priority: 'high',
      importance: 'high',
      visibility: 'public',
      tag: 'sms_alert',
    });
  }

  /**
   * Cancel all pending notifications (utility method).
   */
  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
    console.log('[NotificationService] All notifications cancelled');
  }

  /**
   * Cancel a specific notification by transaction ID.
   * @param txnId - Transaction ID
   */
  cancelNotification(txnId: string): void {
    PushNotification.cancelLocalNotification(txnId);
    console.log(`[NotificationService] Notification cancelled for txn ${txnId}`);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export class for testing
export default NotificationService;
