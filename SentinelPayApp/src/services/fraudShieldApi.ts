import axios from 'axios';

// Change this to your laptop's IP when testing on real device
// Or deploy to a VPS and use that URL
const API_BASE_URL = 'http://192.168.1.100:8000/api/v1'; // UPDATE THIS
const API_KEY = 'fs_demo_key_001';

const fraudShieldClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

export interface TransactionRequest {
  transaction_id: string;
  sender_vpa: string;
  receiver_vpa: string;
  amount: number;
  currency: string;
  transaction_type: string;
  device: {
    device_id: string;
    os_type: string;
    is_rooted: boolean;
    is_emulator: boolean;
    is_call_active?: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  network?: {
    ip_address?: string;
  };
  metadata: {
    org_id: string;
    otp_in_last_60s?: boolean;
  };
}

export interface FraudScore {
  request_id: string;
  transaction_id: string;
  risk_score: number;
  confidence: number;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  explanation: {
    nl_summary: string;
    reasons: Array<{
      code: string;
      description: string;
      severity: string;
      contribution?: number;
    }>;
    top_features: Array<{
      feature: string;
      value: number;
      contribution: number;
      direction: string;
    }>;
  };
  signals: {
    rule_flags: string[];
    behavioral_deviation: number;
    graph_risk: number;
    device_risk: number;
  };
  latency_ms: number;
  scored_at: string;
}

export const fraudShieldApi = {
  /**
   * Score a transaction for fraud risk
   */
  async scoreTransaction(transaction: TransactionRequest): Promise<FraudScore> {
    const response = await fraudShieldClient.post<FraudScore>('/score', transaction);
    return response.data;
  },

  /**
   * Check system health
   */
  async checkHealth(): Promise<{status: string; components: Record<string, any>}> {
    const response = await fraudShieldClient.get('/health');
    return response.data;
  },

  /**
   * Get analytics
   */
  async getAnalytics(): Promise<any> {
    const response = await fraudShieldClient.get('/analytics');
    return response.data;
  },
};

export default fraudShieldApi;
