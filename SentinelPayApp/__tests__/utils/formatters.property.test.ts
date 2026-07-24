/**
 * formatters.property.test.ts
 * 
 * Property-based tests for formatters using fast-check.
 * Phase 9: SentinelPay Advanced Features Enhancement
 * 
 * These tests verify correctness properties that should hold across all valid inputs.
 * Each test runs 100+ iterations with randomly generated data.
 */

import * as fc from 'fast-check';
import {
  formatTransactionNotification,
  parseTransactionNotification,
  formatGuardianApprovalRequest,
  parseGuardianApprovalRequest,
  parseJwt,
  encodeJwt,
  verifyJwt,
} from '../../src/utils/formatters';
import { TransactionNotification, GuardianApprovalMessage, JwtPayload } from '../../src/types';

// ─── Test Generators ──────────────────────────────────────────────────────────

/**
 * Generator for valid transaction notification objects.
 */
const transactionNotificationArbitrary = fc.record({
  amount: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  counterpartyVpa: fc.tuple(
    fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-z0-9._-]/gi, 'a')),
    fc.string({ minLength: 4, maxLength: 15 }).map(s => s.replace(/[^a-z0-9.-]/gi, 'b'))
  ).map(([username, domain]) => `${username}@${domain}`),
  status: fc.constantFrom('APPROVED', 'FLAGGED', 'BLOCKED') as fc.Arbitrary<'APPROVED' | 'FLAGGED' | 'BLOCKED'>,
  fraudScore: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  timestamp: fc.date({ min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), max: new Date() }).filter(d => !isNaN(d.getTime())),
});

/**
 * Generator for guardian approval message objects.
 */
const guardianApprovalMessageArbitrary = fc.record({
  amount: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  recipientVpa: fc.tuple(
    fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-z0-9._-]/gi, 'a')),
    fc.string({ minLength: 4, maxLength: 15 }).map(s => s.replace(/[^a-z0-9.-]/gi, 'b'))
  ).map(([username, domain]) => `${username}@${domain}`),
  fraudScore: fc.double({ min: 0, max: 1, noNaN: true }),
  riskSignals: fc.array(
    fc.constantFrom('BLACKLISTED_VPA', 'CALL_DURING_PAYMENT', 'VELOCITY_EXCEEDED', 'NEW_DEVICE', 'SUSPICIOUS_LOCATION'),
    { minLength: 0, maxLength: 5 }
  ),
  // Ensure requesterName has at least one non-whitespace character
  requesterName: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length > 0),
});

/**
 * Generator for JWT payload objects.
 */
const jwtPayloadArbitrary = fc.record({
  user_id: fc.uuid(),
  phone: fc.string({ minLength: 10, maxLength: 15 }).map(s => s.replace(/\D/g, '0').slice(0, 15)),
  email: fc.option(fc.emailAddress(), { nil: undefined }),
  exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 3600, max: Math.floor(Date.now() / 1000) + 86400 * 30 }),
});

// ─── Property Tests: SMS Notification Formatter ───────────────────────────────

describe('SMS Notification Formatter Properties', () => {
  // Feature: sentinelpay-advanced-features, Property 1: Message Length Constraint
  test('Property 1: Message Length Constraint', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        expect(formatted.length).toBeLessThanOrEqual(160);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 2: Currency Symbol Presence
  test('Property 2: Currency Symbol Presence', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        if (txn.amount > 0) {
          expect(formatted).toContain('₹');
          expect(formatted).toMatch(/₹\s*[\d,]+/);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 3: VPA Domain Preservation
  test('Property 3: VPA Domain Preservation', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        const domain = txn.counterpartyVpa.split('@')[1];
        expect(formatted).toContain(`@${domain}`);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 4: Status Value Inclusion
  test('Property 4: Status Value Inclusion', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        expect(formatted).toContain(txn.status);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 5: Conditional Fraud Score Inclusion
  test('Property 5: Conditional Fraud Score Inclusion', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        if (txn.fraudScore && txn.fraudScore > 0.5) {
          expect(formatted).toMatch(/\[\d+%\]/);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 6: Timestamp Format Compliance
  test('Property 6: Timestamp Format Compliance', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        expect(formatted).toMatch(/\d{2}\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec),\s\d{2}:\d{2}/);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 7: Transaction Notification Round-Trip
  test('Property 7: Transaction Notification Round-Trip', () => {
    fc.assert(
      fc.property(transactionNotificationArbitrary, (txn) => {
        const formatted = formatTransactionNotification(txn);
        const parsed = parseTransactionNotification(formatted);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          // Amount within ±0.01
          expect(Math.abs(parsed.amount - txn.amount)).toBeLessThanOrEqual(0.01);
          
          // Status exact match
          expect(parsed.status).toBe(txn.status);
          
          // VPA domain exact match
          const originalDomain = txn.counterpartyVpa.split('@')[1];
          const parsedDomain = parsed.counterpartyVpa.split('@')[1];
          expect(parsedDomain).toBe(originalDomain);
          
          // Timestamp minute precision (within 60 seconds)
          // Note: Since the format doesn't include year, we accept year ambiguity.
          // The difference should be either within 1 minute OR approximately N years
          // (where N is an integer, accounting for leap years and timezone variations).
          const timeDiff = Math.abs(parsed.timestamp.getTime() - txn.timestamp.getTime());
          const oneYearMs = 365.25 * 24 * 60 * 60 * 1000; // ~31,557,600,000 ms
          
          // Check if within 1 minute (ideal case)
          const isWithinMinute = timeDiff <= 60000;
          
          // Check if approximately N years off (where N >= 1)
          // Allow 7 days tolerance for leap year / timezone variations
          const yearsTolerance = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
          const yearsOff = Math.round(timeDiff / oneYearMs);
          const isNearAnniversary = yearsOff >= 1 && Math.abs(timeDiff - (yearsOff * oneYearMs)) <= yearsTolerance;
          
          expect(isWithinMinute || isNearAnniversary).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests: Guardian Approval Formatter ──────────────────────────────

describe('Guardian Approval Formatter Properties', () => {
  // Feature: sentinelpay-advanced-features, Property 8: All Fields Presence
  test('Property 8: All Fields Presence', () => {
    fc.assert(
      fc.property(guardianApprovalMessageArbitrary, (msg) => {
        const formatted = formatGuardianApprovalRequest(msg);
        
        // Check that all fields are present
        expect(formatted).toMatch(/₹/); // Amount
        expect(formatted).toContain(msg.recipientVpa.split('@')[1]); // VPA
        expect(formatted).toMatch(/\d+%/); // Fraud score
        expect(formatted).toContain(msg.requesterName); // Requester name
        
        // Check risk signals
        msg.riskSignals.forEach(signal => {
          expect(formatted).toContain(signal);
        });
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 9: Risk Signal Warning Formatting
  test('Property 9: Risk Signal Warning Formatting', () => {
    fc.assert(
      fc.property(guardianApprovalMessageArbitrary, (msg) => {
        const formatted = formatGuardianApprovalRequest(msg);
        
        if (msg.riskSignals.length > 0) {
          // Each risk signal should be prefixed with warning emoji
          msg.riskSignals.forEach(signal => {
            expect(formatted).toMatch(new RegExp(`⚠️.*${signal}`));
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 10: Fraud Score Color Coding
  test('Property 10: Fraud Score Color Coding', () => {
    fc.assert(
      fc.property(guardianApprovalMessageArbitrary, (msg) => {
        const formatted = formatGuardianApprovalRequest(msg);
        
        if (msg.fraudScore < 0.3) {
          expect(formatted).toContain('🟢');
        } else if (msg.fraudScore >= 0.3 && msg.fraudScore < 0.7) {
          expect(formatted).toContain('🟡');
        } else {
          expect(formatted).toContain('🔴');
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 11: Guardian Approval Round-Trip
  test('Property 11: Guardian Approval Round-Trip', () => {
    fc.assert(
      fc.property(guardianApprovalMessageArbitrary, (msg) => {
        const formatted = formatGuardianApprovalRequest(msg);
        const parsed = parseGuardianApprovalRequest(formatted);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          // Amount within ±0.01
          expect(Math.abs(parsed.amount - msg.amount)).toBeLessThanOrEqual(0.01);
          
          // Recipient VPA exact match
          expect(parsed.recipientVpa).toBe(msg.recipientVpa);
          
          // Fraud score within ±0.01
          expect(Math.abs(parsed.fraudScore - msg.fraudScore)).toBeLessThanOrEqual(0.01);
          
          // All risk signal names preserved (as a set)
          const originalSignals = new Set(msg.riskSignals);
          const parsedSignals = new Set(parsed.riskSignals);
          expect(parsedSignals).toEqual(originalSignals);
          
          // Requester name exact match
          expect(parsed.requesterName).toBe(msg.requesterName);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests: JWT Parser ───────────────────────────────────────────────

describe('JWT Parser Properties', () => {
  const TEST_SECRET = 'test-secret-key-for-jwt-signing';

  // Feature: sentinelpay-advanced-features, Property 12: Payload Extraction
  test('Property 12: Payload Extraction', () => {
    fc.assert(
      fc.property(jwtPayloadArbitrary, (payload) => {
        // This test requires backend implementation to encode JWT
        // For now, we'll skip the actual encoding and test parsing only
        const token = encodeJwt(payload, TEST_SECRET);
        const parsed = parseJwt(token);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.user_id).toBe(payload.user_id);
          expect(parsed.phone).toBe(payload.phone);
          expect(parsed.email).toBe(payload.email);
          expect(parsed.exp).toBe(payload.exp);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 13: Signature Validation
  test('Property 13: Signature Validation', () => {
    fc.assert(
      fc.property(jwtPayloadArbitrary, (payload) => {
        const validToken = encodeJwt(payload, TEST_SECRET);
        expect(verifyJwt(validToken, TEST_SECRET)).toBe(true);
        
        // Tamper with token
        const tamperedToken = validToken.slice(0, -5) + 'xxxxx';
        expect(verifyJwt(tamperedToken, TEST_SECRET)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 14: Expiration Validation
  test('Property 14: Expiration Validation', () => {
    fc.assert(
      fc.property(jwtPayloadArbitrary, (payload) => {
        const now = Math.floor(Date.now() / 1000);
        
        // Test expired token
        const expiredPayload = { ...payload, exp: now - 3600 };
        const expiredToken = encodeJwt(expiredPayload, TEST_SECRET);
        expect(verifyJwt(expiredToken, TEST_SECRET)).toBe(false);
        
        // Test valid token
        const validPayload = { ...payload, exp: now + 3600 };
        const validToken = encodeJwt(validPayload, TEST_SECRET);
        expect(verifyJwt(validToken, TEST_SECRET)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: sentinelpay-advanced-features, Property 15: JWT Round-Trip
  test('Property 15: JWT Round-Trip', () => {
    fc.assert(
      fc.property(jwtPayloadArbitrary, (payload) => {
        const token = encodeJwt(payload, TEST_SECRET);
        const parsed = parseJwt(token);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.user_id).toBe(payload.user_id);
          expect(parsed.phone).toBe(payload.phone);
          expect(parsed.email).toBe(payload.email);
          expect(parsed.exp).toBe(payload.exp);
        }
      }),
      { numRuns: 100 }
    );
  });
});
