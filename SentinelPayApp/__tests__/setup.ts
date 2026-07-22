/**
 * Jest setup file
 * Provides polyfills for browser APIs used in tests
 */

// Polyfill for btoa (base64 encoding) - browser API not available in Node
global.btoa = (str: string): string => {
  return Buffer.from(str, 'binary').toString('base64');
};

// Polyfill for atob (base64 decoding) - browser API not available in Node
global.atob = (str: string): string => {
  return Buffer.from(str, 'base64').toString('binary');
};
