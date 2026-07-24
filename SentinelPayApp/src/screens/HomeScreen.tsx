/**
 * HomeScreen — Luxury Cybersecurity AI Wallet Dashboard
 * Design Theme: Warm Stone (#F7F3EA) + Charcoal (#181818) + Sea Green (#2E8B57)
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
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  }, [navigation]);

  const checkBackend = useCallback(async () => {
    try {
      const h = await fraudShieldApi.checkHealth();
      const isUp = h && (h.status === 'HEALTHY' || h.status === 'DEGRADED' || h.status === 'UP' || h.status === 'active');
      setBackendStatus(isUp ? 'UP' : 'DOWN');
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
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2E8B57" />}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F3EA" />

      {/* ── 1. TOP HEADER BAR ── */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.brandTitle}>SentinelPay</Text>
          <Text style={styles.brandSubtitle}>AI CYBERSECURITY WALLET</Text>
        </View>
        <View style={styles.topHeaderIcons}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.navigate('Profile')}>
            <AppIcon name="profile" size={18} color="#181818" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.navigate('Settings')}>
            <AppIcon name="settings" size={18} color="#181818" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. HERO AI PROTECTION & BALANCE DASHBOARD ── */}
      <View style={styles.heroCard}>
        {/* User Identity & Backend Status Header */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.userVpaChip}>
            <AppIcon name="shield" size={12} color="#2E8B57" />
            <Text style={styles.vpaChipText} numberOfLines={1}>{user?.vpa || 'account@sentinelpay'}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: backendStatus === 'UP' ? 'rgba(46, 139, 87, 0.12)' : 'rgba(192, 57, 43, 0.12)' }]}>
            <View style={[styles.statusDot, { backgroundColor: backendStatus === 'UP' ? '#2E8B57' : '#C0392B' }]} />
            <Text style={[styles.statusText, { color: backendStatus === 'UP' ? '#236847' : '#C0392B' }]}>
              {backendStatus === 'UP' ? 'AI Shield Active' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Protection Score Ring & Main Balance */}
        <View style={styles.heroBodyGrid}>
          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balanceValue}>{formatAmount(balance)}</Text>
            <Text style={styles.balanceSubtext}>{balancePct}% of ₹1,00,000 SPC available</Text>
          </View>

          {/* Protection Score Ring Widget */}
          <View style={styles.scoreGaugeBox}>
            <View style={styles.scoreOuterRing}>
              <View style={styles.scoreInnerRing}>
                <Text style={styles.scoreValText}>98</Text>
                <Text style={styles.scoreLabelText}>PROTECTED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.balanceBarTrack}>
          <View style={[styles.balanceBarFill, { width: `${balancePct}%` as any }]} />
        </View>
      </View>

      {/* ── 3. AI INSIGHTS & SECURITY TIMELINE ── */}
      <View style={styles.aiInsightBanner}>
        <View style={styles.aiInsightIconCol}>
          <AppIcon name="assistant" size={20} color="#2E8B57" />
        </View>
        <View style={styles.aiInsightTextCol}>
          <View style={styles.aiHeaderRow}>
            <Text style={styles.aiInsightTitle}>Real-time Protection Engine</Text>
            <View style={styles.aiLiveBadge}>
              <Text style={styles.aiLiveBadgeText}>6ms LATENCY</Text>
            </View>
          </View>
          <Text style={styles.aiInsightBody}>
            FraudShield ML model & 10-rule engine monitoring active device & SMS vectors.
          </Text>
        </View>
      </View>

      {/* ── 4. QUICK PAY ACTIONS ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Quick Pay</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SendMoney', {})}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="send" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ReceiveMoney')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="receive" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScanQR')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="scan" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('TransactionHistory')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="history" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 5. SAFETY & SECURITY SUITE ── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Cybersecurity Suite</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('GuardianManagement')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="guardian" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>Guardians</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SmsTracker')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="sms" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>SMS Shield</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScamAssistant')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="assistant" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>AI Assistant</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ScamHeatMap')}>
            <View style={styles.actionIconContainer}>
              <AppIcon name="heatmap" size={20} color="#2E8B57" />
            </View>
            <Text style={styles.actionCardText}>Threat Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 6. RECENT ACTIVITY FEED ── */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {txns.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
              <Text style={styles.seeAllText}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>

        {txns.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppIcon name="coin" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Transactions Recorded</Text>
            <Text style={styles.emptySubtitle}>Your recent scored transfers will appear here in real time.</Text>
          </View>
        ) : (
          txns.map(txn => (
            <TouchableOpacity
              key={txn.id}
              style={styles.txnItemCard}
              onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })}>
              <View style={[styles.txnIconCircle, { backgroundColor: txn.type === 'DEBIT' ? 'rgba(192, 57, 43, 0.1)' : 'rgba(46, 139, 87, 0.1)' }]}>
                <AppIcon name={txn.type === 'DEBIT' ? 'send' : 'receive'} size={16} color={txn.type === 'DEBIT' ? '#C0392B' : '#2E8B57'} />
              </View>
              <View style={styles.txnMainCol}>
                <Text style={styles.txnVpaText} numberOfLines={1}>
                  {txn.type === 'DEBIT' ? txn.receiver_vpa : txn.sender_vpa}
                </Text>
                <Text style={styles.txnTimeText}>{formatTime(txn.created_at)}</Text>
              </View>
              <View style={styles.txnAmountCol}>
                <Text style={[styles.txnAmountText, { color: txn.type === 'DEBIT' ? '#C0392B' : '#2E8B57' }]}>
                  {txn.type === 'DEBIT' ? '-' : '+'}{formatAmount(txn.amount)}
                </Text>
                {txn.decision && (
                  <View style={{ marginTop: 2 }}>
                    <RiskBadge decision={txn.decision} riskScore={txn.risk_score} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ── 7. SECURITY INFRASTRUCTURE BANNER ── */}
      <View style={styles.footerSecurityCard}>
        <View style={styles.footerTitleRow}>
          <AppIcon name="shield" size={16} color="#2E8B57" />
          <Text style={styles.footerTitle}>SentinelPay AI Security Infrastructure</Text>
        </View>
        <Text style={styles.footerBody}>
          Continuous fraud scoring backed by graph analytics, model drift checks, and sub-200ms transaction authorization.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F3EA',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* 1. TOP HEADER */
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#181818',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E8B57',
    letterSpacing: 1,
    marginTop: 1,
  },
  topHeaderIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFE7DA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },

  /* 2. HERO DASHBOARD CARD */
  heroCard: {
    backgroundColor: '#EFE7DA',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCD1BF',
    shadowColor: '#181818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DCD1BF',
  },
  userVpaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F3EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  vpaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#181818',
    maxWidth: 160,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  heroBodyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceCol: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#181818',
    letterSpacing: -0.5,
  },
  balanceSubtext: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontWeight: '600',
  },

  /* Protection Gauge Box */
  scoreGaugeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scoreOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#2E8B57',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F3EA',
  },
  scoreInnerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E8B57',
    lineHeight: 20,
  },
  scoreLabelText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 0.5,
  },

  balanceBarTrack: {
    height: 6,
    backgroundColor: '#DCD1BF',
    borderRadius: 3,
    overflow: 'hidden',
  },
  balanceBarFill: {
    height: '100%',
    backgroundColor: '#2E8B57',
    borderRadius: 3,
  },

  /* 3. AI INSIGHT BANNER */
  aiInsightBanner: {
    flexDirection: 'row',
    backgroundColor: '#E5DCCB',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  aiInsightIconCol: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F7F3EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  aiInsightTextCol: {
    flex: 1,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiInsightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#181818',
  },
  aiLiveBadge: {
    backgroundColor: 'rgba(46, 139, 87, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#236847',
  },
  aiInsightBody: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },

  /* 4. SECTION BLOCK & GRIDS */
  sectionBlock: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#181818',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E8B57',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#EFE7DA',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  actionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F7F3EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  actionCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#181818',
  },

  /* RECENT ACTIVITY ITEMS */
  emptyContainer: {
    backgroundColor: '#EFE7DA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#181818',
    marginTop: 8,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  txnItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE7DA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  txnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnMainCol: {
    flex: 1,
  },
  txnVpaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#181818',
  },
  txnTimeText: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  txnAmountCol: {
    alignItems: 'flex-end',
  },
  txnAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },

  /* FOOTER CARD */
  footerSecurityCard: {
    backgroundColor: '#E5DCCB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCD1BF',
    marginTop: 4,
  },
  footerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#181818',
  },
  footerBody: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 17,
  },
});
