// ─── Navigation ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  SendMoney: { prefillVpa?: string; prefillAmount?: number };
  TransactionHistory: undefined;
  TransactionDetail: { txnId: string };
  ReceiveMoney: undefined;
  ScanQR: undefined;
  ReportScam: undefined;
  ScamPassport: { entityId?: string };
  ScamAssistant: undefined;
  ScamHeatMap: undefined;
  Profile: undefined;
  Settings: undefined;
  GuardianManagement: undefined;
  Login: undefined;
  Register: undefined;
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
  call_during_payment?: boolean; // Phase 5.2.4
  created_at: string;
}

// ─── FraudShield API ──────────────────────────────────────────────────────────
export interface DeviceInfo {
  device_id: string;
  os_type: 'ANDROID' | 'IOS';
  os_version?: string; // Phase 7.2
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

// ─── Notifications (Phase 9) ──────────────────────────────────────────────────
export interface TransactionNotificationPayload {
  amount: number;
  counterpartyVpa: string;
  status: 'APPROVE' | 'REVIEW' | 'REJECT';
  fraudScore?: number;
  timestamp: Date;
  txnId: string;
}

export interface NotificationEvent {
  id: string;
  type: 'TRANSACTION' | 'SMS_WARNING' | 'GUARDIAN_REQUEST';
  payload: TransactionNotificationPayload | SmsWarningPayload | GuardianApprovalRequest;
  timestamp: Date;
  delivered: boolean;
  read: boolean;
}

// ─── SMS Reader (Phase 9) ─────────────────────────────────────────────────────
export interface SmsMessage {
  sender: string;
  body: string;
  timestamp: Date;
}

export interface SmsClassificationResult {
  riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  confidence: number;
  containsOtp: boolean;
  isTrustedSender: boolean;
}

export interface SmsWarningPayload {
  sender: string;
  riskLevel: 'SUSPICIOUS' | 'DANGEROUS';
  advice: string;
  timestamp: Date;
}

export interface SmsAuditLog {
  id: string;
  sender: string;
  bodyHash: string; // SHA-256 hash for privacy
  riskLevel: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
  confidence: number;
  containsOtp: boolean;
  isTrustedSender: boolean;
  actionTaken: 'NONE' | 'WARNING_SHOWN';
  timestamp: Date;
}

// ─── Guardian System (Phase 9) ────────────────────────────────────────────────
export interface Guardian {
  id: string;
  phone?: string;
  vpa?: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED';
}

export interface GuardianApprovalRequest {
  id: string;
  transactionId: string;
  amount: number;
  recipientVpa: string;
  fraudScore: number;
  riskSignals: string[];
  expiresAt: Date;
  requesterName?: string;
}

// ─── Authentication (Phase 9) ─────────────────────────────────────────────────
export interface User {
  id: string;
  phone: string;
  email?: string;
  vpa: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface UserSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  biometricEnabled: boolean;
}

export interface JwtPayload {
  user_id: string;
  phone: string;
  email?: string;
  exp: number; // Unix timestamp
}

// ─── Transaction Hold (Phase 9) ───────────────────────────────────────────────
export interface HoldConfiguration {
  enabled: boolean;
  durationSeconds: number; // 10-30
  thresholdAmount: number; // e.g., 5000
}

export interface TransactionHoldState {
  sessionId: string;
  transactionData: WalletTransaction;
  holdDuration: number;
  startTime: Date;
  expiresAt: Date;
  status: 'HOLDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
}

export interface HoldSession {
  id: string;
  transaction: WalletTransaction;
  expiresAt: Date;
  onExpire: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Formatters/Parsers (Phase 9) ─────────────────────────────────────────────
export interface TransactionNotification {
  amount: number;
  counterpartyVpa: string;
  status: 'APPROVED' | 'FLAGGED' | 'BLOCKED';
  fraudScore?: number;
  timestamp: Date;
}

export interface GuardianApprovalMessage {
  amount: number;
  recipientVpa: string;
  fraudScore: number;
  riskSignals: string[];
  requesterName: string;
}
