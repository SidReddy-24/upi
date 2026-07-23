/**
 * Authentication Types
 */

export enum AuthMode {
  PHONE_OTP = 'phone_otp',        // Phone + OTP (can be mock or real)
  GOOGLE = 'google',              // Google Sign-In
  PIN_BIOMETRIC = 'pin_biometric', // Local PIN + Biometric
  MOCK = 'mock',                  // Fixed OTP for testing
}

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  name: string;
  vpa: string;
  authMode: AuthMode;
  createdAt: string;
  lastLoginAt: string;
  pinHash?: string;  // For PIN mode
  biometricEnabled: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}

export interface OtpVerification {
  phone: string;
  otp: string;
  sessionId: string;
}

export interface PinCredentials {
  userId: string;
  pin: string;
}

export interface GoogleAuthResult {
  idToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    photo?: string;
  };
}
