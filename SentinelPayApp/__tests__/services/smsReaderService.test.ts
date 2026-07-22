/**
 * smsReaderService.test.ts — Integration tests for SMS Reader Service
 *
 * Task 5.4: Write integration tests for SMS reader service
 * Requirements: 6.11, 6.13, 6.15
 *
 * Test Coverage:
 * - Permission handling (Android granted/denied, iOS not supported)
 * - Message classification (SAFE, SUSPICIOUS, DANGEROUS)
 * - Trusted sender pattern matching
 * - OTP keyword detection
 * - Warning notification delivery
 * - End-to-end SMS monitoring flow
 */

// Mock react-native-push-notification BEFORE imports
// Note: Can't use const here because jest.mock is hoisted
jest.mock('react-native-push-notification', () => {
  const mockLocalNotification = jest.fn();
  const mock = {
    createChannel: jest.fn(),
    configure: jest.fn(),
    localNotification: mockLocalNotification,
    cancelAllLocalNotifications: jest.fn(),
    cancelLocalNotification: jest.fn(),
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
  };
  // Return both the object and as default for compatibility
  return {
    __esModule: true,
    default: mock,
    ...mock,
  };
});

// Mock React Native modules BEFORE imports
jest.mock('react-native', () => ({
  NativeModules: {
    SmsReceiverModule: {
      startListening: jest.fn(),
      stopListening: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn(),
  PermissionsAndroid: {
    PERMISSIONS: {
      READ_SMS: 'android.permission.READ_SMS',
      RECEIVE_SMS: 'android.permission.RECEIVE_SMS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    requestMultiple: jest.fn(),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((obj: any) => obj.android),
  },
}));

// NOW import the modules AFTER mocks are set up
import SmsReaderService, { smsReaderService, SmsMessage, SmsClassificationResult } from '../../src/services/smsReaderService';
import { NativeModules, NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

// Get the mock function for assertions
const mockLocalNotification = PushNotification.localNotification as jest.Mock;

describe('SmsReaderService', () => {
  let mockEventEmitter: any;
  let mockAddListener: jest.Mock;
  let mockRemoveListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up event emitter mock
    mockAddListener = jest.fn();
    mockRemoveListener = jest.fn();
    mockEventEmitter = {
      addListener: mockAddListener,
      removeAllListeners: jest.fn(),
    };
    (NativeEventEmitter as jest.Mock).mockImplementation(() => mockEventEmitter);
  });

  // ─── Permission Tests ───────────────────────────────────────────────────────

  describe('requestPermissions', () => {
    it('should request READ_SMS and RECEIVE_SMS permissions on Android', async () => {
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.READ_SMS': PermissionsAndroid.RESULTS.GRANTED,
        'android.permission.RECEIVE_SMS': PermissionsAndroid.RESULTS.GRANTED,
      });

      const service = new SmsReaderService();
      const result = await service.requestPermissions();

      expect(result).toBe(true);
      expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);
    });

    it('should return false if permissions are denied', async () => {
      (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
        'android.permission.READ_SMS': PermissionsAndroid.RESULTS.DENIED,
        'android.permission.RECEIVE_SMS': PermissionsAndroid.RESULTS.GRANTED,
      });

      const service = new SmsReaderService();
      const result = await service.requestPermissions();

      expect(result).toBe(false);
    });

    it('should return false on iOS', async () => {
      (Platform as any).OS = 'ios';

      const service = new SmsReaderService();
      const result = await service.requestPermissions();

      expect(result).toBe(false);

      // Reset to Android for other tests
      (Platform as any).OS = 'android';
    });
  });

  // ─── Classification Tests ───────────────────────────────────────────────────

  describe('classifyMessage', () => {
    let service: SmsReaderService;

    beforeEach(() => {
      service = new SmsReaderService();
    });

    it('should classify high fraud score message as DANGEROUS', async () => {
      const message: SmsMessage = {
        sender: 'UNKNOWN',
        body: 'You have won a lottery!',
        timestamp: Date.now(),
        fraudScore: 0.85,
      };

      const result = await service.classifyMessage(message);

      expect(result.riskLevel).toBe('DANGEROUS');
      expect(result.fraudScore).toBe(0.85);
      expect(result.confidence).toBe(0.85);
    });

    it('should classify OTP from untrusted sender as DANGEROUS', async () => {
      const message: SmsMessage = {
        sender: '+1234567890',
        body: 'Your OTP is 123456. Please share it with our agent.',
        timestamp: Date.now(),
        fraudScore: 0.2,
      };

      const result = await service.classifyMessage(message);

      expect(result.riskLevel).toBe('DANGEROUS');
      expect(result.containsOtp).toBe(true);
      expect(result.isTrustedSender).toBe(false);
    });

    it('should classify medium fraud score as SUSPICIOUS', async () => {
      const message: SmsMessage = {
        sender: 'MARKETING',
        body: 'Limited time offer! Click here to claim.',
        timestamp: Date.now(),
        fraudScore: 0.5,
      };

      const result = await service.classifyMessage(message);

      expect(result.riskLevel).toBe('SUSPICIOUS');
      expect(result.fraudScore).toBe(0.5);
    });

    it('should classify OTP from trusted sender as SAFE', async () => {
      const message: SmsMessage = {
        sender: 'HD-HDFCBK',
        body: 'Your OTP for HDFC Bank transaction is 456789. Valid for 5 minutes.',
        timestamp: Date.now(),
        fraudScore: 0.1,
      };

      const result = await service.classifyMessage(message);

      expect(result.riskLevel).toBe('SAFE');
      expect(result.containsOtp).toBe(true);
      expect(result.isTrustedSender).toBe(true);
    });

    it('should classify low fraud score without OTP as SAFE', async () => {
      const message: SmsMessage = {
        sender: 'FRIEND',
        body: 'Hey, are we still meeting for lunch?',
        timestamp: Date.now(),
        fraudScore: 0.05,
      };

      const result = await service.classifyMessage(message);

      expect(result.riskLevel).toBe('SAFE');
      expect(result.containsOtp).toBe(false);
      expect(result.fraudScore).toBe(0.05);
    });
  });

  // ─── Trusted Sender Detection Tests ────────────────────────────────────────

  describe('checkTrustedSender', () => {
    let service: SmsReaderService;

    beforeEach(() => {
      service = new SmsReaderService();
    });

    it('should recognize bank sender ID pattern [A-Z]{2}-[A-Z]{6}', async () => {
      const bankSenders = [
        'HD-HDFCBK',
        'AX-HDFCBK', // Axis Bank using HDFC pattern
        'SB-SBIINB',
        'KB-KOTAKB',
        'YB-YESBNK',
      ];

      for (const sender of bankSenders) {
        const message: SmsMessage = {
          sender,
          body: 'Test message',
          timestamp: Date.now(),
          fraudScore: 0.0,
        };
        const result = await service.classifyMessage(message);
        expect(result.isTrustedSender).toBe(true);
      }
    });

    it('should recognize known bank short codes', async () => {
      const shortCodes = ['600000', '500000', '400000', '700000', '800000'];

      for (const sender of shortCodes) {
        const message: SmsMessage = {
          sender,
          body: 'Test message',
          timestamp: Date.now(),
          fraudScore: 0.0,
        };
        const result = await service.classifyMessage(message);
        expect(result.isTrustedSender).toBe(true);
      }
    });

    it('should recognize known service names', async () => {
      const services = ['HDFCBK', 'ICICIB', 'PAYTM', 'GOOGLEPAY', 'PHONEPE'];

      for (const sender of services) {
        const message: SmsMessage = {
          sender,
          body: 'Test message',
          timestamp: Date.now(),
          fraudScore: 0.0,
        };
        const result = await service.classifyMessage(message);
        expect(result.isTrustedSender).toBe(true);
      }
    });

    it('should recognize bank names within sender IDs (fallback pattern)', async () => {
      // Test ICICI variations
      let message: SmsMessage = {
        sender: 'ICICI',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };
      let result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(false); // ICICI alone is not in the list, only ICICIB

      // Test ICICIB
      message = {
        sender: 'ICICIB',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };
      result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(true);

      // Test VM-HDFCBK (contains HDFCBK)
      message = {
        sender: 'VM-HDFCBK',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };
      result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(true);

      // Test AXISBK
      message = {
        sender: 'AXISBK',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };
      result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(true);
    });

    it('should not trust random phone numbers', async () => {
      const message: SmsMessage = {
        sender: '+919876543210',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(false);
    });

    it('should handle empty sender gracefully', async () => {
      const message: SmsMessage = {
        sender: '',
        body: 'Test message',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.isTrustedSender).toBe(false);
    });
  });

  // ─── OTP Keyword Detection Tests ────────────────────────────────────────────

  describe('containsOtpKeywords', () => {
    let service: SmsReaderService;

    beforeEach(() => {
      service = new SmsReaderService();
    });

    it('should detect "OTP" keyword', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Your OTP is 123456',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });

    it('should detect "verification code" keyword', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Your verification code is 789012',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });

    it('should detect "one time password" keyword', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Use this one time password: 345678',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });

    it('should detect "authentication code" keyword', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Your authentication code is 901234',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });

    it('should detect "passcode" keyword', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Your passcode is 567890',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });

    it('should not detect OTP in normal messages', async () => {
      const message: SmsMessage = {
        sender: 'FRIEND',
        body: 'Hey, see you at the party tonight!',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(false);
    });

    it('should be case-insensitive', async () => {
      const message: SmsMessage = {
        sender: 'TEST',
        body: 'Your oTp is 123456',
        timestamp: Date.now(),
        fraudScore: 0.0,
      };

      const result = await service.classifyMessage(message);
      expect(result.containsOtp).toBe(true);
    });
  });

  // ─── Lifecycle Tests ────────────────────────────────────────────────────────

  describe('startMonitoring and stopMonitoring', () => {
    it('should start monitoring and set up event listener', () => {
      const service = new SmsReaderService();
      
      mockAddListener.mockReturnValue({ remove: mockRemoveListener });

      service.startMonitoring();

      expect(NativeEventEmitter).toHaveBeenCalledWith(NativeModules.SmsReceiverModule);
      expect(mockAddListener).toHaveBeenCalledWith('onSmsReceived', expect.any(Function));
      expect(NativeModules.SmsReceiverModule.startListening).toHaveBeenCalled();
      expect(service.isActive()).toBe(true);
    });

    it('should stop monitoring and clean up listener', () => {
      const service = new SmsReaderService();
      
      mockAddListener.mockReturnValue({ remove: mockRemoveListener });

      service.startMonitoring();
      service.stopMonitoring();

      expect(NativeModules.SmsReceiverModule.stopListening).toHaveBeenCalled();
      expect(service.isActive()).toBe(false);
    });

    it('should not start monitoring if already active', () => {
      const service = new SmsReaderService();
      
      mockAddListener.mockReturnValue({ remove: mockRemoveListener });

      service.startMonitoring();
      service.startMonitoring(); // Second call

      expect(mockAddListener).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Warning Notification Integration Tests (Task 5.3) ──────────────────────

  describe('sendWarningNotification (Task 5.3)', () => {
    let service: SmsReaderService;

    beforeEach(() => {
      service = new SmsReaderService();
      mockLocalNotification.mockClear();
      
      // Set up event emitter for handleSmsReceived
      mockAddListener.mockReturnValue({ remove: mockRemoveListener });
    });

    it('should send warning notification for DANGEROUS SMS with OTP from untrusted sender', async () => {
      service.startMonitoring();

      // Get the event handler registered with addListener
      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      // Simulate SMS received event with DANGEROUS characteristics
      const dangerousSms = {
        sender: '+919876543210',
        body: 'Your OTP is 123456. Please share it with our support agent to verify your account.',
        timestamp: Date.now(),
        fraudScore: 0.3, // Low fraud score, but OTP from untrusted sender = DANGEROUS
      };

      // Trigger the event handler
      await smsReceivedHandler(dangerousSms);

      // Wait for async notification sending
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notification was sent
      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
      
      const notificationCall = mockLocalNotification.mock.calls[0][0];
      
      // Verify notification structure (Requirement 6.8, 6.9, 6.10)
      expect(notificationCall.title).toContain('🚨'); // DANGEROUS emoji
      expect(notificationCall.title).toContain('HIGH RISK');
      expect(notificationCall.message).toContain('+919876543210'); // Sender info
      expect(notificationCall.message).toContain('DO NOT share this OTP'); // Advice
      expect(notificationCall.actions).toEqual(['view_details', 'mark_safe']); // Actions
      expect(notificationCall.color).toBe('#ef4444'); // Red for dangerous
    });

    it('should send warning notification for SUSPICIOUS SMS with medium fraud score', async () => {
      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const suspiciousSms = {
        sender: 'MARKETING',
        body: 'Congratulations! You have won a lottery. Click here to claim your prize.',
        timestamp: Date.now(),
        fraudScore: 0.5, // Medium fraud score = SUSPICIOUS
      };

      await smsReceivedHandler(suspiciousSms);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
      
      const notificationCall = mockLocalNotification.mock.calls[0][0];
      
      expect(notificationCall.title).toContain('⚠️'); // SUSPICIOUS emoji
      expect(notificationCall.title).toContain('SUSPICIOUS');
      expect(notificationCall.message).toContain('MARKETING'); // Sender
      expect(notificationCall.message).toContain('Be cautious'); // Advice for suspicious
      expect(notificationCall.actions).toEqual(['view_details', 'mark_safe']);
      expect(notificationCall.color).toBe('#fbbf24'); // Yellow for suspicious
    });

    it('should NOT send notification for SAFE SMS from trusted sender', async () => {
      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const safeSms = {
        sender: 'HD-HDFCBK',
        body: 'Your OTP for HDFC Bank transaction is 789012. Valid for 5 minutes.',
        timestamp: Date.now(),
        fraudScore: 0.1, // Low fraud score + trusted sender = SAFE
      };

      await smsReceivedHandler(safeSms);
      await new Promise(resolve => setTimeout(resolve, 100));

      // No notification should be sent for SAFE messages
      expect(mockLocalNotification).not.toHaveBeenCalled();
    });

    it('should truncate sender ID if longer than 30 chars (Requirement 6.9)', async () => {
      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const smsWithLongSender = {
        sender: 'ThisIsAVeryLongSenderNameThatExceeds30Characters',
        body: 'Suspicious message content',
        timestamp: Date.now(),
        fraudScore: 0.8, // DANGEROUS
      };

      await smsReceivedHandler(smsWithLongSender);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
      
      const notificationCall = mockLocalNotification.mock.calls[0][0];
      
      // Verify sender is truncated
      expect(notificationCall.message).toContain('ThisIsAVeryLongSenderNameThatE...'); // Truncated to 30 chars
      expect(notificationCall.message).not.toContain('ThisIsAVeryLongSenderNameThatExceeds30Characters'); // Full sender not present
    });

    it('should truncate message body to 100 chars for preview', async () => {
      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const longMessage = 'A'.repeat(150); // 150 character message

      const smsWithLongBody = {
        sender: 'SPAM',
        body: longMessage,
        timestamp: Date.now(),
        fraudScore: 0.9, // DANGEROUS
      };

      await smsReceivedHandler(smsWithLongBody);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
      
      const notificationCall = mockLocalNotification.mock.calls[0][0];
      
      // Verify body is truncated to 100 chars
      expect(notificationCall.message).toContain('A'.repeat(100) + '...'); // Truncated
    });

    it('should handle notification failures gracefully without throwing (Requirement 6.11)', async () => {
      // Mock notification to throw error
      mockLocalNotification.mockImplementationOnce(() => {
        throw new Error('Notification delivery failed');
      });

      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const dangerousSms = {
        sender: 'SCAM',
        body: 'Your OTP is 999999',
        timestamp: Date.now(),
        fraudScore: 0.95,
      };

      // This should NOT throw, just log the error
      await expect(smsReceivedHandler(dangerousSms)).resolves.not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Notification was attempted
      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
    });

    it('should include userInfo metadata for action handling', async () => {
      service.startMonitoring();

      const smsReceivedHandler = mockAddListener.mock.calls[0][1];

      const dangerousSms = {
        sender: 'FRAUD',
        body: 'Send us your OTP immediately',
        timestamp: 1234567890,
        fraudScore: 0.99,
      };

      await smsReceivedHandler(dangerousSms);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLocalNotification).toHaveBeenCalledTimes(1);
      
      const notificationCall = mockLocalNotification.mock.calls[0][0];
      
      // Verify userInfo contains necessary metadata
      expect(notificationCall.userInfo).toBeDefined();
      expect(notificationCall.userInfo.type).toBe('sms_warning');
      expect(notificationCall.userInfo.sender).toBe('FRAUD');
      expect(notificationCall.userInfo.timestamp).toBe(1234567890);
      expect(notificationCall.userInfo.riskLevel).toBe('DANGEROUS');
      expect(notificationCall.userInfo.containsOtp).toBe(true);
      expect(notificationCall.userInfo.isTrustedSender).toBe(false);
    });
  });
});
