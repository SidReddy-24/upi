/**
 * Simulated Wallet Database
 * Uses AsyncStorage for persistence (React Native built-in alternative to SQLite).
 * Stores balance + transaction history locally on device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletUser, WalletTransaction } from '../types';

const INITIAL_BALANCE = 100000; // ₹1,00,000 SPC
const DEFAULT_USER: WalletUser = {
  id: 1,
  name: 'Demo User',
  vpa: 'demo@sentinelpay',
  balance: INITIAL_BALANCE,
  created_at: new Date().toISOString(),
};

async function getActivePhone(): Promise<string> {
  const profileRaw = await AsyncStorage.getItem('userProfile');
  if (profileRaw) {
    try {
      const profile = JSON.parse(profileRaw);
      if (profile.phone) return profile.phone;
    } catch (e) {}
  }
  return 'default';
}

async function getUserKey(): Promise<string> {
  const phone = await getActivePhone();
  return `sentinelpay_user_${phone}`;
}

async function getTransactionsKey(): Promise<string> {
  const phone = await getActivePhone();
  return `sentinelpay_transactions_${phone}`;
}

// ─── User / Balance ────────────────────────────────────────────────────────────

export async function getUser(): Promise<WalletUser | null> {
  const key = await getUserKey();
  const raw = await AsyncStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export async function updateBalance(newBalance: number): Promise<void> {
  const user = await getUser();
  if (!user) return;
  user.balance = newBalance;
  const key = await getUserKey();
  await AsyncStorage.setItem(key, JSON.stringify(user));
}

export async function saveUser(user: WalletUser): Promise<void> {
  const key = await getUserKey();
  await AsyncStorage.setItem(key, JSON.stringify(user));
}

export async function updateUserVpa(vpa: string, name: string, balance?: number): Promise<void> {
  const existing = await getUser();
  
  // Strictly preserve existing balance if present; otherwise use passed balance from backend; fallback to 100000 only for brand new users
  let finalBalance = 100000;
  if (existing?.balance !== undefined && existing?.balance !== null) {
    finalBalance = existing.balance;
  } else if (balance !== undefined && balance !== null) {
    finalBalance = balance;
  }

  const updatedUser: WalletUser = {
    id: existing?.id || 1,
    phone: existing?.phone || await getActivePhone(),
    vpa,
    name,
    balance: finalBalance,
    created_at: existing?.created_at || new Date().toISOString(),
  };
  const key = await getUserKey();
  await AsyncStorage.setItem(key, JSON.stringify(updatedUser));
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function isDuplicateTxn(a: WalletTransaction, b: WalletTransaction): boolean {
  if (a.id === b.id) return true;
  
  const sameParties = 
    a.sender_vpa.toLowerCase() === b.sender_vpa.toLowerCase() &&
    a.receiver_vpa.toLowerCase() === b.receiver_vpa.toLowerCase() &&
    Math.abs(a.amount - b.amount) < 0.01 &&
    a.type === b.type;

  if (!sameParties) return false;

  const timeA = new Date(a.created_at).getTime();
  const timeB = new Date(b.created_at).getTime();
  if (isNaN(timeA) || isNaN(timeB)) return true;

  return Math.abs(timeA - timeB) <= 10000; // 10 second window
}

export function deduplicateTxnList(txns: WalletTransaction[]): WalletTransaction[] {
  const result: WalletTransaction[] = [];
  for (const t of txns) {
    const exists = result.some(existing => isDuplicateTxn(existing, t));
    if (!exists) {
      result.push(t);
    }
  }
  return result;
}

export async function getTransactions(): Promise<WalletTransaction[]> {
  const key = await getTransactionsKey();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const list: WalletTransaction[] = JSON.parse(raw);
    const deduplicated = deduplicateTxnList(list);
    if (deduplicated.length !== list.length) {
      await AsyncStorage.setItem(key, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch {
    return [];
  }
}

export async function addTransaction(txn: WalletTransaction): Promise<void> {
  const txns = await getTransactions();
  const exists = txns.some(t => isDuplicateTxn(t, txn));
  if (!exists) {
    txns.unshift(txn); // newest first
    const clean = deduplicateTxnList(txns);
    const key = await getTransactionsKey();
    await AsyncStorage.setItem(key, JSON.stringify(clean));
  }
}

export async function syncCloudTransactions(vpa: string): Promise<WalletTransaction[]> {
  const localTxns = await getTransactions();
  if (!vpa) return localTxns;

  try {
    const fraudShieldApi = require('../services/fraudShieldApi').default;
    
    // Sync profile balance first
    try {
      const profile = await fraudShieldApi.getUserProfile(vpa);
      if (profile && typeof profile.balance === 'number') {
        await updateBalance(profile.balance);
      }
    } catch (e) {
      // Ignore network errors on balance sync
    }

    // Sync cloud transaction ledger
    const cloudTxns = await fraudShieldApi.getUserTransactions(vpa);
    if (cloudTxns && Array.isArray(cloudTxns) && cloudTxns.length > 0) {
      const combined = [...localTxns];

      for (const ct of cloudTxns) {
        const candidate: WalletTransaction = {
          id: ct.id,
          sender_vpa: ct.sender_vpa,
          receiver_vpa: ct.receiver_vpa,
          amount: ct.amount,
          type: ct.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
          status: ct.status === 'APPROVED' ? 'APPROVED' : 'REVIEW',
          risk_score: ct.risk_score ?? 0.1,
          decision: 'APPROVE',
          fraud_reason: null,
          created_at: ct.timestamp || new Date().toISOString(),
        };

        const isDup = combined.some(existing => isDuplicateTxn(existing, candidate));
        if (!isDup) {
          combined.push(candidate);
        }
      }

      const mergedList = deduplicateTxnList(combined).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const key = await getTransactionsKey();
      await AsyncStorage.setItem(key, JSON.stringify(mergedList));
      return mergedList;
    }
  } catch (err) {
    console.debug('[walletDb] syncCloudTransactions note:', err);
  }

  return localTxns;
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
  if (!user) return { success: false, error: 'User not logged in' };

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
  try {
    const isReceiverSameApp = await checkIfReceiverHasApp(receiverVpa);
    if (isReceiverSameApp) {
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
    }
  } catch (error) {
    console.error('[walletDb] Error processing receiver credit:', error);
  }

  return { success: true, newBalance };
}

/**
 * Check if receiver VPA is registered in this app
 */
async function checkIfReceiverHasApp(vpa: string): Promise<boolean> {
  return vpa.endsWith('@sentinelpay');
}

/**
 * Receive money (credit to balance)
 */
export async function receivePayment(
  senderVpa: string,
  amount: number,
  transactionId: string,
  riskScore: number | null = null,
  decision: string = 'APPROVED'
): Promise<PaymentResult> {
  const user = await getUser();
  if (!user) return { success: false, error: 'User not logged in' };

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
  const userKey = await getUserKey();
  const txnKey = await getTransactionsKey();
  await AsyncStorage.multiRemove([userKey, txnKey]);
}
