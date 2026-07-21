/**
 * jwt.test.ts
 * 
 * Dedicated tests for JWT utilities.
 * Task 2.14: Create JWT parser and validator utilities
 */

import { parseJwt, encodeJwt, verifyJwt } from '../../src/utils/formatters';
import { JwtPayload } from '../../src/types';

describe('JWT Utilities - Task 2.14', () => {
  const TEST_SECRET = 'test-secret-key-for-jwt';
  
  const validPayload: JwtPayload = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    phone: '9876543210',
    email: 'user@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
  };

  describe('parseJwt() - Client-side token decoding', () => {
    test('should decode JWT token without signature verification', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      const parsed = parseJwt(token);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.user_id).toBe(validPayload.user_id);
      expect(parsed?.phone).toBe(validPayload.phone);
      expect(parsed?.email).toBe(validPayload.email);
      expect(parsed?.exp).toBe(validPayload.exp);
    });

    test('should return null for malformed token', () => {
      expect(parseJwt('invalid.token')).toBeNull();
      expect(parseJwt('not-a-jwt')).toBeNull();
      expect(parseJwt('')).toBeNull();
    });

    test('should return null for token missing required fields', () => {
      // Create a token with incomplete payload
      const incompletePayload = {
        user_id: '123',
        // Missing phone and exp
      };
      
      const header = { alg: 'HS256', typ: 'JWT' };
      const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const encodedPayload = btoa(JSON.stringify(incompletePayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const fakeToken = `${encodedHeader}.${encodedPayload}.fakesignature`;
      
      expect(parseJwt(fakeToken)).toBeNull();
    });

    test('should handle base64url decoding correctly', () => {
      // JWT uses base64url encoding (- instead of +, _ instead of /)
      const token = encodeJwt(validPayload, TEST_SECRET);
      const parts = token.split('.');
      
      // Verify base64url encoding (no + or / in the token)
      expect(parts[0]).not.toContain('+');
      expect(parts[0]).not.toContain('/');
      expect(parts[1]).not.toContain('+');
      expect(parts[1]).not.toContain('/');
      
      // Should still parse correctly
      const parsed = parseJwt(token);
      expect(parsed).not.toBeNull();
    });
  });

  describe('encodeJwt() - JWT encoding with signature', () => {
    test('should create valid JWT token with three parts', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      const parts = token.split('.');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // header
      expect(parts[1]).toBeTruthy(); // payload
      expect(parts[2]).toBeTruthy(); // signature
    });

    test('should throw error for missing payload', () => {
      expect(() => encodeJwt(null as any, TEST_SECRET)).toThrow();
    });

    test('should throw error for missing secret', () => {
      expect(() => encodeJwt(validPayload, '')).toThrow();
    });

    test('should throw error for invalid payload (missing required fields)', () => {
      const invalidPayload = {
        user_id: '123',
        phone: '9876543210',
        // Missing exp
      } as any;
      
      expect(() => encodeJwt(invalidPayload, TEST_SECRET)).toThrow('missing required fields');
    });

    test('should produce different tokens for different payloads', () => {
      const payload1: JwtPayload = {
        user_id: 'user1',
        phone: '1111111111',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      
      const payload2: JwtPayload = {
        user_id: 'user2',
        phone: '2222222222',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      
      const token1 = encodeJwt(payload1, TEST_SECRET);
      const token2 = encodeJwt(payload2, TEST_SECRET);
      
      expect(token1).not.toBe(token2);
    });

    test('should produce different signatures for different secrets', () => {
      const token1 = encodeJwt(validPayload, 'secret1');
      const token2 = encodeJwt(validPayload, 'secret2');
      
      const sig1 = token1.split('.')[2];
      const sig2 = token2.split('.')[2];
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyJwt() - Signature and expiration validation', () => {
    test('should verify valid token with correct secret', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      expect(verifyJwt(token, TEST_SECRET)).toBe(true);
    });

    test('should reject token with wrong secret', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      expect(verifyJwt(token, 'wrong-secret')).toBe(false);
    });

    test('should reject expired token', () => {
      const expiredPayload: JwtPayload = {
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };
      
      const token = encodeJwt(expiredPayload, TEST_SECRET);
      expect(verifyJwt(token, TEST_SECRET)).toBe(false);
    });

    test('should accept token that expires in the future', () => {
      const futurePayload: JwtPayload = {
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
      };
      
      const token = encodeJwt(futurePayload, TEST_SECRET);
      expect(verifyJwt(token, TEST_SECRET)).toBe(true);
    });

    test('should reject malformed token', () => {
      expect(verifyJwt('invalid.token', TEST_SECRET)).toBe(false);
      expect(verifyJwt('', TEST_SECRET)).toBe(false);
    });

    test('should reject token with tampered payload', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      const parts = token.split('.');
      
      // Tamper with the payload by changing one character
      const tamperedPayload = parts[1].substring(0, parts[1].length - 1) + 'X';
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      expect(verifyJwt(tamperedToken, TEST_SECRET)).toBe(false);
    });
  });

  describe('Expiration checking logic', () => {
    test('should check exp field correctly (payload.exp * 1000 < Date.now())', () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Test expired token
      const expiredPayload: JwtPayload = {
        ...validPayload,
        exp: now - 1, // Expired 1 second ago
      };
      const expiredToken = encodeJwt(expiredPayload, TEST_SECRET);
      expect(verifyJwt(expiredToken, TEST_SECRET)).toBe(false);
      
      // Test valid token (expires in future)
      const validPayload2: JwtPayload = {
        ...validPayload,
        exp: now + 1, // Expires 1 second from now
      };
      const validToken = encodeJwt(validPayload2, TEST_SECRET);
      expect(verifyJwt(validToken, TEST_SECRET)).toBe(true);
    });

    test('should handle token expiring exactly now', () => {
      const now = Math.floor(Date.now() / 1000);
      const nowPayload: JwtPayload = {
        ...validPayload,
        exp: now,
      };
      const token = encodeJwt(nowPayload, TEST_SECRET);
      
      // Token expiring exactly now should NOT be treated as expired (exp >= now)
      // Design spec: payload.exp * 1000 < Date.now() returns expired
      // This means exp < now (in seconds) returns expired, so exp === now is NOT expired
      expect(verifyJwt(token, TEST_SECRET)).toBe(true);
    });
  });

  describe('Round-trip property', () => {
    test('should preserve all fields through encode/decode cycle', () => {
      const originalPayload: JwtPayload = {
        user_id: 'test-user-123',
        phone: '9876543210',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      
      const token = encodeJwt(originalPayload, TEST_SECRET);
      const decoded = parseJwt(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.user_id).toBe(originalPayload.user_id);
      expect(decoded?.phone).toBe(originalPayload.phone);
      expect(decoded?.email).toBe(originalPayload.email);
      expect(decoded?.exp).toBe(originalPayload.exp);
    });

    test('should handle optional email field', () => {
      const payloadWithoutEmail: JwtPayload = {
        user_id: 'test-user-456',
        phone: '1234567890',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      
      const token = encodeJwt(payloadWithoutEmail, TEST_SECRET);
      const decoded = parseJwt(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.user_id).toBe(payloadWithoutEmail.user_id);
      expect(decoded?.phone).toBe(payloadWithoutEmail.phone);
      expect(decoded?.email).toBeUndefined();
      expect(decoded?.exp).toBe(payloadWithoutEmail.exp);
    });
  });

  describe('JWT payload format validation', () => {
    test('should validate JWT payload format: { user_id, phone, email, exp }', () => {
      const token = encodeJwt(validPayload, TEST_SECRET);
      const parsed = parseJwt(token);
      
      expect(parsed).toHaveProperty('user_id');
      expect(parsed).toHaveProperty('phone');
      expect(parsed).toHaveProperty('email');
      expect(parsed).toHaveProperty('exp');
      
      expect(typeof parsed?.user_id).toBe('string');
      expect(typeof parsed?.phone).toBe('string');
      expect(typeof parsed?.exp).toBe('number');
    });
  });
});
