/**
 * notificationService.test.ts — Unit and Integration tests for NotificationService
 *
 * Tests the configuration, permission requests, and notification delivery
 * for the local push notification service.
 *
 * Task 4.3: Integration tests for notification service
 * - Test notification delivery for APPROVE, REJECT, REVIEW statuses
 * - Test permission denied scenarios
 * - Test timeout and failure handling
 * Requirements: 1.9
 */
import NotificationService, { notificationService } from '../../src/services/notificationService';
import PushNotification from 'react-native-push-notification';
import type { TransactionNotificationPayload } from '../../src/types';
import { Platform } from 'react-native';

// Mock react-native-push-notification
jest.mock('react-native-push-notification', () => ({
  createChannel: jest.fn(),
  configure: jest.fn(),
  localNotification: jest.fn(),
  cancelAllLocalNotifications: jest.fn(),
  cancelLocalNotification: jest.fn(),
  checkPermissions: jest.fn(),
  requestPermissions: jest.fn(),
}));

// Mock Platform module
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: jest.fn((obj: any) => obj.android),
  },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configure()', () => {
    it('should create notification channel for Android API 26+', () => {
      const service = new NotificationService();
      
      service.configure();

      expect(PushNotification.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'sentinelpay-transactions',
          channelName: 'Transaction Notifications',
          importance: 4, // Importance.HIGH
          vibrate: true,
          soundName: 'default',
        }),
        expect.any(Function),
      );
    });

    it('should configure PushNotification with notification handlers', () => {
      const service = new NotificationService();
      
      service.configure();

      expect(PushNotification.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          onNotification: expect.any(Function),
          onRegistrationError: expect.any(Function),
          permissions: {
            alert: true,
            badge: true,
            sound: true,
          },
          popInitialNotification: true,
          requestPermissions: false, // Android
        }),
      );
    });

    it('should not configure twice if already configured', () => {
      const service = new NotificationService();
      
      service.configure();
      service.configure();

      // Should only be called once
      expect(PushNotification.createChannel).toHaveBeenCalledTimes(1);
      expect(PushNotification.configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestPermissions()', () => {
    it('should return true for Android (permissions handled automatically)', async () => {
      const service = new NotificationService();
      
      const result = await service.requestPermissions();

      expect(result).toBe(true);
    });
  });

  describe('sendTransactionNotification()', () => {
    it('should send notification for APPROVE status (sender)', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 1000,
        counterpartyVpa: 'receiver@okhdfc',
        status: 'APPROVE',
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-123',
      };

      await service.sendTransactionNotification(payload, 'sender');

      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'sentinelpay-transactions',
          id: 'txn-123',
          title: '✅ Payment Sent',
          color: '#4ade80', // green
          importance: 'high',
        }),
      );
    });

    it('should send notification for REVIEW status with fraud score', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 5000,
        counterpartyVpa: 'suspicious@paytm',
        status: 'REVIEW',
        fraudScore: 0.72,
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-456',
      };

      await service.sendTransactionNotification(payload, 'sender');

      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'txn-456',
          title: '⚠️ Payment Flagged',
          color: '#fbbf24', // yellow
          // Formatter produces: "₹5,000 FLAGGED to suspicious@paytm [72%] on 21 Jan, 14:30"
          message: expect.stringMatching(/FLAGGED.*\[72%\]/),
        }),
      );
    });

    it('should send notification for REJECT status', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 10000,
        counterpartyVpa: 'fraudster@scam',
        status: 'REJECT',
        fraudScore: 0.95,
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-789',
      };

      await service.sendTransactionNotification(payload, 'sender');

      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'txn-789',
          title: '❌ Payment Blocked',
          color: '#ef4444', // red
          // Formatter produces: "₹10,000 BLOCKED to fraudster@scam [95%] on 21 Jan, 14:30"
          message: expect.stringMatching(/BLOCKED.*\[95%\]/),
        }),
      );
    });

    it('should send notification for receiver', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 2500,
        counterpartyVpa: 'sender@okhdfc',
        status: 'APPROVE',
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-999',
      };

      await service.sendTransactionNotification(payload, 'receiver');

      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'txn-999',
          title: '💰 Payment Received',
          // Formatter produces: "₹2,500 APPROVED to sender@okhdfc on 21 Jan, 14:30"
          message: expect.stringMatching(/APPROVED.*sender@okhdfc/),
        }),
      );
    });

    it('should format amount with currency symbol and locale', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 123456.78,
        counterpartyVpa: 'test@okhdfc',
        status: 'APPROVE',
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-amount',
      };

      await service.sendTransactionNotification(payload, 'sender');

      const callArgs = (PushNotification.localNotification as jest.Mock).mock.calls[0][0];
      expect(callArgs.message).toContain('₹1,23,456.78');
    });

    it('should include actionable "View Details" action', async () => {
      const service = new NotificationService();
      service.configure();

      const payload: TransactionNotificationPayload = {
        amount: 1000,
        counterpartyVpa: 'test@okhdfc',
        status: 'APPROVE',
        timestamp: new Date('2024-01-21T14:30:00'),
        txnId: 'txn-action',
      };

      await service.sendTransactionNotification(payload, 'sender');

      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: ['view_details'],
          invokeApp: true,
          userInfo: {
            txnId: 'txn-action',
            action: 'view_details',
          },
        }),
      );
    });

    it('should handle notification delivery timeout (>2s)', async () => {
      const service = new NotificationService();
      service.configure();

      // Mock localNotification to delay for 3 seconds
      (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 3000));
      });

      const payload: TransactionNotificationPayload = {
        amount: 1000,
        counterpartyVpa: 'test@okhdfc',
        status: 'APPROVE',
        timestamp: new Date(),
        txnId: 'txn-timeout',
      };

      // Should not throw, should log error instead
      await expect(
        service.sendTransactionNotification(payload, 'sender'),
      ).resolves.not.toThrow();
    });

    it('should log errors without blocking transaction completion', async () => {
      const service = new NotificationService();
      service.configure();

      // Mock localNotification to throw error
      (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
        throw new Error('Notification failed');
      });

      const payload: TransactionNotificationPayload = {
        amount: 1000,
        counterpartyVpa: 'test@okhdfc',
        status: 'APPROVE',
        timestamp: new Date(),
        txnId: 'txn-error',
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      await service.sendTransactionNotification(payload, 'sender');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send notification'),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cancelNotification()', () => {
    it('should cancel specific notification by transaction ID', () => {
      const service = new NotificationService();
      
      service.cancelNotification('txn-123');

      expect(PushNotification.cancelLocalNotification).toHaveBeenCalledWith('txn-123');
    });
  });

  describe('cancelAllNotifications()', () => {
    it('should cancel all pending notifications', () => {
      const service = new NotificationService();
      
      service.cancelAllNotifications();

      expect(PushNotification.cancelAllLocalNotifications).toHaveBeenCalled();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton notificationService instance', () => {
      expect(notificationService).toBeInstanceOf(NotificationService);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Task 4.3: Integration Tests for Notification Service
  // Requirements: 1.9
  // ────────────────────────────────────────────────────────────────────────────

  describe('Integration Tests - Notification Delivery for All Statuses', () => {
    let service: NotificationService;

    beforeEach(() => {
      service = new NotificationService();
      service.configure();
      jest.clearAllMocks();
    });

    describe('APPROVE status notifications', () => {
      it('should deliver notification for APPROVE status to sender', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 1500.50,
          counterpartyVpa: 'receiver@okhdfc',
          status: 'APPROVE',
          timestamp: new Date('2024-01-21T14:30:00'),
          txnId: 'txn-approve-001',
        };

        await service.sendTransactionNotification(payload, 'sender');

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            channelId: 'sentinelpay-transactions',
            id: 'txn-approve-001',
            title: '✅ Payment Sent',
            color: '#4ade80',
            importance: 'high',
            priority: 'high',
            actions: ['view_details'],
            userInfo: {
              txnId: 'txn-approve-001',
              action: 'view_details',
            },
          }),
        );
      });

      it('should deliver notification for APPROVE status to receiver', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 2500,
          counterpartyVpa: 'sender@okhdfc',
          status: 'APPROVE',
          timestamp: new Date('2024-01-21T14:30:00'),
          txnId: 'txn-approve-002',
        };

        await service.sendTransactionNotification(payload, 'receiver');

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'txn-approve-002',
            title: '💰 Payment Received',
            color: '#4ade80',
            message: expect.stringMatching(/APPROVED/),
          }),
        );
      });

      it('should deliver notification with formatted amount in Indian locale', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 123456.78,
          counterpartyVpa: 'merchant@paytm',
          status: 'APPROVE',
          timestamp: new Date('2024-01-21T14:30:00'),
          txnId: 'txn-approve-003',
        };

        await service.sendTransactionNotification(payload, 'sender');

        const callArgs = (PushNotification.localNotification as jest.Mock).mock.calls[0][0];
        expect(callArgs.message).toContain('₹1,23,456.78');
      });
    });

    describe('REVIEW status notifications', () => {
      it('should deliver notification for REVIEW status with fraud score', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 5000,
          counterpartyVpa: 'suspicious@paytm',
          status: 'REVIEW',
          fraudScore: 0.72,
          timestamp: new Date('2024-01-21T14:30:00'),
          txnId: 'txn-review-001',
        };

        await service.sendTransactionNotification(payload, 'sender');

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'txn-review-001',
            title: '⚠️ Payment Flagged',
            color: '#fbbf24', // yellow
            message: expect.stringMatching(/FLAGGED.*\[72%\]/),
          }),
        );
      });

      it('should deliver notification for REVIEW status with high fraud score', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 15000,
          counterpartyVpa: 'risky@unknown',
          status: 'REVIEW',
          fraudScore: 0.88,
          timestamp: new Date('2024-01-21T15:45:00'),
          txnId: 'txn-review-002',
        };

        await service.sendTransactionNotification(payload, 'sender');

        const callArgs = (PushNotification.localNotification as jest.Mock).mock.calls[0][0];
        expect(callArgs.title).toBe('⚠️ Payment Flagged');
        expect(callArgs.color).toBe('#fbbf24');
        expect(callArgs.message).toMatch(/\[88%\]/);
      });

      it('should include all required notification properties for REVIEW', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 7500,
          counterpartyVpa: 'flagged@merchant',
          status: 'REVIEW',
          fraudScore: 0.65,
          timestamp: new Date('2024-01-21T16:00:00'),
          txnId: 'txn-review-003',
        };

        await service.sendTransactionNotification(payload, 'sender');

        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            channelId: 'sentinelpay-transactions',
            id: 'txn-review-003',
            playSound: true,
            soundName: 'default',
            vibrate: true,
            vibration: 300,
            invokeApp: true,
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
          }),
        );
      });
    });

    describe('REJECT status notifications', () => {
      it('should deliver notification for REJECT status with fraud score', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 10000,
          counterpartyVpa: 'fraudster@scam',
          status: 'REJECT',
          fraudScore: 0.95,
          timestamp: new Date('2024-01-21T14:30:00'),
          txnId: 'txn-reject-001',
        };

        await service.sendTransactionNotification(payload, 'sender');

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'txn-reject-001',
            title: '❌ Payment Blocked',
            color: '#ef4444', // red
            message: expect.stringMatching(/BLOCKED.*\[95%\]/),
          }),
        );
      });

      it('should deliver notification for REJECT status with maximum fraud score', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 50000,
          counterpartyVpa: 'blacklisted@fraud',
          status: 'REJECT',
          fraudScore: 0.99,
          timestamp: new Date('2024-01-21T17:30:00'),
          txnId: 'txn-reject-002',
        };

        await service.sendTransactionNotification(payload, 'sender');

        const callArgs = (PushNotification.localNotification as jest.Mock).mock.calls[0][0];
        expect(callArgs.title).toBe('❌ Payment Blocked');
        expect(callArgs.color).toBe('#ef4444');
        expect(callArgs.message).toMatch(/\[99%\]/);
      });

      it('should deliver notification for REJECT status without fraud score', async () => {
        const payload: TransactionNotificationPayload = {
          amount: 8000,
          counterpartyVpa: 'blocked@site',
          status: 'REJECT',
          timestamp: new Date('2024-01-21T18:00:00'),
          txnId: 'txn-reject-003',
        };

        await service.sendTransactionNotification(payload, 'sender');

        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'txn-reject-003',
            title: '❌ Payment Blocked',
            color: '#ef4444',
          }),
        );
      });
    });

    describe('Notification delivery across multiple statuses', () => {
      it('should handle rapid sequential notifications for different statuses', async () => {
        const payloads: TransactionNotificationPayload[] = [
          {
            amount: 1000,
            counterpartyVpa: 'user1@okhdfc',
            status: 'APPROVE',
            timestamp: new Date('2024-01-21T10:00:00'),
            txnId: 'txn-seq-001',
          },
          {
            amount: 2000,
            counterpartyVpa: 'user2@paytm',
            status: 'REVIEW',
            fraudScore: 0.6,
            timestamp: new Date('2024-01-21T10:01:00'),
            txnId: 'txn-seq-002',
          },
          {
            amount: 3000,
            counterpartyVpa: 'user3@fraud',
            status: 'REJECT',
            fraudScore: 0.9,
            timestamp: new Date('2024-01-21T10:02:00'),
            txnId: 'txn-seq-003',
          },
        ];

        // Send all notifications
        await Promise.all(
          payloads.map(payload => service.sendTransactionNotification(payload, 'sender')),
        );

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(3);
        
        // Verify each notification was sent with correct status
        const calls = (PushNotification.localNotification as jest.Mock).mock.calls;
        expect(calls[0][0].title).toBe('✅ Payment Sent');
        expect(calls[1][0].title).toBe('⚠️ Payment Flagged');
        expect(calls[2][0].title).toBe('❌ Payment Blocked');
      });
    });
  });

  describe('Integration Tests - Permission Denied Scenarios', () => {
    let service: NotificationService;

    beforeEach(() => {
      service = new NotificationService();
      jest.clearAllMocks();
    });

    describe('Android permission scenarios', () => {
      beforeEach(() => {
        (Platform.OS as any) = 'android';
      });

      it('should return true for Android (permissions handled automatically)', async () => {
        const result = await service.requestPermissions();
        expect(result).toBe(true);
      });

      it('should log permission request for Android', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        await service.requestPermissions();
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Requesting Android notification permissions'),
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('iOS permission scenarios', () => {
      beforeEach(() => {
        // Mock iOS platform
        Object.defineProperty(Platform, 'OS', {
          get: () => 'ios',
          configurable: true,
        });
      });

      it('should return true when iOS permissions are already granted', async () => {
        (PushNotification.checkPermissions as jest.Mock).mockImplementation((callback) => {
          callback({ alert: true, badge: true, sound: true });
        });

        const result = await service.requestPermissions();
        
        expect(result).toBe(true);
        expect(PushNotification.checkPermissions).toHaveBeenCalled();
      });

      it('should return true when iOS permissions are newly granted', async () => {
        (PushNotification.checkPermissions as jest.Mock).mockImplementation((callback) => {
          callback({ alert: false, badge: false, sound: false });
        });
        
        (PushNotification.requestPermissions as jest.Mock).mockResolvedValue(['alert', 'badge', 'sound']);

        const result = await service.requestPermissions();
        
        expect(result).toBe(true);
        expect(PushNotification.requestPermissions).toHaveBeenCalledWith(['alert', 'badge', 'sound']);
      });

      it('should return false when iOS permissions are denied', async () => {
        (PushNotification.checkPermissions as jest.Mock).mockImplementation((callback) => {
          callback({ alert: false, badge: false, sound: false });
        });
        
        (PushNotification.requestPermissions as jest.Mock).mockResolvedValue(null);

        const result = await service.requestPermissions();
        
        expect(result).toBe(false);
      });

      it('should handle partial iOS permissions gracefully', async () => {
        (PushNotification.checkPermissions as jest.Mock).mockImplementation((callback) => {
          // Only alert granted, missing sound
          callback({ alert: true, badge: true, sound: false });
        });
        
        (PushNotification.requestPermissions as jest.Mock).mockResolvedValue(['alert', 'badge', 'sound']);

        const result = await service.requestPermissions();
        
        expect(result).toBe(true);
        expect(PushNotification.requestPermissions).toHaveBeenCalled();
      });
    });

    describe('Permission errors', () => {
      it('should handle permission request failures gracefully', async () => {
        Object.defineProperty(Platform, 'OS', {
          get: () => 'ios',
          configurable: true,
        });

        // Mock checkPermissions to show permissions not granted
        (PushNotification.checkPermissions as jest.Mock).mockImplementation((callback) => {
          callback({ alert: false, badge: false, sound: false });
        });
        
        // Mock requestPermissions to return null (denied)
        (PushNotification.requestPermissions as jest.Mock).mockResolvedValue(null);

        const result = await service.requestPermissions();
        
        // When permissions are denied, should return false
        expect(result).toBe(false);
        expect(PushNotification.checkPermissions).toHaveBeenCalled();
        expect(PushNotification.requestPermissions).toHaveBeenCalled();
      });

      it('should continue sending notifications even if permissions were not explicitly granted', async () => {
        service.configure();
        
        const payload: TransactionNotificationPayload = {
          amount: 500,
          counterpartyVpa: 'test@okhdfc',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-no-perm',
        };

        // Should not throw even without explicit permission grant
        await expect(
          service.sendTransactionNotification(payload, 'sender'),
        ).resolves.not.toThrow();
        
        expect(PushNotification.localNotification).toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests - Timeout and Failure Handling', () => {
    let service: NotificationService;

    beforeEach(() => {
      service = new NotificationService();
      service.configure();
      jest.clearAllMocks();
      // Don't use fake timers by default - individual tests will opt in
    });

    afterEach(() => {
      // Ensure timers are reset after each test
      if (jest.isMockFunction(setTimeout)) {
        jest.useRealTimers();
      }
    });

    describe('Timeout scenarios (Requirement 1.9)', () => {
      beforeEach(() => {
        jest.useRealTimers(); // Use real timers for timeout tests
      });

      it('should complete notification send within timeout period', async () => {
        // Mock localNotification to resolve immediately
        (PushNotification.localNotification as jest.Mock).mockResolvedValue(undefined);

        const payload: TransactionNotificationPayload = {
          amount: 1000,
          counterpartyVpa: 'test@okhdfc',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-success-fast',
        };

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        // Should complete successfully without timing out
        await service.sendTransactionNotification(payload, 'sender');

        // Should log success, not timeout error
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Notification sent for txn txn-success-fast')
        );

        consoleSpy.mockRestore();
      });

      it('should succeed if notification completes within 2 seconds', async () => {
        jest.useFakeTimers(); // Use fake timers for this test
        
        // Mock localNotification to resolve quickly
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          return Promise.resolve();
        });

        const payload: TransactionNotificationPayload = {
          amount: 1000,
          counterpartyVpa: 'test@okhdfc',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-success-001',
        };

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await service.sendTransactionNotification(payload, 'sender');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Notification sent for txn txn-success-001'),
        );

        consoleSpy.mockRestore();
        jest.useRealTimers();
      });

      it('should not block transaction completion on timeout', async () => {
        jest.useFakeTimers(); // Use fake timers for this test
        
        // Mock localNotification to timeout
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          return new Promise(() => {
            // Never resolves
          });
        });

        const payload: TransactionNotificationPayload = {
          amount: 5000,
          counterpartyVpa: 'merchant@paytm',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-no-block',
        };

        const notificationPromise = service.sendTransactionNotification(payload, 'sender');
        
        jest.advanceTimersByTime(2100);
        
        // Should resolve without throwing
        await expect(notificationPromise).resolves.not.toThrow();
        
        jest.useRealTimers();
      });
    });

    describe('Failure handling scenarios (Requirement 1.9)', () => {
      beforeEach(() => {
        jest.useRealTimers(); // Use real timers for error scenarios
      });

      it('should log error without throwing when notification fails', async () => {
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          throw new Error('Notification API failed');
        });

        const payload: TransactionNotificationPayload = {
          amount: 1000,
          counterpartyVpa: 'test@okhdfc',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-error-001',
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        // Should not throw
        await service.sendTransactionNotification(payload, 'sender');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to send notification for txn txn-error-001'),
          'Notification API failed',
        );

        consoleSpy.mockRestore();
      });

      it('should handle network errors gracefully', async () => {
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          throw new Error('Network request failed');
        });

        const payload: TransactionNotificationPayload = {
          amount: 2500,
          counterpartyVpa: 'user@bank',
          status: 'REVIEW',
          fraudScore: 0.7,
          timestamp: new Date(),
          txnId: 'txn-network-error',
        };

        await expect(
          service.sendTransactionNotification(payload, 'sender'),
        ).resolves.not.toThrow();
      });

      it('should handle notification service unavailable errors', async () => {
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          throw new Error('Service unavailable');
        });

        const payload: TransactionNotificationPayload = {
          amount: 7500,
          counterpartyVpa: 'merchant@service',
          status: 'REJECT',
          fraudScore: 0.92,
          timestamp: new Date(),
          txnId: 'txn-unavailable',
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await service.sendTransactionNotification(payload, 'sender');

        expect(consoleSpy).toHaveBeenCalled();
        expect(PushNotification.localNotification).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should handle malformed notification data errors', async () => {
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid notification object');
        });

        const payload: TransactionNotificationPayload = {
          amount: 0, // Edge case: zero amount
          counterpartyVpa: '',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-malformed',
        };

        await expect(
          service.sendTransactionNotification(payload, 'sender'),
        ).resolves.not.toThrow();
      });

      it('should continue processing after multiple failures', async () => {
        let callCount = 0;
        (PushNotification.localNotification as jest.Mock).mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Temporary failure');
          }
          return Promise.resolve();
        });

        const payloads: TransactionNotificationPayload[] = [
          {
            amount: 1000,
            counterpartyVpa: 'user1@bank',
            status: 'APPROVE',
            timestamp: new Date(),
            txnId: 'txn-multi-001',
          },
          {
            amount: 2000,
            counterpartyVpa: 'user2@bank',
            status: 'REVIEW',
            fraudScore: 0.5,
            timestamp: new Date(),
            txnId: 'txn-multi-002',
          },
          {
            amount: 3000,
            counterpartyVpa: 'user3@bank',
            status: 'APPROVE',
            timestamp: new Date(),
            txnId: 'txn-multi-003',
          },
        ];

        // All should complete without throwing
        await Promise.all(
          payloads.map(payload => service.sendTransactionNotification(payload, 'sender')),
        );

        expect(PushNotification.localNotification).toHaveBeenCalledTimes(3);
      });
    });

    describe('Auto-configuration on first notification', () => {
      it('should auto-configure if not already configured before sending notification', async () => {
        const freshService = new NotificationService();
        // Don't call configure()

        const payload: TransactionNotificationPayload = {
          amount: 1000,
          counterpartyVpa: 'test@okhdfc',
          status: 'APPROVE',
          timestamp: new Date(),
          txnId: 'txn-auto-config',
        };

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        await freshService.sendTransactionNotification(payload, 'sender');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Not configured'),
        );
        expect(PushNotification.configure).toHaveBeenCalled();
        expect(PushNotification.localNotification).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });
});
