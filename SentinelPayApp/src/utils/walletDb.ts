/**
 * Simulated Wallet Database
 * Uses AsyncStorage for persistence (React Native built-in alternative to SQLite).
 * Stores balance + transaction history locally on device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletUser, WalletTransaction } from '../types';

const KEYS = {
  USER: 'sentinelpay_user',
  TRANSACTIONS: 'sentinelpay_transactions',
};

const INITIAL_BALANCE = 100000; // ₹1,00,000 SPC
const DEFAULT_USER: WalletUser = {
  id: 1,
  name: 'Demo User',
  vpa: 'demo@sentinelpay',
  balance: INITIAL_BALANCE,
  created_at: new Date().toISOString(),
};

// ─── User / Balance ────────────────────────────────────────────────────────────

export async function getUser(): Promise<WalletUser> {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  if (raw) return JSON.parse(raw);
  // First launch — initialize with ₹1,00,000 SPC
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(DEFAULT_USER));
  return DEFAULT_USER;
}

export async function updateBalance(newBalance: number): Promise<void> {
  const user = await getUser();
  user.balance = newBalance;
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function updateUserVpa(vpa: string, name: string): Promise<void> {
  const user = await getUser();
  user.vpa = vpa;
  user.name = name;
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(): Promise<WalletTransaction[]> {
  const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function addTransaction(txn: WalletTransaction): Promise<void> {
  const txns = await getTransactions();
  txns.unshift(txn); // newest first
  await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txns));
}

export async function getTransactionById(id: string): Promise<WalletTransaction | null> {
  const txns = await getTransactions();
  return txns.find(t => t.id === id) ?? null;
}

// ─── Payment Logic ─────────────────────────────────────────────────────────────

export interface PaymentResult {
  success: boolean;
  newBalance?: number;
  error?: string;
}

export async function executePayment(
  receiverVpa: string,
  amount: number,
  riskScore: number | null,
  decision: string,
  fraudReason: string | null,
  callDuringPayment?: boolean, // Phase 5.2.4
): Promise<PaymentResult> {
  const user = await getUser();

  if (amount <= 0) return { success: false, error: 'Invalid amount' };
  if (amount > user.balance) return { success: false, error: 'Insufficient SPC balance' };
  if (decision === 'REJECT') return { success: false, error: 'Payment blocked by fraud detection' };

  const newBalance = user.balance - amount;
  await updateBalance(newBalance);

  const txn: WalletTransaction = {
    id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    sender_vpa: user.vpa,
    receiver_vpa: receiverVpa,
    amount,
    type: 'DEBIT',
    status: decision === 'APPROVE' ? 'APPROVED' : 'REVIEW',
    risk_score: riskScore,
    decision,
    fraud_reason: fraudReason,
    ...(callDuringPayment ? { call_during_payment: true } : {}),
    created_at: new Date().toISOString(),
  };

  await addTransaction(txn);
  return { success: true, newBalance };
}

// ─── Reset (Dev util) ─────────────────────────────────────────────────────────

export async function resetWallet(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.USER, KEYS.TRANSACTIONS]);
}
