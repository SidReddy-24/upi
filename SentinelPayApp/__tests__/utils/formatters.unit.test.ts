/**
 * formatters.unit.test.ts
 * 
 * Example-based unit tests for formatters.
 * Phase 9: SentinelPay Advanced Features Enhancement
 * 
 * These tests verify specific edge cases and examples.
 */

import {
  formatTransactionNotification,
  parseTransactionNotification,
  formatGuardianApprovalRequest,
  parseGuardianApprovalRequest,
  parseJwt,
} from '../../src/utils/formatters';
import { TransactionNotification, GuardianApprovalMessage } from '../../src/types';

describe('Transaction Notification Formatter - Unit Tests', () => {
  test('should format a simple approved transaction', () => {
    const txn: TransactionNotification = {
      amount: 5000,
      counterpartyVpa: 'merchant@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('₹5,000');
    expect(result).toContain('APPROVED');
    expect(result).toContain('merchant@paytm');
    expect(result.length).toBeLessThanOrEqual(160);
  });

  test('should format a flagged transaction with fraud score', () => {
    const txn: TransactionNotification = {
      amount: 10000,
      counterpartyVpa: 'fraudster@unknown',
      status: 'FLAGGED',
      fraudScore: 0.85,
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('₹10,000');
    expect(result).toContain('FLAGGED');
    expect(result).toContain('[85%]');
    expect(result).toContain('fraudster@unknown');
  });

  test('should truncate long VPAs while preserving domain', () => {
    const txn: TransactionNotification = {
      amount: 100,
      counterpartyVpa: 'verylongusernamethatexceedslimit@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('@paytm');
    expect(result.length).toBeLessThanOrEqual(160);
  });

  test('should round-trip a transaction notification', () => {
    const original: TransactionNotification = {
      amount: 7500.50,
      counterpartyVpa: 'user@okhdfc',
      status: 'FLAGGED',
      fraudScore: 0.65,
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const formatted = formatTransactionNotification(original);
    const parsed = parseTransactionNotification(formatted);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe('FLAGGED');
    expect(parsed?.counterpartyVpa).toContain('@okhdfc');
  });

  test('should omit fraud score when <= 0.5', () => {
    const txn: TransactionNotification = {
      amount: 1000,
      counterpartyVpa: 'user@paytm',
      status: 'APPROVED',
      fraudScore: 0.5,
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).not.toContain('[');
    expect(result).not.toContain('%');
    expect(result).toContain('₹1,000');
    expect(result).toContain('APPROVED');
  });

  test('should handle missing optional fraud score', () => {
    const txn: TransactionNotification = {
      amount: 2500,
      counterpartyVpa: 'shop@paytm',
      status: 'BLOCKED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).not.toContain('[');
    expect(result).not.toContain('%');
    expect(result).toContain('BLOCKED');
  });

  test('should handle boundary fraud score (0.51)', () => {
    const txn: TransactionNotification = {
      amount: 500,
      counterpartyVpa: 'user@okhdfc',
      status: 'FLAGGED',
      fraudScore: 0.51,
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('[51%]');
  });

  test('should handle very long VPA username', () => {
    const txn: TransactionNotification = {
      amount: 100,
      counterpartyVpa: 'thisissuchaverylongusernamethatdefinitelyexceedsanylimitwecouldsetfortesting@bankname',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('@bankname'); // Domain preserved
    expect(result.length).toBeLessThanOrEqual(160);
  });

  test('should handle decimal amounts', () => {
    const txn: TransactionNotification = {
      amount: 123.45,
      counterpartyVpa: 'shop@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('₹123.45');
  });

  test('should handle large amounts', () => {
    const txn: TransactionNotification = {
      amount: 99999.99,
      counterpartyVpa: 'business@bank',
      status: 'FLAGGED',
      fraudScore: 0.95,
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const result = formatTransactionNotification(txn);
    
    expect(result).toContain('₹99,999.99');
    expect(result).toContain('[95%]');
    expect(result.length).toBeLessThanOrEqual(160);
  });

  test('should throw error for missing amount', () => {
    const txn = {
      counterpartyVpa: 'user@paytm',
      status: 'APPROVED' as const,
      timestamp: new Date('2024-07-21T14:30:00'),
    } as any;

    expect(() => formatTransactionNotification(txn)).toThrow('Missing required field: amount');
  });

  test('should throw error for missing counterpartyVpa', () => {
    const txn = {
      amount: 1000,
      status: 'APPROVED' as const,
      timestamp: new Date('2024-07-21T14:30:00'),
    } as any;

    expect(() => formatTransactionNotification(txn)).toThrow('Missing required field: counterpartyVpa');
  });

  test('should throw error for missing status', () => {
    const txn = {
      amount: 1000,
      counterpartyVpa: 'user@paytm',
      timestamp: new Date('2024-07-21T14:30:00'),
    } as any;

    expect(() => formatTransactionNotification(txn)).toThrow('Missing required field: status');
  });

  test('should throw error for missing timestamp', () => {
    const txn = {
      amount: 1000,
      counterpartyVpa: 'user@paytm',
      status: 'APPROVED' as const,
    } as any;

    expect(() => formatTransactionNotification(txn)).toThrow('Missing required field: timestamp');
  });

  test('should parse formatted message without fraud score', () => {
    const message = '₹1,000 APPROVED to user@paytm on 21 Jul, 14:30';
    
    const parsed = parseTransactionNotification(message);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1000);
    expect(parsed?.status).toBe('APPROVED');
    expect(parsed?.counterpartyVpa).toBe('user@paytm');
    expect(parsed?.fraudScore).toBeUndefined();
  });

  test('should parse formatted message with fraud score', () => {
    const message = '₹5,000 FLAGGED to merchant@paytm [72%] on 21 Jul, 14:30';
    
    const parsed = parseTransactionNotification(message);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(5000);
    expect(parsed?.status).toBe('FLAGGED');
    expect(parsed?.counterpartyVpa).toBe('merchant@paytm');
    expect(parsed?.fraudScore).toBe(0.72);
  });

  test('should return null for invalid message format', () => {
    const message = 'This is not a valid transaction notification';
    
    const parsed = parseTransactionNotification(message);
    
    expect(parsed).toBeNull();
  });

  test('should preserve VPA domain in round-trip with truncation', () => {
    const original: TransactionNotification = {
      amount: 100,
      counterpartyVpa: 'verylongusernamethatexceedslimit@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T14:30:00'),
    };

    const formatted = formatTransactionNotification(original);
    const parsed = parseTransactionNotification(formatted);

    expect(parsed).not.toBeNull();
    expect(parsed?.counterpartyVpa).toContain('@paytm'); // Domain preserved
  });

  test('should handle timestamp with different times of day', () => {
    const txnMorning: TransactionNotification = {
      amount: 100,
      counterpartyVpa: 'user@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T08:05:00'),
    };

    const resultMorning = formatTransactionNotification(txnMorning);
    expect(resultMorning).toContain('08:05');

    const txnEvening: TransactionNotification = {
      amount: 100,
      counterpartyVpa: 'user@paytm',
      status: 'APPROVED',
      timestamp: new Date('2024-07-21T23:45:00'),
    };

    const resultEvening = formatTransactionNotification(txnEvening);
    expect(resultEvening).toContain('23:45');
  });
});

describe('Guardian Approval Formatter - Unit Tests', () => {
  test('should format a high-risk approval request', () => {
    const msg: GuardianApprovalMessage = {
      amount: 10000,
      recipientVpa: 'fraudster@unknown',
      fraudScore: 0.85,
      riskSignals: ['BLACKLISTED_VPA', 'CALL_DURING_PAYMENT'],
      requesterName: 'Demo User',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    expect(result).toContain('⚠️ APPROVAL NEEDED');
    expect(result).toContain('₹10,000');
    expect(result).toContain('fraudster@unknown');
    expect(result).toContain('85%');
    expect(result).toContain('🔴');
    expect(result).toContain('⚠️ BLACKLISTED_VPA');
    expect(result).toContain('⚠️ CALL_DURING_PAYMENT');
    expect(result).toContain('Demo User');
  });

  test('should use green indicator for low-risk transaction', () => {
    const msg: GuardianApprovalMessage = {
      amount: 500,
      recipientVpa: 'friend@paytm',
      fraudScore: 0.15,
      riskSignals: [],
      requesterName: 'John Doe',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    expect(result).toContain('🟢');
    expect(result).toContain('15%');
  });

  test('should use yellow indicator for medium-risk transaction', () => {
    const msg: GuardianApprovalMessage = {
      amount: 5000,
      recipientVpa: 'merchant@paytm',
      fraudScore: 0.55,
      riskSignals: ['VELOCITY_EXCEEDED'],
      requesterName: 'Jane Smith',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    expect(result).toContain('🟡');
    expect(result).toContain('55%');
  });

  test('should handle boundary fraud score for color indicators (0.3)', () => {
    const msg: GuardianApprovalMessage = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      fraudScore: 0.3,
      riskSignals: [],
      requesterName: 'Test User',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    // At exactly 0.3, should use yellow (0.3 is NOT < 0.3)
    expect(result).toContain('🟡');
    expect(result).toContain('30%');
  });

  test('should handle boundary fraud score for color indicators (0.7)', () => {
    const msg: GuardianApprovalMessage = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      fraudScore: 0.7,
      riskSignals: [],
      requesterName: 'Test User',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    // At exactly 0.7, should use red (0.7 is NOT < 0.7)
    expect(result).toContain('🔴');
    expect(result).toContain('70%');
  });

  test('should handle empty risk signals array', () => {
    const msg: GuardianApprovalMessage = {
      amount: 500,
      recipientVpa: 'friend@paytm',
      fraudScore: 0.15,
      riskSignals: [],
      requesterName: 'John Doe',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    expect(result).toContain('⚠️ APPROVAL NEEDED');
    expect(result).toContain('John Doe');
    expect(result).toContain('friend@paytm');
    // Should not crash with empty signals
  });

  test('should handle multiple risk signals', () => {
    const msg: GuardianApprovalMessage = {
      amount: 10000,
      recipientVpa: 'scammer@unknown',
      fraudScore: 0.92,
      riskSignals: ['BLACKLISTED_VPA', 'CALL_DURING_PAYMENT', 'VELOCITY_EXCEEDED', 'NEW_DEVICE'],
      requesterName: 'Test User',
    };

    const result = formatGuardianApprovalRequest(msg);
    
    expect(result).toContain('⚠️ BLACKLISTED_VPA');
    expect(result).toContain('⚠️ CALL_DURING_PAYMENT');
    expect(result).toContain('⚠️ VELOCITY_EXCEEDED');
    expect(result).toContain('⚠️ NEW_DEVICE');
  });

  test('should throw error for missing amount', () => {
    const msg = {
      recipientVpa: 'user@paytm',
      fraudScore: 0.5,
      riskSignals: [],
      requesterName: 'Test',
    } as any;

    expect(() => formatGuardianApprovalRequest(msg)).toThrow('Missing required field: amount');
  });

  test('should throw error for missing recipientVpa', () => {
    const msg = {
      amount: 1000,
      fraudScore: 0.5,
      riskSignals: [],
      requesterName: 'Test',
    } as any;

    expect(() => formatGuardianApprovalRequest(msg)).toThrow('Missing required field: recipientVpa');
  });

  test('should throw error for missing fraudScore', () => {
    const msg = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      riskSignals: [],
      requesterName: 'Test',
    } as any;

    expect(() => formatGuardianApprovalRequest(msg)).toThrow('Missing required field: fraudScore');
  });

  test('should throw error for missing riskSignals', () => {
    const msg = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      fraudScore: 0.5,
      requesterName: 'Test',
    } as any;

    expect(() => formatGuardianApprovalRequest(msg)).toThrow('Missing required field: riskSignals');
  });

  test('should throw error for missing requesterName', () => {
    const msg = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      fraudScore: 0.5,
      riskSignals: [],
    } as any;

    expect(() => formatGuardianApprovalRequest(msg)).toThrow('Missing required field: requesterName');
  });

  test('should round-trip a guardian approval request', () => {
    const msg: GuardianApprovalMessage = {
      amount: 10000,
      recipientVpa: 'fraudster@unknown',
      fraudScore: 0.85,
      riskSignals: ['BLACKLISTED_VPA', 'CALL_DURING_PAYMENT'],
      requesterName: 'Demo User',
    };

    const formatted = formatGuardianApprovalRequest(msg);
    const parsed = parseGuardianApprovalRequest(formatted);

    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(Math.abs(parsed.amount - msg.amount)).toBeLessThanOrEqual(0.01);
      expect(parsed.recipientVpa).toBe(msg.recipientVpa);
      expect(Math.abs(parsed.fraudScore - msg.fraudScore)).toBeLessThanOrEqual(0.01);
      
      const originalSignals = new Set(msg.riskSignals);
      const parsedSignals = new Set(parsed.riskSignals);
      expect(parsedSignals).toEqual(originalSignals);
      
      expect(parsed.requesterName).toBe(msg.requesterName);
    }
  });

  test('should round-trip with decimal amount', () => {
    const msg: GuardianApprovalMessage = {
      amount: 5432.10,
      recipientVpa: 'merchant@paytm',
      fraudScore: 0.45,
      riskSignals: ['VELOCITY_EXCEEDED'],
      requesterName: 'Jane Smith',
    };

    const formatted = formatGuardianApprovalRequest(msg);
    const parsed = parseGuardianApprovalRequest(formatted);

    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(Math.abs(parsed.amount - msg.amount)).toBeLessThanOrEqual(0.01);
    }
  });

  test('should parse with no risk signals', () => {
    const msg: GuardianApprovalMessage = {
      amount: 1000,
      recipientVpa: 'friend@paytm',
      fraudScore: 0.2,
      riskSignals: [],
      requesterName: 'John',
    };

    const formatted = formatGuardianApprovalRequest(msg);
    const parsed = parseGuardianApprovalRequest(formatted);

    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.riskSignals).toEqual([]);
    }
  });

  test('should return null for invalid formatted message', () => {
    const invalidMessage = 'This is not a valid guardian approval request';
    
    const parsed = parseGuardianApprovalRequest(invalidMessage);
    
    expect(parsed).toBeNull();
  });

  test('should handle requester name with spaces', () => {
    const msg: GuardianApprovalMessage = {
      amount: 1000,
      recipientVpa: 'user@paytm',
      fraudScore: 0.5,
      riskSignals: ['TEST_SIGNAL'],
      requesterName: 'John David Smith',
    };

    const formatted = formatGuardianApprovalRequest(msg);
    const parsed = parseGuardianApprovalRequest(formatted);

    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.requesterName).toBe('John David Smith');
    }
  });
});

describe('JWT Parser - Unit Tests', () => {
  test('should parse a valid JWT token', () => {
    // This is a sample JWT token for testing (not a real secret)
    const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2IiwicGhvbmUiOiI5ODc2NTQzMjEwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNzIxNTc3NjAwfQ.dummysignature';
    
    const parsed = parseJwt(sampleToken);
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.user_id).toBe('123456');
      expect(parsed.phone).toBe('9876543210');
      expect(parsed.email).toBe('test@example.com');
    }
  });

  test('should return null for invalid JWT token', () => {
    const invalidToken = 'not.a.valid.jwt';
    
    const parsed = parseJwt(invalidToken);
    
    expect(parsed).toBeNull();
  });

  test('should return null for token with only 2 parts', () => {
    const invalidToken = 'header.payload';
    
    const parsed = parseJwt(invalidToken);
    
    expect(parsed).toBeNull();
  });

  test('should return null for empty string', () => {
    const parsed = parseJwt('');
    
    expect(parsed).toBeNull();
  });

  test('should return null for non-string input', () => {
    const parsed = parseJwt(null as any);
    
    expect(parsed).toBeNull();
  });

  test('should parse token without email field', () => {
    // JWT without email field
    const tokenNoEmail = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2IiwicGhvbmUiOiI5ODc2NTQzMjEwIiwiZXhwIjoxNzIxNTc3NjAwfQ.dummysignature';
    
    const parsed = parseJwt(tokenNoEmail);
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.user_id).toBe('123456');
      expect(parsed.phone).toBe('9876543210');
      expect(parsed.email).toBeUndefined();
      expect(parsed.exp).toBe(1721577600);
    }
  });

  test('should return null for token with missing required fields', () => {
    // JWT missing phone field
    const tokenMissingPhone = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2IiwiZXhwIjoxNzIxNTc3NjAwfQ.dummysignature';
    
    const parsed = parseJwt(tokenMissingPhone);
    
    expect(parsed).toBeNull();
  });

  test('should return null for malformed base64 payload', () => {
    const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.notvalidbase64!!!.dummysignature';
    
    const parsed = parseJwt(malformedToken);
    
    expect(parsed).toBeNull();
  });
});
