/**
 * HomeScreen — Wallet dashboard
 *
 * Shows:
 *  - "SIMULATED" badge (always visible, legal requirement)
 *  - SPC balance (₹1,00,000 initial)
 *  - Quick actions: Send Money, Receive, History
 *  - Backend health status dot
 *  - Recent transactions (last 5)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletUser, WalletTransaction } from '../types';
import { getUser, getTransactions, updateBalance } from '../utils/walletDb';
import fraudShieldApi from '../services/fraudShieldApi';
import RiskBadge from '../components/RiskBadge';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

function formatAmount(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  });
}

export default function HomeScreen({ navigation }: Props) {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [backendStatus, setBackendStatus] = useState<'UP' | 'DOWN' | 'CHECKING'>('CHECKING');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const u = await getUser();
      const t = await getTransactions();
      setUser(u);
      setTxns(t.slice(0, 5)); // show last 5
    } catch (e) {
      console.error('HomeScreen loadData:', e);
    }
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      const h = await fraudShieldApi.checkHealth();
      setBackendStatus(h.status === 'HEALTHY' ? 'UP' : 'DOWN');
    } catch {
      setBackendStatus('DOWN');
    }
  }, []);

  // Reload when screen comes into focus (e.g. after a payment)
  useFocusEffect(
    useCallback(() => {
      loadData();
      checkBackend();
    }, [loadData, checkBackend]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), checkBackend()]);
    setRefreshing(false);
  };

  const balance = user?.balance ?? 0;
  const balancePct = Math.round((balance / 100000) * 100);

  return (
    <ScrollView
      style={styles.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── SIMULATED BADGE ── */}
      <View style={styles.simulatedBanner}>
        <Text style={styles.simulatedText}>🧪 SIMULATED WALLET — NOT REAL MONEY</Text>
      </View>

      {/* ── BALANCE CARD ── */}
      <View style={styles.balanceCard}>
        {user && (
          <View style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#c7d2fe', letterSpacing: 0.5 }}>
              🆔 USER ID: USR_{user.vpa.split('@')[0].toUpperCase()}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 2 }}>
              💳 UPI ID: {user.vpa}
            </Text>
          </View>
        )}
        <Text style={styles.balanceLabel}>SPC Balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(balance)}</Text>
        <Text style={styles.balanceSub}>SentinelPay Credits · Cloud Account</Text>

        {/* balance bar */}
        <View style={styles.balanceBarBg}>
          <View style={[styles.balanceBarFill, { width: `${balancePct}%` as any }]} />
        </View>
        <Text style={styles.balanceBarLabel}>{balancePct}% of ₹1,00,000 remaining</Text>

        {/* backend status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, {
            backgroundColor: backendStatus === 'UP' ? '#4ade80' : backendStatus === 'DOWN' ? '#f87171' : '#fbbf24',
          }]} />
          <Text style={styles.statusText}>
            FraudShield {backendStatus === 'CHECKING' ? 'connecting…' : backendStatus === 'UP' ? 'online ✓' : 'offline ✗'}
          </Text>
        </View>
      </View>

      {/* ── QUICK ACTIONS ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('SendMoney', {})}>
          <Text style={styles.actionIcon}>↑</Text>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ReceiveMoney')}>
          <Text style={styles.actionIcon}>↓</Text>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ScanQR')}>
          <Text style={styles.actionIcon}>⊞</Text>
          <Text style={styles.actionLabel}>Scan QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('TransactionHistory')}>
          <Text style={styles.actionIcon}>☰</Text>
          <Text style={styles.actionLabel}>History</Text>
        </TouchableOpacity>
      </View>

      {/* ── SECURITY INTELLIGENCE TOOLS ── */}
      <View style={[styles.actionsRow, { marginTop: 10 }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ScamAssistant')}>
          <Text style={styles.actionIcon}>🤖</Text>
          <Text style={styles.actionLabel}>AI Assistant</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('SmsTracker')}>
          <Text style={styles.actionIcon}>📱</Text>
          <Text style={styles.actionLabel}>SMS Tracker</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ReportScam', {})}>
          <Text style={styles.actionIcon}>🚨</Text>
          <Text style={styles.actionLabel}>Report Scam</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ScamHeatMap')}>
          <Text style={styles.actionIcon}>🗺️</Text>
          <Text style={styles.actionLabel}>Heat Map</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── SETTINGS ROW ── */}
      <View style={[styles.actionsRow, { marginTop: 10 }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* ── RECENT TRANSACTIONS ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {txns.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {txns.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubText}>Send money to get started</Text>
          </View>
        ) : (
          txns.map(txn => (
            <TouchableOpacity
              key={txn.id}
              style={styles.txnRow}
              onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })}>
              <View style={styles.txnIcon}>
                <Text style={styles.txnIconText}>{txn.type === 'DEBIT' ? '↑' : '↓'}</Text>
              </View>
              <View style={styles.txnInfo}>
                <Text style={styles.txnVpa} numberOfLines={1}>
                  {txn.type === 'DEBIT' ? txn.receiver_vpa : txn.sender_vpa}
                </Text>
                <Text style={styles.txnTime}>{formatTime(txn.created_at)}</Text>
              </View>
              <View style={styles.txnRight}>
                <Text style={[styles.txnAmount, { color: txn.type === 'DEBIT' ? '#dc2626' : '#16a34a' }]}>
                  {txn.type === 'DEBIT' ? '-' : '+'}{formatAmount(txn.amount)}
                </Text>
                {txn.decision && (
                  <RiskBadge decision={txn.decision} riskScore={txn.risk_score} />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ── FRAUD SHIELD INFO ── */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🛡️ Protected by FraudShield AI</Text>
        <Text style={styles.infoText}>
          Every transaction is scored in real-time using ML, rule engines, behavioural
          analysis and graph intelligence — all in under 200ms.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  simulatedBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  simulatedText: { fontSize: 12, fontWeight: '700', color: '#92400e', letterSpacing: 0.5 },

  balanceCard: {
    backgroundColor: '#6366f1',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#6366f1',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceLabel: { color: '#c7d2fe', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceSub: { color: '#a5b4fc', fontSize: 12, marginTop: 2, marginBottom: 16 },
  balanceBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 4 },
  balanceBarFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  balanceBarLabel: { color: '#c7d2fe', fontSize: 11, marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#e0e7ff', fontSize: 12 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: { fontSize: 22, color: '#6366f1', fontWeight: '700', marginBottom: 4 },
  actionLabel: { fontSize: 12, color: '#374151', fontWeight: '600' },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, color: '#6366f1', fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#fff', borderRadius: 16 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubText: { fontSize: 13, color: '#9ca3af', marginTop: 4 },

  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txnIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txnIconText: { fontSize: 18, color: '#6366f1', fontWeight: '700' },
  txnInfo: { flex: 1 },
  txnVpa: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txnTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: { fontSize: 15, fontWeight: '700' },

  infoCard: {
    margin: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4338ca', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#4b5563', lineHeight: 19 },
});
