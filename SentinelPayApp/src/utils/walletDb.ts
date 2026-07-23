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

  // Deduct from sender's balance
  const newBalance = user.balance - amount;
  await updateBalance(newBalance);

  const txnId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const status = decision === 'APPROVE' ? 'APPROVED' : 'REVIEW';

  // Create DEBIT transaction for sender
  const debitTxn: WalletTransaction = {
    id: txnId,
    sender_vpa: user.vpa,
    receiver_vpa: receiverVpa,
    amount,
    type: 'DEBIT',
    status,
    risk_score: riskScore,
    decision,
    fraud_reason: fraudReason,
    ...(callDuringPayment ? { call_during_payment: true } : {}),
    created_at: timestamp,
  };

  await addTransaction(debitTxn);

  // SIMULATED: If receiver is also using this app (has same VPA), credit their account
  // This simulates a real-time transaction where receiver also has the app
  // In production, this would be handled by a backend service
  try {
    const isReceiverSameApp = await checkIfReceiverHasApp(receiverVpa);
    if (isReceiverSameApp) {
      // Create CREDIT transaction for receiver (mirror transaction)
      const creditTxn: WalletTransaction = {
        id: `${txnId}_CREDIT`,
        sender_vpa: user.vpa,
        receiver_vpa: receiverVpa,
        amount,
        type: 'CREDIT',
        status,
        risk_score: riskScore,
        decision,
        fraud_reason: fraudReason,
        created_at: timestamp,
      };

      await addTransaction(creditTxn);
      console.log(`[walletDb] Simulated credit to receiver ${receiverVpa}: ₹${amount}`);
    } else {
      console.log(`[walletDb] Receiver ${receiverVpa} not using app - transaction sent to external UPI`);
    }
  } catch (error) {
    console.error('[walletDb] Error processing receiver credit:', error);
    // Don't fail the transaction if receiver credit fails (sender already debited)
  }

  return { success: true, newBalance };
}

/**
 * Check if receiver VPA is registered in this app
 * For demo purposes, we simulate this check
 * In production, this would query a backend API
 */
async function checkIfReceiverHasApp(vpa: string): Promise<boolean> {
  // For demo: Assume receiver has app if VPA ends with @sentinelpay
  // In production: This would be an API call to check user registration
  return vpa.endsWith('@sentinelpay');
}

/**
 * Receive money (credit to balance)
 * This would be triggered by a backend notification in production
 * For demo, we expose it so the receiver can manually "accept" money
 */
export async function receivePayment(
  senderVpa: string,
  amount: number,
  transactionId: string,
  riskScore: number | null = null,
  decision: string = 'APPROVED'
): Promise<PaymentResult> {
  const user = await getUser();

  if (amount <= 0) return { success: false, error: 'Invalid amount' };

  // Credit to receiver's balance
  const newBalance = user.balance + amount;
  await updateBalance(newBalance);

  // Create CREDIT transaction for receiver
  const creditTxn: WalletTransaction = {
    id: `${transactionId}_CREDIT`,
    sender_vpa: senderVpa,
    receiver_vpa: user.vpa,
    amount,
    type: 'CREDIT',
    status: 'APPROVED',
    risk_score: riskScore,
    decision,
    fraud_reason: null,
    created_at: new Date().toISOString(),
  };

  await addTransaction(creditTxn);
  console.log(`[walletDb] Received ₹${amount} from ${senderVpa}`);

  return { success: true, newBalance };
}

// ─── Reset (Dev util) ─────────────────────────────────────────────────────────

export async function resetWallet(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.USER, KEYS.TRANSACTIONS]);
}
