// ─── Navigation ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  SendMoney: { prefillVpa?: string; prefillAmount?: number };
  TransactionHistory: undefined;
  TransactionDetail: { txnId: string };
  ReceiveMoney: undefined;
  ScanQR: undefined;
};

// ─── Wallet / DB ──────────────────────────────────────────────────────────────
export interface WalletUser {
  id: number;
  name: string;
  vpa: string;
  balance: number;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  sender_vpa: string;
  receiver_vpa: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: 'APPROVED' | 'REJECTED' | 'REVIEW' | 'PENDING';
  risk_score: number | null;
  decision: string | null;
  fraud_reason: string | null;
  created_at: string;
}

// ─── FraudShield API ──────────────────────────────────────────────────────────
export interface DeviceInfo {
  device_id: string;
  os_type: 'ANDROID' | 'IOS';
  is_rooted: boolean;
  is_emulator: boolean;
  app_version?: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
}

export interface NetworkInfo {
  ip_address: string;
  connection_type: string;
}

export interface TransactionRequest {
  transaction_id: string;
  sender_vpa: string;
  receiver_vpa: string;
  amount: number;
  currency: string;
  transaction_type: 'P2P' | 'P2M';
  device: DeviceInfo;
  location: LocationInfo;
  network: NetworkInfo;
  metadata: { org_id: string; channel: string };
}

export interface FraudSignals {
  ml_score: number;
  rule_score: number;
  behavior_score: number;
  graph_score: number;
  device_risk: number;
  velocity_risk: number;
  rule_flags: string[];
}

export interface FraudExplanation {
  summary: string;
  top_factors: string[];
  model_version?: string;
}

export interface FraudScore {
  transaction_id: string;
  risk_score: number;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  signals: FraudSignals;
  explanation: FraudExplanation;
  latency_ms: number;
}
