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
};

export default fraudShieldApi;

