/**
 * FraudShield AI — API Service
 *
 * Base URL notes:
 *  - Android emulator → 10.0.2.2 maps to your laptop's localhost
 *  - Real device on same WiFi → use laptop's LAN IP (e.g. 192.168.1.x)
 *  - VPS → full public URL
 */
import axios from 'axios';
import { TransactionRequest, FraudScore } from '../types';

// 10.0.2.2 = localhost from Android emulator
export const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';
const API_KEY = 'fs_demo_key_001';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

// Interceptor: log every request in dev
client.interceptors.request.use(req => {
  console.log(`[FraudShield] ${req.method?.toUpperCase()} ${req.url}`);
  return req;
});

export interface QRTrustResult {
  vpa: string;
  trust_level: 'VERIFIED' | 'CAUTION' | 'FLAGGED';
  trust_score: number;
  is_blacklisted: boolean;
  flags: string[];
  message: string;
  checked_sources: string[];
}

const fraudShieldApi = {
  /**
   * Submit a transaction for real-time fraud scoring.
   * Returns risk_score (0-1), decision (APPROVE/REVIEW/REJECT), signals, explanation.
   */
  async scoreTransaction(txn: TransactionRequest): Promise<FraudScore> {
    const resp = await client.post<FraudScore>('/score', txn);
    return resp.data;
  },

  /**
   * Check backend health — used on Home screen status indicator.
   */
  async checkHealth(): Promise<{ status: string; components: Record<string, unknown> }> {
    const resp = await client.get('/health');
    return resp.data;
  },

  /**
   * Fetch analytics summary (period: 24h | 7d | 30d).
   */
  async getAnalytics(period: '24h' | '7d' | '30d' = '24h'): Promise<unknown> {
    const resp = await client.get(`/analytics?period=${period}`);
    return resp.data;
  },

  /**
   * Phase 6.3 — QR Trust Check.
   * Checks Redis blacklist + graph engine risk for a given VPA before payment.
   */
  async getQrTrust(vpa: string): Promise<QRTrustResult> {
    const resp = await client.get<QRTrustResult>(`/qr/trust/${encodeURIComponent(vpa)}`);
    return resp.data;
  },

  /**
   * Community Report & Scam Passport APIs.
   */
  async submitCommunityReport(data: { entity_id: string; entity_type: string; category: string; description: string }): Promise<any> {
    const resp = await client.post('/community/report', data);
    return resp.data;
  },

  async getScamPassport(entityId: string): Promise<any> {
    const resp = await client.get(`/passport/${encodeURIComponent(entityId)}`);
    return resp.data;
  },

  /**
   * AI Scam Assistant API.
   */
  async queryScamAssistant(query_text: string): Promise<any> {
    const resp = await client.post('/assistant/analyze', { query_text });
    return resp.data;
  },

  /**
   * Scam Heatmap API.
   */
  async getScamHeatmap(): Promise<any> {
    const resp = await client.get('/heatmap');
    return resp.data;
  },

  /**
   * Multi-User Identity & Cloud Account APIs.
   */
  async registerUser(deviceId: string, name?: string, customVpa?: string): Promise<any> {
    const resp = await client.post('/user/register', { device_id: deviceId, name, custom_vpa: customVpa });
    return resp.data;
  },

  async getUserProfile(identifier: string): Promise<any> {
    const resp = await client.get(`/user/profile/${encodeURIComponent(identifier)}`);
    return resp.data;
  },

  async getUserTransactions(vpa: string): Promise<any[]> {
    const resp = await client.get(`/user/transactions/${encodeURIComponent(vpa)}`);
    return resp.data;
  },

  /**
   * Atomic Multi-User P2P Transfer API.
   */
  async executeP2PTransfer(data: {
    sender_vpa: string;
    receiver_vpa: string;
    amount: number;
    device_id?: string;
    is_call_active?: boolean;
    otp_in_last_60s?: boolean;
    sms_fraud_score?: number;
  }): Promise<any> {
    const resp = await client.post('/transfer', data);
    return resp.data;
  },

  /**
   * Phase 9: Send transaction SMS notifications.
   */
  async sendTransactionNotification(data: {
    transaction_id: string;
    sender_vpa: string;
    receiver_vpa: string;
    amount: number;
    status: string;
    risk_score: number;
    timestamp: string;
  }): Promise<any> {
    const resp = await client.post('/notifications/transaction', data);
    return resp.data;
  },
};

export default fraudShieldApi;

