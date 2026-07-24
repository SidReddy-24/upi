import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';

export let API_BASE_URL = 'https://upi-nd1p.onrender.com/api/v1';
const FAST_LOCAL_URL = 'http://10.0.2.2:8000/api/v1';
const API_KEY = 'fs_demo_key_001';

const rnBiometrics = new ReactNativeBiometrics();

let cachedAccessToken: string | null = null;

// Create authenticated Axios client with low latency timeout
export const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

// Fast server detection: Prefer local 1ms server when available
export const initFastBackend = async () => {
  try {
    const probe = await axios.get(`${FAST_LOCAL_URL}/health`, { timeout: 1500 });
    if (probe.data?.status === 'HEALTHY' || probe.status === 200) {
      API_BASE_URL = FAST_LOCAL_URL;
      authClient.defaults.baseURL = FAST_LOCAL_URL;
      console.log('[authClient] ⚡ Connected to Fast Local Backend (1ms latency)');
    }
  } catch (e) {
    console.log('[authClient] Using Cloud Production Backend');
  }
};

// Fire fast backend probe on module load
initFastBackend();

// Request Interceptor: In-memory token injection for zero-latency headers
authClient.interceptors.request.use(
  async (config) => {
    if (!cachedAccessToken) {
      cachedAccessToken = await AsyncStorage.getItem('accessToken');
    }
    if (cachedAccessToken) {
      config.headers['Authorization'] = `Bearer ${cachedAccessToken}`;
    }
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
        cachedAccessToken = access_token;
        await AsyncStorage.setItem('accessToken', access_token);
        await AsyncStorage.setItem('refreshToken', refresh_token);

        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return authClient(originalRequest);
      } catch (refreshError) {
        console.error('[authClient] Refresh token invalid or expired. Logging out.');
        cachedAccessToken = null;
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
  async sendOtp(phone: string, purpose: 'REGISTRATION' | 'PASSWORD_RESET'): Promise<any> {
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
   * Reset Password.
   */
  async resetPassword(phone: string, otpCode: string, newPassword: string): Promise<{ message: string }> {
    const resp = await authClient.post('/auth/reset-password', {
      phone,
      otp_code: otpCode,
      new_password: newPassword,
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
      email,
      name,
    });
    const data: AuthResponse = resp.data;

    cachedAccessToken = data.access_token;
    await AsyncStorage.setItem('accessToken', data.access_token);
    await AsyncStorage.setItem('refreshToken', data.refresh_token);
    await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));

    return data;
  },

  /**
   * Login with phone and password.
   */
  async login(phone: string, password: string): Promise<AuthResponse> {
    const resp = await authClient.post('/auth/login', {
      identifier: phone,
      phone,
      password,
    });
    const data: AuthResponse = resp.data;

    cachedAccessToken = data.access_token;
    await AsyncStorage.setItem('accessToken', data.access_token);
    await AsyncStorage.setItem('refreshToken', data.refresh_token);
    await AsyncStorage.setItem('userProfile', JSON.stringify(data.user));

    return data;
  },

  /**
   * Check if user has active auth token.
   */
  async isLoggedIn(): Promise<boolean> {
    const token = cachedAccessToken || (await AsyncStorage.getItem('accessToken'));
    return !!token;
  },

  /**
   * Prompt device biometrics.
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const { available } = await rnBiometrics.isSensorAvailable();
      if (!available) return false;

      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate with SentinelPay',
      });
      return success;
    } catch {
      return false;
    }
  },

  /**
   * Biometric quick login.
   */
  async loginWithBiometrics(): Promise<AuthResponse | null> {
    const success = await this.authenticateWithBiometrics();
    if (!success) return null;

    const savedUser = await AsyncStorage.getItem('userProfile');
    const token = await AsyncStorage.getItem('accessToken');
    const refreshToken = await AsyncStorage.getItem('refreshToken');

    if (savedUser && token && refreshToken) {
      cachedAccessToken = token;
      return {
        access_token: token,
        refresh_token: refreshToken,
        expires_in: 3600,
        user: JSON.parse(savedUser),
      };
    }
    return null;
  },

  /**
   * Get current authenticated user profile.
   */
  async getMe(): Promise<UserProfile | null> {
    try {
      const resp = await authClient.get('/auth/me');
      if (resp.data) {
        await AsyncStorage.setItem('userProfile', JSON.stringify(resp.data));
        return resp.data;
      }
    } catch {
      // Fallback to local profile cache
    }
    const local = await AsyncStorage.getItem('userProfile');
    return local ? JSON.parse(local) : null;
  },

  /**
   * Logout user.
   */
  async logout(): Promise<void> {
    cachedAccessToken = null;
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userProfile');
  },
};
