import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';

export const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';
const API_KEY = 'fs_demo_key_001';

const rnBiometrics = new ReactNativeBiometrics();

// Create authenticated Axios client
export const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

// Request Interceptor: Automatically inject Access Token
authClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    console.log(`[authClient] Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Automatically handle token refreshing on 401 Unauthorized
authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        console.log('[authClient] Token expired, attempting refresh...');
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = refreshResponse.data;
        await AsyncStorage.setItem('accessToken', access_token);
        await AsyncStorage.setItem('refreshToken', refresh_token);

        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return authClient(originalRequest);
      } catch (refreshError) {
        console.error('[authClient] Refresh token invalid or expired. Logging out.');
        await authService.logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export interface UserProfile {
  id: string;
  phone: string;
  email: string | null;
  vpa: string;
  name: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserProfile;
}

export const authService = {
  /**
   * Send OTP for registration/reset.
   */
  async sendOtp(phone: string, purpose: 'REGISTRATION' | 'PASSWORD_RESET'): Promise<{ message: string }> {
    const resp = await authClient.post('/auth/send-otp', { phone, purpose });
    return resp.data;
  },

  /**
   * Verify OTP code.
   */
  async verifyOtp(phone: string, otpCode: string, purpose: 'REGISTRATION' | 'PASSWORD_RESET'): Promise<{ message: string }> {
    const resp = await authClient.post('/auth/verify-otp', {
      phone,
      otp_code: otpCode,
      purpose,
    });
    return resp.data;
  },

  /**
   * Register a new user.
   */
  async register(phone: string, password: string, email?: string, name?: string): Promise<AuthResponse> {
    const resp = await authClient.post('/auth/register', {
      phone,
      password,
      email: email || null,
      name: name || 'Sentinel User',
    });
    
    const data = resp.data;
    await AsyncStorage.setItem('accessToken', data.access_token);
    await AsyncStorage.setItem('refreshToken', data.refresh_token);
    await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));
    return data;
  },

  /**
   * Login user.
   */
  async login(identifier: string, password: string): Promise<AuthResponse> {
    const resp = await authClient.post('/auth/login', {
      identifier,
      password,
    });
    
    const data = resp.data;
    await AsyncStorage.setItem('accessToken', data.access_token);
    await AsyncStorage.setItem('refreshToken', data.refresh_token);
    await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));
    return data;
  },

  /**
   * Logout user.
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) {
        await authClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (e) {
      console.warn('Logout endpoint failed:', e);
    } finally {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('userProfile');
    }
  },

  /**
   * Fetch current user profile from server.
   */
  async getMe(): Promise<UserProfile> {
    const resp = await authClient.get('/auth/me');
    const user = resp.data;
    await AsyncStorage.setItem('userProfile', JSON.stringify(user));
    return user;
  },

  /**
   * Fetch cached profile from AsyncStorage.
   */
  async getCachedProfile(): Promise<UserProfile | null> {
    const profileStr = await AsyncStorage.getItem('userProfile');
    if (!profileStr) return null;
    try {
      return JSON.parse(profileStr);
    } catch {
      return null;
    }
  },

  /**
   * Check if user is logged in.
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem('accessToken');
    return !!token;
  },

  /**
   * Biometric Prompt Login
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const { available } = await rnBiometrics.isSensorAvailable();
      if (!available) return false;
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate with Fingerprint/FaceID',
      });
      return success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  },
};
