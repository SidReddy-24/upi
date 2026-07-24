/**
 * HomeScreen — SentinelPay Wallet Dashboard
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletUser, WalletTransaction } from '../types';
import { getUser, getTransactions, syncCloudTransactions } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import fraudShieldApi from '../services/fraudShieldApi';
import RiskBadge from '../components/RiskBadge';
import AppIcon from '../components/AppIcon';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

function formatAmount(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function formatTime(iso: string) {
  const d = parseSafeDate(iso);
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
      if (!u) {
        navigation.replace('AuthModeSelector');
        return;
      }
      
      setUser(prev => {
        if (!prev || Math.abs(prev.balance - u.balance) > 0.01 || prev.vpa !== u.vpa) {
          return u;
        }
        return prev;
      });
      
      const localT = await getTransactions();
      setTxns(localT.slice(0, 5));

      if (u.vpa) {
        const synced = await syncCloudTransactions(u.vpa);
        setTxns(synced.slice(0, 5));
        
        const updatedUser = await getUser();
        if (updatedUser) {
          setUser(prev => {
            if (!prev || Math.abs(prev.balance - updatedUser.balance) > 0.01) {
              return updatedUser;
            }
            return prev;
          });
        }
      }
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

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkBackend();

      const timer = setInterval(() => {
        loadData();
      }, 12000);

      return () => clearInterval(timer);
    }, [loadData, checkBackend]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), checkBackend()]);
    setRefreshing(false);
  };

  const balance = user?.balance ?? 0;
  const balancePct = Math.min(100, Math.max(0, Math.round((balance / 100000) * 100)));

  return (
    <ScrollView
      style={styles.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F0" />

      {/* ── TOP HEADER BAR ── */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.appTitle}>SentinelPay</Text>
          <Text style={styles.simulatedSubtitle}>Simulated Credit Wallet</Text>
        </View>
        <View style={styles.topHeaderIcons}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.navigate('Profile')}>
            <AppIcon name="profile" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.navigate('Settings')}>
            <AppIcon name="settings" size={20} color="#1A1A2E" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAIN BALANCE CARD ── */}
      <View style={styles.balanceCard}>
        {user && (
          <View style={styles.userHeaderRow}>
            <Text style={styles.vpaText}>UPI: {user.vpa}</Text>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: backendStatus === 'UP' ? '#4ADE80' : '#F87171' }]} />
              <Text style={styles.statusPillText}>{backendStatus === 'UP' ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        )}

        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(balance)}</Text>

        <View style={styles.balanceBarBg}>
          <View style={[styles.balanceBarFill, { width: `${balancePct}%` as any }]} />
        </View>
        <Text style={styles.balanceBarLabel}>{balancePct}% of ₹1,00,000 SPC remaining</Text>
      </View>

      {/* ── QUICK PAY ACTIONS ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeaderTitle}>Quick Pay</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SendMoney', {})}>
            <View style={styles.iconCircle}>
              <AppIcon name="send" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ReceiveMoney')}>
            <View style={styles.iconCircle}>
              <AppIcon name="receive" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScanQR')}>
            <View style={styles.iconCircle}>
              <AppIcon name="scan" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('TransactionHistory')}>
            <View style={styles.iconCircle}>
              <AppIcon name="history" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── AI & SAFETY SUITE ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeaderTitle}>Safety & Security Suite</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('GuardianManagement')}>
            <View style={styles.iconCircle}>
              <AppIcon name="guardian" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Guardians</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SmsTracker')}>
            <View style={styles.iconCircle}>
              <AppIcon name="sms" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>SMS Shield</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScamAssistant')}>
            <View style={styles.iconCircle}>
              <AppIcon name="assistant" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Assistant</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScamHeatMap')}>
            <View style={styles.iconCircle}>
              <AppIcon name="heatmap" size={22} color="#2D6A4F" />
            </View>
            <Text style={styles.actionTitle}>Threat Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── RECENT TRANSACTIONS ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Recent Activity</Text>
          {txns.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
              <Text style={styles.seeAllText}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {txns.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="coin" size={32} color="#94a3b8" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          txns.map(txn => (
            <TouchableOpacity
              key={txn.id}
              style={styles.txnCard}
              onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })}>
              <View style={[styles.txnTypeCircle, { backgroundColor: txn.type === 'DEBIT' ? '#FEE2E2' : '#D1FAE5' }]}>
                <AppIcon name={txn.type === 'DEBIT' ? 'send' : 'receive'} size={16} color={txn.type === 'DEBIT' ? '#E63946' : '#2D6A4F'} />
              </View>
              <View style={styles.txnMain}>
                <Text style={styles.txnVpa} numberOfLines={1}>
                  {txn.type === 'DEBIT' ? txn.receiver_vpa : txn.sender_vpa}
                </Text>
                <Text style={styles.txnDate}>{formatTime(txn.created_at)}</Text>
              </View>
              <View style={styles.txnRight}>
                <Text style={[styles.txnAmount, { color: txn.type === 'DEBIT' ? '#E63946' : '#2D6A4F' }]}>
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

      {/* ── FRAUD SHIELD FOOTER ── */}
      <View style={styles.infoCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <AppIcon name="shield" size={18} color="#2D6A4F" />
          <Text style={styles.infoTitle}>Protected by FraudShield AI</Text>
        </View>
        <Text style={styles.infoText}>
          Real-time transaction scoring via machine learning, rule checks, and behavioral intelligence in under 200ms.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A2E',
  },
  simulatedSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D6A4F',
  },
  topHeaderIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#2D6A4F',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  userHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(250, 247, 240, 0.2)',
  },
  vpaText: {
    color: '#FAF7F0',
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    color: '#FAF7F0',
    fontSize: 11,
    fontWeight: '600',
  },
  balanceLabel: {
    color: '#E8C4B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    color: '#FAF7F0',
    fontSize: 36,
    fontWeight: '900',
    marginVertical: 4,
  },
  balanceBarBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 6,
  },
  balanceBarFill: {
    height: '100%',
    backgroundColor: '#E8C4B8',
    borderRadius: 3,
  },
  balanceBarLabel: {
    color: 'rgba(250, 247, 240, 0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8C4B8',
    elevation: 2,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FAF7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  txnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8C4B8',
    elevation: 1,
  },
  txnTypeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnMain: {
    flex: 1,
  },
  txnVpa: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  txnDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
});
