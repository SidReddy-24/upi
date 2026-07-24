/**
 * parsers.ts
 * 
 * Utility functions for parsing various data formats.
 * Phase 9: SentinelPay Advanced Features Enhancement
 * 
 * This module provides helper parsing functions for:
 * - Date and time formatting
 * - Currency formatting
 * - VPA validation and truncation
 * - Risk signal extraction
 */

/**
 * Safely parses any date input (ISO string, space-separated date, timestamp number, or Date object)
 * into a valid JavaScript Date object without timezone shift bugs.
 */
export function parseSafeDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date() : raw;
  
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  let str = String(raw).trim();
  
  // Convert "YYYY-MM-DD HH:MM:SS" space format to ISO 8601 UTC ("YYYY-MM-DDTHH:MM:SSZ")
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str)) {
    str = str + 'Z';
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a Date object to "DD MMM, HH:MM" format (e.g., "21 Jul, 14:30").
 * 
 * @param date - Date object to format
 * @returns Formatted date string
 * @throws Error if date is invalid
 */
export function formatTimestamp(date: Date): string {
  // Validate date
  if (!date || isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month}, ${hours}:${minutes}`;
}

/**
 * Parses a timestamp string in "DD MMM, HH:MM" format back to a Date object.
 * Since the format doesn't include year, we use the following heuristic:
 * 1. Try current year, previous year, and next year
 * 2. Pick whichever is closest to current time
 * 3. If multiple options are within 1 day of each other, prefer the past
 * 
 * This handles most real-world cases where timestamps represent recent events.
 * 
 * @param timestamp - Timestamp string to parse
 * @returns Date object, or null if parsing fails
 */
export function parseTimestamp(timestamp: string): Date | null {
  try {
    const regex = /(\d{2})\s(\w{3}),\s(\d{2}):(\d{2})/;
    const match = timestamp.match(regex);
    
    if (!match) return null;
    
    const [, day, month, hours, minutes] = match;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = months.indexOf(month);
    
    if (monthIndex === -1) return null;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Try current year
    const dateCurrentYear = new Date(
      currentYear,
      monthIndex,
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10)
    );
    
    // Try previous year
    const datePrevYear = new Date(
      currentYear - 1,
      monthIndex,
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10)
    );
    
    // Try next year
    const dateNextYear = new Date(
      currentYear + 1,
      monthIndex,
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10)
    );
    
    // Calculate differences from now
    const diffCurrent = Math.abs(dateCurrentYear.getTime() - now.getTime());
    const diffPrev = Math.abs(datePrevYear.getTime() - now.getTime());
    const diffNext = Math.abs(dateNextYear.getTime() - now.getTime());
    
    // Find minimum difference
    const minDiff = Math.min(diffCurrent, diffPrev, diffNext);
    
    // If differences are very close (within 1 day), prefer past over current/future
    // This handles anniversary dates better
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Math.abs(diffPrev - minDiff) < oneDayMs && datePrevYear.getTime() <= now.getTime()) {
      return datePrevYear;
    } else if (Math.abs(diffCurrent - minDiff) < oneDayMs) {
      return dateCurrentYear;
    } else {
      return dateNextYear;
    }
  } catch {
    return null;
  }
}

// ─── Currency Helpers ─────────────────────────────────────────────────────────

/**
 * Formats an amount with currency symbol (₹).
 * 
 * @param amount - Numerical amount
 * @returns Formatted currency string (e.g., "₹5,000")
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parses a currency string to extract the numerical value.
 * 
 * @param currency - Currency string (e.g., "₹5,000" or "5000")
 * @returns Numerical amount, or null if parsing fails
 */
export function parseCurrency(currency: string): number | null {
  try {
    // Remove currency symbol and commas
    const cleaned = currency.replace(/[₹,]/g, '').trim();
    const amount = parseFloat(cleaned);
    
    if (isNaN(amount)) return null;
    
    return amount;
  } catch {
    return null;
  }
}

// ─── VPA Helpers ──────────────────────────────────────────────────────────────

/**
 * Truncates a VPA while preserving the domain portion.
 * Example: "verylongusername@paytm" → "verylong...@paytm"
 * 
 * @param vpa - VPA string to truncate
 * @param maxLength - Maximum length for username portion (default: 8)
 * @returns Truncated VPA
 */
export function truncateVpa(vpa: string, maxLength: number = 8): string {
  const [username, domain] = vpa.split('@');
  
  if (!domain) return vpa; // Not a valid VPA format
  
  if (username.length <= maxLength) {
    return vpa;
  }
  
  return `${username.substring(0, maxLength)}...@${domain}`;
}

/**
 * Extracts the domain from a VPA.
 * 
 * @param vpa - VPA string
 * @returns Domain portion, or null if not a valid VPA
 */
export function extractVpaDomain(vpa: string): string | null {
  const parts = vpa.split('@');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Validates VPA format.
 * 
 * @param vpa - VPA string to validate
 * @returns True if valid VPA format, false otherwise
 */
export function isValidVpa(vpa: string): boolean {
  const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
  return vpaRegex.test(vpa);
}

// ─── Risk Signal Helpers ──────────────────────────────────────────────────────

/**
 * Formats risk signals with warning emoji.
 * 
 * @param signals - Array of risk signal strings
 * @returns Array of formatted risk signals with ⚠️ prefix
 */
export function formatRiskSignals(signals: string[]): string[] {
  return signals.map(signal => `⚠️ ${signal}`);
}

/**
 * Extracts risk signals from formatted text.
 * 
 * @param text - Text containing formatted risk signals
 * @returns Array of risk signal names (without emoji)
 */
export function extractRiskSignals(text: string): string[] {
  const regex = /⚠️\s*([A-Z_]+)/g;
  const signals: string[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    signals.push(match[1]);
  }
  
  return signals;
}

// ─── Color Coding Helpers ─────────────────────────────────────────────────────

/**
 * Gets color indicator emoji based on fraud score.
 * 
 * @param fraudScore - Fraud score (0-1)
 * @returns Emoji indicator: 🟢 (<0.3), 🟡 (0.3-0.7), 🔴 (≥0.7)
 */
export function getFraudScoreColor(fraudScore: number): string {
  if (fraudScore < 0.3) return '🟢';
  if (fraudScore < 0.7) return '🟡';
  return '🔴';
}

/**
 * Extracts fraud score from text containing color indicator.
 * 
 * @param text - Text containing fraud score with emoji
 * @returns Fraud score as decimal (0-1), or null if not found
 */
export function extractFraudScoreFromText(text: string): number | null {
  const regex = /(\d+)%\s*[🟢🟡🔴]/;
  const match = text.match(regex);
  
  if (!match) return null;
  
  const percentage = parseInt(match[1], 10);
  return percentage / 100;
}
