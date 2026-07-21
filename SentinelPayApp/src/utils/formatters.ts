/**
 * formatters.ts
 * 
 * Utility functions for message formatting and parsing with round-trip properties.
 * Phase 9: SentinelPay Advanced Features Enhancement
 * 
 * This module provides formatters and parsers for:
 * - Transaction notifications (SMS-style formatting)
 * - Guardian approval requests
 * - JWT tokens
 */

import {
  TransactionNotification,
  GuardianApprovalMessage,
  JwtPayload,
} from '../types';
import {
  formatCurrency,
  parseCurrency,
  formatTimestamp,
  parseTimestamp,
  truncateVpa,
  extractVpaDomain,
} from './parsers';

// ─── SMS Notification Formatter ──────────────────────────────────────────────

/**
 * Formats a transaction notification for display in push notifications.
 * Adheres to 160-character SMS limit for compatibility.
 * 
 * Format: ₹{amount} {status} to {vpa} [{fraud_score}%] on {timestamp}
 * Example: ₹5,000 FLAGGED to merchant@paytm [72%] on 21 Jul, 14:30
 * 
 * @param txn - Transaction notification data
 * @returns Formatted notification message
 * @throws Error if required fields are missing
 */
export function formatTransactionNotification(
  txn: TransactionNotification
): string {
  // Validate required fields
  if (txn.amount === undefined || txn.amount === null) {
    throw new Error('Missing required field: amount');
  }
  if (!txn.counterpartyVpa) {
    throw new Error('Missing required field: counterpartyVpa');
  }
  if (!txn.status) {
    throw new Error('Missing required field: status');
  }
  if (!txn.timestamp) {
    throw new Error('Missing required field: timestamp');
  }

  // Format components
  const amountStr = formatCurrency(txn.amount);
  const statusStr = txn.status;
  const timestampStr = formatTimestamp(txn.timestamp);
  
  // Build base message
  let message = `${amountStr} ${statusStr} to `;
  
  // Add fraud score if present and > 0.5
  const fraudScoreStr = (txn.fraudScore !== undefined && txn.fraudScore > 0.5)
    ? ` [${Math.round(txn.fraudScore * 100)}%]`
    : '';
  
  const suffix = `${fraudScoreStr} on ${timestampStr}`;
  
  // Calculate available space for VPA (160 char limit)
  const availableForVpa = 160 - message.length - suffix.length;
  
  // Truncate VPA if necessary
  let vpaStr = txn.counterpartyVpa;
  if (vpaStr.length > availableForVpa) {
    // Try intelligent truncation preserving domain
    const [username, domain] = vpaStr.split('@');
    if (domain) {
      const maxUsernameLength = availableForVpa - domain.length - 4; // account for "...@"
      if (maxUsernameLength > 0) {
        vpaStr = `${username.substring(0, maxUsernameLength)}...@${domain}`;
      } else {
        // If even domain doesn't fit, just truncate
        vpaStr = vpaStr.substring(0, availableForVpa);
      }
    } else {
      vpaStr = vpaStr.substring(0, availableForVpa);
    }
  }
  
  message = `${message}${vpaStr}${suffix}`;
  
  // Final length check and truncate if needed (safety measure)
  if (message.length > 160) {
    message = message.substring(0, 160);
  }
  
  return message;
}

/**
 * Parses a formatted transaction notification message back to its object representation.
 * Preserves essential information: amount, status, VPA domain, timestamp (minute precision).
 * 
 * @param message - Formatted notification message
 * @returns Parsed transaction notification object, or null if parsing fails
 */
export function parseTransactionNotification(
  message: string
): TransactionNotification | null {
  try {
    // Pattern: ₹{amount} {status} to {vpa} [fraud_score%] on {timestamp}
    // Fraud score is optional
    const regexWithFraud = /^(₹[0-9,]+(?:\.\d+)?)\s+(APPROVED|FLAGGED|BLOCKED)\s+to\s+(.+?)\s+\[(\d+)%\]\s+on\s+(.+)$/;
    const regexWithoutFraud = /^(₹[0-9,]+(?:\.\d+)?)\s+(APPROVED|FLAGGED|BLOCKED)\s+to\s+(.+?)\s+on\s+(.+)$/;
    
    let match = message.match(regexWithFraud);
    let hasFraudScore = true;
    
    if (!match) {
      match = message.match(regexWithoutFraud);
      hasFraudScore = false;
    }
    
    if (!match) {
      return null;
    }
    
    // Extract components
    const amountStr = match[1];
    const status = match[2] as 'APPROVED' | 'FLAGGED' | 'BLOCKED';
    const vpa = hasFraudScore ? match[3] : match[3];
    const fraudScoreStr = hasFraudScore ? match[4] : undefined;
    const timestampStr = hasFraudScore ? match[5] : match[4];
    
    // Parse amount
    const amount = parseCurrency(amountStr);
    if (amount === null) {
      return null;
    }
    
    // Parse timestamp
    const timestamp = parseTimestamp(timestampStr);
    if (!timestamp) {
      return null;
    }
    
    // Parse fraud score if present
    let fraudScore: number | undefined;
    if (fraudScoreStr) {
      fraudScore = parseInt(fraudScoreStr, 10) / 100;
    }
    
    return {
      amount,
      counterpartyVpa: vpa,
      status,
      fraudScore,
      timestamp,
    };
  } catch {
    return null;
  }
}

// ─── Guardian Approval Formatter ──────────────────────────────────────────────

/**
 * Formats a guardian approval request for display with risk indicators.
 * Includes emoji indicators for risk levels and warning symbols.
 * 
 * Color coding: 🟢 (<30%), 🟡 (30-70%), 🔴 (>70%)
 * 
 * @param msg - Guardian approval message data
 * @returns Formatted approval request message
 * @throws Error if required fields are missing
 */
export function formatGuardianApprovalRequest(
  msg: GuardianApprovalMessage
): string {
  // Validate required fields
  if (msg.amount === undefined || msg.amount === null) {
    throw new Error('Missing required field: amount');
  }
  if (!msg.recipientVpa) {
    throw new Error('Missing required field: recipientVpa');
  }
  if (msg.fraudScore === undefined || msg.fraudScore === null) {
    throw new Error('Missing required field: fraudScore');
  }
  if (!msg.riskSignals) {
    throw new Error('Missing required field: riskSignals');
  }
  if (!msg.requesterName) {
    throw new Error('Missing required field: requesterName');
  }

  // Import helper functions
  const { formatCurrency, getFraudScoreColor, formatRiskSignals } = require('./parsers');

  // Format the approval request
  const amountStr = formatCurrency(msg.amount);
  const fraudScorePercent = Math.round(msg.fraudScore * 100);
  const colorEmoji = getFraudScoreColor(msg.fraudScore);
  const formattedSignals = formatRiskSignals(msg.riskSignals);

  // Build the message
  let message = '⚠️ APPROVAL NEEDED ⚠️\n';
  message += `${msg.requesterName} wants to send ${amountStr} to ${msg.recipientVpa}\n`;
  message += `Risk: ${fraudScorePercent}% ${colorEmoji}\n`;
  
  // Add risk signals
  for (const signal of formattedSignals) {
    message += `${signal}\n`;
  }
  
  message += 'Approve or Reject?';

  return message;
}

/**
 * Parses a formatted guardian approval request back to its object representation.
 * Preserves amount, VPA, fraud score, all risk signal names, and requester name.
 * 
 * @param message - Formatted approval request message
 * @returns Parsed guardian approval message object, or null if parsing fails
 */
export function parseGuardianApprovalRequest(
  message: string
): GuardianApprovalMessage | null {
  try {
    const { parseCurrency } = require('./parsers');
    const { extractFraudScoreFromText } = require('./parsers');

    // Extract requester name and transaction details
    // Pattern: "Demo User wants to send ₹10,000 to fraudster@unknown"
    // Use a flexible pattern that preserves whitespace in requesterName
    const transactionRegex = /^⚠️ APPROVAL NEEDED ⚠️\n(.*) wants to send (.+) to ([^\n]+)\n/;
    const transactionMatch = message.match(transactionRegex);
    
    if (!transactionMatch) return null;
    
    // Don't trim - preserve the exact requesterName including leading/trailing spaces
    const requesterName = transactionMatch[1];
    const amountStr = transactionMatch[2].trim();
    const recipientVpa = transactionMatch[3].trim();

    // Parse amount
    const amount = parseCurrency(amountStr);
    if (amount === null) return null;

    // Extract fraud score
    const fraudScore = extractFraudScoreFromText(message);
    if (fraudScore === null) return null;

    // Extract risk signals - only from lines that are JUST "⚠️ SIGNAL_NAME"
    // Split by lines, filter for lines starting with ⚠️, and extract the signal name
    const lines = message.split('\n');
    const riskSignals: string[] = [];
    
    for (const line of lines) {
      // Match lines that are formatted as "⚠️ SIGNAL_NAME" (and nothing else significant)
      const signalMatch = line.match(/^⚠️\s+([A-Z_]+)\s*$/);
      if (signalMatch) {
        riskSignals.push(signalMatch[1]);
      }
    }

    return {
      amount,
      recipientVpa,
      fraudScore,
      riskSignals,
      requesterName,
    };
  } catch (error) {
    console.warn('Failed to parse guardian approval request:', error);
    return null;
  }
}

// ─── JWT Parser ───────────────────────────────────────────────────────────────

/**
 * Parses a JWT token to extract payload (client-side, no signature verification).
 * Used for displaying user information from stored tokens.
 * 
 * @param token - JWT token string
 * @returns Parsed JWT payload, or null if parsing fails
 */
export function parseJwt(token: string): JwtPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part) from base64url
    const payload = parts[1];
    
    // base64url to base64: replace - with +, _ with /, and add padding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    
    // Decode base64 to JSON
    const jsonPayload = atob(paddedBase64);
    const parsed = JSON.parse(jsonPayload);

    // Validate required fields
    if (!parsed.user_id || !parsed.phone || typeof parsed.exp !== 'number') {
      return null;
    }

    return {
      user_id: parsed.user_id,
      phone: parsed.phone,
      email: parsed.email,
      exp: parsed.exp,
    };
  } catch (error) {
    // Log parsing failure for debugging
    if (error instanceof Error) {
      console.warn(`JWT parsing failed: ${error.message}`);
    }
    return null;
  }
}

/**
 * Encodes a JWT payload with signature (backend only).
 * Frontend stub implementation for testing purposes.
 * Production encoding should be done on the backend using proper libraries (PyJWT).
 * 
 * @param payload - JWT payload data
 * @param secret - Secret key for signing
 * @returns Encoded JWT token string
 */
export function encodeJwt(payload: JwtPayload, secret: string): string {
  try {
    if (!payload || !secret) {
      throw new Error('Payload and secret are required');
    }

    // Validate required fields
    if (!payload.user_id || !payload.phone || typeof payload.exp !== 'number') {
      throw new Error('Invalid payload: missing required fields');
    }

    // Create header (HS256 algorithm)
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    // Encode header and payload to base64url
    const encodeBase64Url = (obj: any): string => {
      const json = JSON.stringify(obj);
      const base64 = btoa(json);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const encodedHeader = encodeBase64Url(header);
    const encodedPayload = encodeBase64Url(payload);

    // Create signature (simplified HMAC-SHA256 stub for frontend)
    // NOTE: This is a STUB for testing. Backend should use proper crypto libraries.
    const message = `${encodedHeader}.${encodedPayload}`;
    const signature = createSimpleSignature(message, secret);
    const encodedSignature = btoa(signature).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JWT encoding failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Verifies JWT token signature and expiration (backend only).
 * Frontend stub implementation for testing purposes.
 * Production verification should be done on the backend using proper libraries (PyJWT).
 * 
 * @param token - JWT token string
 * @param secret - Secret key for verification
 * @returns True if token is valid, false otherwise
 */
export function verifyJwt(token: string, secret: string): boolean {
  try {
    if (!token || !secret) {
      return false;
    }

    // Parse the token
    const payload = parseJwt(token);
    if (!payload) {
      return false;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    if (payload.exp < now) {
      return false; // Token expired
    }

    // Verify signature (simplified stub for frontend)
    // NOTE: This is a STUB for testing. Backend should use proper crypto libraries.
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const message = `${parts[0]}.${parts[1]}`;
    const expectedSignature = createSimpleSignature(message, secret);
    const expectedEncoded = btoa(expectedSignature).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    // Compare signatures
    return parts[2] === expectedEncoded;
  } catch (error) {
    return false;
  }
}

/**
 * Creates a simple signature for JWT (STUB for frontend testing).
 * This is NOT cryptographically secure and should NOT be used in production.
 * Production backends must use proper HMAC-SHA256 implementations (e.g., PyJWT).
 * 
 * @param message - Message to sign
 * @param secret - Secret key
 * @returns Simple signature string
 */
function createSimpleSignature(message: string, secret: string): string {
  // This is a very simple hash function for testing purposes only
  // NOT suitable for production use
  let hash = 0;
  const combined = message + secret;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString(36);
}
