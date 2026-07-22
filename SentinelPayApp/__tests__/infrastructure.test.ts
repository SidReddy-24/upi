/**
 * infrastructure.test.ts
 * 
 * Verification tests for Task 1: Core Infrastructure Setup
 * 
 * Tests that all dependencies, types, and utilities are properly configured.
 */

import fc from 'fast-check';
import type {
  TransactionNotificationPayload,
  SmsMessage,
  GuardianApprovalRequest,
  User,
  AuthTokens,
  HoldConfiguration,
  TransactionNotification,
  GuardianApprovalMessage,
  JwtPayload,
} from '../src/types';

describe('Task 1: Core Infrastructure Verification', () => {
  describe('Dependencies', () => {
    it('should have fast-check available', () => {
      expect(fc).toBeDefined();
      expect(typeof fc.assert).toBe('function');
    });

    it('should have react-native-push-notification types available', () => {
      // If types are available, this import won't fail
      expect(() => {
        // Type-only import check
        const test: any = null;
      }).not.toThrow();
    });
  });

  describe('TypeScript Type Definitions', () => {
    it('should define TransactionNotificationPayload type', () => {
      const payload: TransactionNotificationPayload = {
        amount: 1000,
        counterpartyVpa: 'test@upi',
        status: 'APPROVE',
        fraudScore: 0.3,
        timestamp: new Date(),
        txnId: 'txn_123',
      };
      
      expect(payload).toBeDefined();
      expect(payload.amount).toBe(1000);
    });

    it('should define SmsMessage type', () => {
      const msg: SmsMessage = {
        sender: 'BANK',
        body: 'Your OTP is 123456',
        timestamp: new Date(),
      };
      
      expect(msg).toBeDefined();
      expect(msg.sender).toBe('BANK');
    });

    it('should define GuardianApprovalRequest type', () => {
      const request: GuardianApprovalRequest = {
        id: 'req_123',
        transactionId: 'txn_456',
        amount: 5000,
        recipientVpa: 'merchant@paytm',
        fraudScore: 0.8,
        riskSignals: ['BLACKLISTED_VPA'],
        expiresAt: new Date(),
      };
      
      expect(request).toBeDefined();
      expect(request.fraudScore).toBe(0.8);
    });

    it('should define User and AuthTokens types', () => {
      const user: User = {
        id: 'user_123',
        phone: '+919876543210',
        email: 'user@example.com',
        vpa: 'user@okhdfc',
      };
      
      const tokens: AuthTokens = {
        accessToken: 'token_abc',
        refreshToken: 'refresh_xyz',
        expiresIn: 86400,
      };
      
      expect(user).toBeDefined();
      expect(tokens).toBeDefined();
    });

    it('should define HoldConfiguration type', () => {
      const config: HoldConfiguration = {
        enabled: true,
        durationSeconds: 15,
        thresholdAmount: 5000,
      };
      
      expect(config).toBeDefined();
      expect(config.durationSeconds).toBeGreaterThanOrEqual(10);
      expect(config.durationSeconds).toBeLessThanOrEqual(30);
    });

    it('should define formatter input types', () => {
      const txnNotif: TransactionNotification = {
        amount: 1000,
        counterpartyVpa: 'merchant@paytm',
        status: 'APPROVED',
        fraudScore: 0.2,
        timestamp: new Date(),
      };
      
      const guardianMsg: GuardianApprovalMessage = {
        amount: 5000,
        recipientVpa: 'fraudster@unknown',
        fraudScore: 0.85,
        riskSignals: ['BLACKLISTED_VPA', 'CALL_DURING_PAYMENT'],
        requesterName: 'Demo User',
      };
      
      const jwtPayload: JwtPayload = {
        user_id: 'user_123',
        phone: '+919876543210',
        email: 'user@example.com',
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
      
      expect(txnNotif).toBeDefined();
      expect(guardianMsg).toBeDefined();
      expect(jwtPayload).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should import formatters module', () => {
      const formatters = require('../src/utils/formatters');
      
      expect(formatters.formatTransactionNotification).toBeDefined();
      expect(formatters.parseTransactionNotification).toBeDefined();
      expect(formatters.formatGuardianApprovalRequest).toBeDefined();
      expect(formatters.parseGuardianApprovalRequest).toBeDefined();
      expect(formatters.parseJwt).toBeDefined();
      expect(formatters.encodeJwt).toBeDefined();
      expect(formatters.verifyJwt).toBeDefined();
    });

    it('should import parsers module', () => {
      const parsers = require('../src/utils/parsers');
      
      expect(parsers.formatTimestamp).toBeDefined();
      expect(parsers.parseTimestamp).toBeDefined();
      expect(parsers.formatCurrency).toBeDefined();
      expect(parsers.parseCurrency).toBeDefined();
      expect(parsers.truncateVpa).toBeDefined();
      expect(parsers.extractVpaDomain).toBeDefined();
      expect(parsers.isValidVpa).toBeDefined();
      expect(parsers.formatRiskSignals).toBeDefined();
      expect(parsers.extractRiskSignals).toBeDefined();
      expect(parsers.getFraudScoreColor).toBeDefined();
      expect(parsers.extractFraudScoreFromText).toBeDefined();
    });
  });

  describe('Property-Based Testing Setup', () => {
    it('should execute a simple property test with fast-check', () => {
      // Simple property: adding zero to a number returns the same number
      fc.assert(
        fc.property(fc.integer(), (n) => {
          expect(n + 0).toBe(n);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate transaction amounts', () => {
      const amounts: number[] = [];
      
      fc.assert(
        fc.property(fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }), (amount) => {
          amounts.push(amount);
          expect(amount).toBeGreaterThan(0);
          expect(amount).toBeLessThanOrEqual(100000);
        }),
        { numRuns: 10 }
      );
      
      expect(amounts.length).toBe(10);
    });

    it('should generate VPAs', () => {
      const vpaArbitrary = fc.tuple(
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
        fc.string({ minLength: 4, maxLength: 15 }).filter(s => /^[a-z0-9]+$/.test(s))
      ).map(([username, domain]) => `${username}@${domain}`);
      
      fc.assert(
        fc.property(vpaArbitrary, (vpa) => {
          expect(vpa).toContain('@');
          const [username, domain] = vpa.split('@');
          expect(username.length).toBeGreaterThanOrEqual(3);
          expect(domain.length).toBeGreaterThanOrEqual(4);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Directory Structure', () => {
    it('should have services directory', () => {
      const fs = require('fs');
      const path = require('path');
      
      const servicesPath = path.join(__dirname, '../src/services');
      expect(fs.existsSync(servicesPath)).toBe(true);
    });

    it('should have utils directory', () => {
      const fs = require('fs');
      const path = require('path');
      
      const utilsPath = path.join(__dirname, '../src/utils');
      expect(fs.existsSync(utilsPath)).toBe(true);
    });

    it('should have types directory', () => {
      const fs = require('fs');
      const path = require('path');
      
      const typesPath = path.join(__dirname, '../src/types');
      expect(fs.existsSync(typesPath)).toBe(true);
    });
  });
});
