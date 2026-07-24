/**
 * unifiedAuthService.ts - Unified Authentication Service
 * Supports: Phone OTP (mock mode), PIN + Biometric, Google Sign-In
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import { AuthMode, AuthUser, AuthSession } from '../types/auth';
import { authService } from './authService';
import { updateUserVpa, saveUser } from '../utils/walletDb';


const rnBiometrics = new ReactNativeBiometrics();

// Storage keys
const AUTH_MODE_KEY = 'auth_mode';
const AUTH_SESSION_KEY = 'auth_session';
const PIN_HASH_KEY = 'pin_hash';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

/**
 * Simple hash function (for PIN storage)
 * Note: In production, use a proper crypto library like react-native-quick-crypto
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate a simple JWT-like token (for demo purposes)
 */
function generateToken(userId: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2);
  return `${userId}.${timestamp}.${randomStr}`;
}

class UnifiedAuthService {
  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const sessionStr = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (!sessionStr) return false;

      const session: AuthSession = JSON.parse(sessionStr);
      
      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error('[UnifiedAuth] isAuthenticated error:', error);
      return false;
    }
  }

  /**
   * Get current auth mode
   */
  async getAuthMode(): Promise<AuthMode | null> {
    try {
      const mode = await AsyncStorage.getItem(AUTH_MODE_KEY);
      return mode as AuthMode | null;
    } catch (error) {
      console.error('[UnifiedAuth] getAuthMode error:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const sessionStr = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (!sessionStr) return null;

      const session: AuthSession = JSON.parse(sessionStr);
      return session.user;
    } catch (error) {
      console.error('[UnifiedAuth] getCurrentUser error:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const sessionStr = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (!sessionStr) return null;

      return JSON.parse(sessionStr);
    } catch (error) {
      console.error('[UnifiedAuth] getCurrentSession error:', error);
      return null;
    }
  }

  // ==================== PHONE OTP AUTHENTICATION ====================

  /**
   * Send OTP (mock mode for testing)
   */
  async sendOtp(phone: string, useMock: boolean = true): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      if (useMock) {
        // Mock mode: Return fixed OTP
        const sessionId = generateToken(phone);
        console.log('[UnifiedAuth] Mock OTP sent. Use: 123456');
        return { success: true, sessionId };
      }

      // TODO: Integrate with real OTP service (e.g., Firebase, Twilio)
      return { success: false, error: 'Real OTP service not configured' };
    } catch (error) {
      console.error('[UnifiedAuth] sendOtp error:', error);
      return { success: false, error: 'Failed to send OTP' };
    }
  }

  /**
   * Verify OTP and create session in backend database
   */
  async verifyOtp(
    phone: string,
    otp: string,
    sessionId: string,
    useMock: boolean = true,
    mode: 'signup' | 'login' = 'login',
    name?: string,
    dob?: string
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      // Mock mode: Accept 123456 as valid OTP
      if (useMock && otp !== '123456') {
        return { success: false, error: 'Invalid OTP code. Use 123456' };
      }

      // 1. Call real backend to register/login user in PostgreSQL database
      let backendUser: any = null;
      let token = generateToken(phone);
      const defaultPassword = `SentinelPass_${phone.slice(-4)}!`;

      if (mode === 'signup') {
        try {
          const regRes = await authService.register(phone, defaultPassword, undefined, name || `User ${phone.slice(-4)}`);
          backendUser = regRes.user;
          token = regRes.access_token;
        } catch (authErr: any) {
          const detailMsg = authErr?.response?.data?.detail || authErr?.message;
          return { success: false, error: detailMsg || 'Mobile number is already registered. Please log in instead.' };
        }
      } else {
        // Login mode
        try {
          const loginRes = await authService.login(phone, defaultPassword);
          backendUser = loginRes.user;
          token = loginRes.access_token;
        } catch (loginErr: any) {
          const detailMsg = loginErr?.response?.data?.detail || loginErr?.message;
          return { success: false, error: detailMsg || 'No account registered with this mobile number. Please sign up.' };
        }
      }

      // Extract real backend VPA & ID or fallback to standard phone VPA format
      const realId = backendUser?.id || generateToken(phone);
      const realVpa = backendUser?.vpa || `${phone.slice(-10)}@sentinelpay`;
      const realName = backendUser?.name || `User ${phone.slice(-4)}`;

      // Update local wallet DB with real backend VPA, name, and balance
      const realBalance = backendUser?.balance !== undefined && backendUser?.balance !== null ? parseFloat(backendUser.balance) : undefined;
      await updateUserVpa(realVpa, realName, realBalance);

      // Create session
      const user: AuthUser = {
        id: realId,
        phone,
        name: realName,
        vpa: realVpa,
        authMode: AuthMode.PHONE_OTP,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        biometricEnabled: false,
      };

      const session: AuthSession = {
        user,
        token: token,
        refreshToken: generateToken(user.id + '_refresh'),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };

      // Save session and auth mode
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      await AsyncStorage.setItem(AUTH_MODE_KEY, AuthMode.PHONE_OTP);

      return { success: true, session };
    } catch (error) {
      console.error('[UnifiedAuth] verifyOtp error:', error);
      return { success: false, error: 'Failed to verify OTP' };
    }
  }

  /**
   * Complete mandatory registration/login with phone primary key, name, DOB, UPI PIN & Biometrics
   */
  async registerOrLoginWithPhone(
    phone: string,
    name: string,
    dob: string,
    upiPin?: string,
    biometricEnabled: boolean = false
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const cleanPhone = phone.trim();
      const cleanName = name.trim() || `User ${cleanPhone.slice(-4)}`;
      const cleanDob = dob.trim();

      // Call real backend API to create/fetch account in Supabase PostgreSQL
      let backendUser: any = null;
      let token = generateToken(cleanPhone);

      try {
        const regRes = await authService.register(
          cleanPhone,
          'SentinelPass@123',
          undefined,
          cleanName
        );
        backendUser = regRes.user;
        token = regRes.access_token;
      } catch (authErr: any) {
        console.warn('[UnifiedAuth] Backend register/sync note:', authErr?.message);
        try {
          const loginRes = await authService.login(cleanPhone, 'SentinelPass@123');
          backendUser = loginRes.user;
          token = loginRes.access_token;
        } catch (loginErr) {
          console.warn('[UnifiedAuth] Login fallback note:', loginErr);
        }
      }

      const realId = cleanPhone; // Phone number is the PRIMARY KEY!
      const realVpa = backendUser?.vpa || `${cleanPhone}@sentinelpay`;
      const realName = backendUser?.name || cleanName;

      // Save user profile in local walletDb
      await saveUser({
        id: realId,
        phone: cleanPhone,
        name: realName,
        dob: cleanDob,
        vpa: realVpa,
        upiPin: upiPin || '1234',
        balance: 100000.0,
        created_at: new Date().toISOString(),
      });

      if (upiPin) {
        const pinHash = simpleHash(upiPin);
        await AsyncStorage.setItem(PIN_HASH_KEY, pinHash);
      }

      if (biometricEnabled) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      }

      const user: AuthUser = {
        id: realId,
        phone: cleanPhone,
        name: realName,
        vpa: realVpa,
        authMode: AuthMode.PHONE_OTP,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        biometricEnabled,
      };

      const session: AuthSession = {
        user,
        token,
        refreshToken: generateToken(realId + '_refresh'),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      };

      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      await AsyncStorage.setItem(AUTH_MODE_KEY, AuthMode.PHONE_OTP);

      return { success: true, session };
    } catch (error) {
      console.error('[UnifiedAuth] registerOrLoginWithPhone error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }


  // ==================== PIN AUTHENTICATION ====================

  /**
   * Setup PIN
   */
  async setupPin(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate PIN
      if (pin.length < 4 || pin.length > 6) {
        return { success: false, error: 'PIN must be 4-6 digits' };
      }

      if (!/^\d+$/.test(pin)) {
        return { success: false, error: 'PIN must contain only numbers' };
      }

      // Hash and store PIN
      const pinHash = simpleHash(pin);
      await AsyncStorage.setItem(PIN_HASH_KEY, pinHash);

      // Create user with PIN auth mode
      const existingSession = await this.getCurrentSession();
      const userId = existingSession?.user.id || generateToken('pin_user');
      
      const user: AuthUser = {
        id: userId,
        name: existingSession?.user.name || 'PIN User',
        vpa: existingSession?.user.vpa || `user${Date.now()}@sentinelpay`,
        authMode: AuthMode.PIN_BIOMETRIC,
        createdAt: existingSession?.user.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        pinHash,
        biometricEnabled: false,
      };

      const session: AuthSession = {
        user,
        token: generateToken(user.id),
        refreshToken: generateToken(user.id + '_refresh'),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      };

      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      await AsyncStorage.setItem(AUTH_MODE_KEY, AuthMode.PIN_BIOMETRIC);

      return { success: true };
    } catch (error) {
      console.error('[UnifiedAuth] setupPin error:', error);
      return { success: false, error: 'Failed to setup PIN' };
    }
  }

  /**
   * Verify PIN
   */
  async verifyPin(pin: string): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const storedHash = await AsyncStorage.getItem(PIN_HASH_KEY);
      if (!storedHash) {
        return { success: false, error: 'PIN not set up' };
      }

      const inputHash = simpleHash(pin);
      if (inputHash !== storedHash) {
        return { success: false, error: 'Incorrect PIN' };
      }

      // Update session last login
      const session = await this.getCurrentSession();
      if (session) {
        session.user.lastLoginAt = new Date().toISOString();
        session.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // Refresh expiry
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        return { success: true, session };
      }

      return { success: false, error: 'Session not found' };
    } catch (error) {
      console.error('[UnifiedAuth] verifyPin error:', error);
      return { success: false, error: 'Failed to verify PIN' };
    }
  }

  // ==================== BIOMETRIC AUTHENTICATION ====================

  /**
   * Check if biometric is available
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      console.log('[UnifiedAuth] Biometric available:', available, biometryType);
      return available;
    } catch (error) {
      console.error('[UnifiedAuth] isBiometricAvailable error:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const available = await this.isBiometricAvailable();
      if (!available) {
        return { success: false, error: 'Biometric not available on this device' };
      }

      // Create biometric keys
      const { keysExist } = await rnBiometrics.biometricKeysExist();
      if (!keysExist) {
        await rnBiometrics.createKeys();
      }

      // Test biometric authentication
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Confirm your fingerprint/face',
      });

      if (!success) {
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Update user session
      const session = await this.getCurrentSession();
      if (session) {
        session.user.biometricEnabled = true;
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      }

      return { success: true };
    } catch (error) {
      console.error('[UnifiedAuth] enableBiometric error:', error);
      return { success: false, error: 'Failed to enable biometric' };
    }
  }

  /**
   * Authenticate with biometric
   */
  async authenticateWithBiometric(): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    try {
      const available = await this.isBiometricAvailable();
      if (!available) {
        return { success: false, error: 'Biometric not available' };
      }

      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate to continue',
      });

      if (!success) {
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Update session last login
      const session = await this.getCurrentSession();
      if (session) {
        session.user.lastLoginAt = new Date().toISOString();
        session.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // Refresh expiry
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        return { success: true, session };
      }

      return { success: false, error: 'Session not found' };
    } catch (error) {
      console.error('[UnifiedAuth] authenticateWithBiometric error:', error);
      return { success: false, error: 'Failed to authenticate with biometric' };
    }
  }

  // ==================== GOOGLE SIGN-IN ====================

  /**
   * Authenticate with Google Sign-In
   * TODO: Implement with @react-native-google-signin/google-signin
   */
  async authenticateWithGoogle(): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    return {
      success: false,
      error: 'Google Sign-In not yet implemented. Please install @react-native-google-signin/google-signin',
    };
  }

  // ==================== LOGOUT ====================

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      await AsyncStorage.removeItem(AUTH_MODE_KEY);
      await AsyncStorage.removeItem('sentinelpay_user');
      try {
        await authService.logout();
      } catch (e) {
        console.warn('Backend logout note:', e);
      }
      console.log('[UnifiedAuth] Logged out successfully');
    } catch (error) {
      console.error('[UnifiedAuth] logout error:', error);
    }
  }

}

export default new UnifiedAuthService();
