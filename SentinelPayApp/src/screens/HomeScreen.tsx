/**
 * HomeScreen.tsx — V2 Overview-only Home Screen
 * Shows: Balance Hero, Quick Actions, Recent Activity, Guardian summary, FraudShield status
 * Bottom Nav: Home | Payments | FraudShield | Notifications | More
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, StatusBar, SafeAreaView, Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletUser, WalletTransaction } from '../types';
import { getUser, getTransactions, syncCloudTransactions, subscribeWallet } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import fraudShieldApi from '../services/fraudShieldApi';
import RiskBadge from '../components/RiskBadge';
import AppIcon from '../components/AppIcon';
import AnimatedPressable from '../components/AnimatedPressable';
import { notificationService } from '../services/notificationService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };
type BottomTab = 'home' | 'payments' | 'fraudshield' | 'notifications' | 'more';

function formatAmount(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function formatTime(iso: string) {
  const d = parseSafeDate(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function HomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [user, setUser] = useState<WalletUser | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [backendStatus, setBackendStatus] = useState<'UP' | 'DOWN' | 'CHECKING'>('CHECKING');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const isFetchingRef = useRef(false);
  const failedCheckCountRef = useRef(0);

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [u, localT] = await Promise.all([getUser(), getTransactions()]);
      if (!u) { navigation.replace('AuthModeSelector'); return; }
      setUser(u);
      setTxns(localT.slice(0, 5));
      if (u.vpa) {
        syncCloudTransactions(u.vpa).then(synced => {
          setTxns(synced.slice(0, 5));
          getUser().then(updated => { if (updated) setUser(updated); }).catch(() => {});
        }).catch(() => {});
      }
    } catch (e) {
      console.error('HomeScreen loadData:', e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [navigation]);

  const checkBackend = useCallback(async () => {
    try {
      const h = await fraudShieldApi.checkHealth();
      const isUp = h && (h.status === 'HEALTHY' || h.status === 'DEGRADED' || h.status === 'UP' || h.status === 'active' || h.status === 'OK');
      if (isUp) { failedCheckCountRef.current = 0; setBackendStatus('UP'); }
      else { failedCheckCountRef.current += 1; if (failedCheckCountRef.current >= 2) setBackendStatus('DOWN'); }
    } catch {
      failedCheckCountRef.current += 1;
      if (failedCheckCountRef.current >= 2) setBackendStatus('DOWN');
    }
  }, []);

  const bellRingAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const updateCount = async () => {
      const count = await notificationService.getUnreadCount();
      setUnreadNotifCount(count);
    };
    updateCount();
    const unsub = notificationService.subscribe(async () => {
      const count = await notificationService.getUnreadCount();
      setUnreadNotifCount(prev => {
        if (count > prev) {
          Animated.sequence([
            Animated.timing(bellRingAnim, { toValue: 15, duration: 70, useNativeDriver: true }),
            Animated.timing(bellRingAnim, { toValue: -15, duration: 70, useNativeDriver: true }),
            Animated.timing(bellRingAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
            Animated.timing(bellRingAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
            Animated.timing(bellRingAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
          ]).start();
        }
        return count;
      });
    });
    return () => unsub();
  }, [bellRingAnim]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkBackend();
      const unsubWallet = subscribeWallet(() => { loadData(); });
      const timer = setInterval(() => { loadData(); }, 12000);
      return () => { unsubWallet(); clearInterval(timer); };
    }, [loadData, checkBackend]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), checkBackend()]);
    setRefreshing(false);
  };

  // ─── Handle tab press — navigate to separate screens ────────────────────────
  const handleTabPress = (tab: BottomTab) => {
    setActiveTab(tab);
    if (tab === 'payments') { navigation.navigate('Payments'); return; }
    if (tab === 'fraudshield') { navigation.navigate('FraudShield'); return; }
    if (tab === 'notifications') { navigation.navigate('Notifications'); return; }
    if (tab === 'more') { navigation.navigate('More'); return; }
    // 'home' — stay here
  };

  // Reset active tab to home when screen comes into focus
  useFocusEffect(useCallback(() => { setActiveTab('home'); }, []));

  const balance = user?.balance ?? 0;
  const balancePct = Math.min(100, Math.max(0, Math.round((balance / 100000) * 100)));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerBrandRow}>
          <View style={styles.brandIconSquare}>
            <AppIcon name="shield" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.brandTitleText}>SentinelPay</Text>
            <Text style={styles.brandSubtitleText}>AI CYBERSECURITY WALLET</Text>
          </View>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')}>
            <Animated.View style={{ transform: [{ rotate: bellRingAnim.interpolate({ inputRange: [-15, 15], outputRange: ['-15deg', '15deg'] }) }] }}>
              <AppIcon name="bell" size={18} color="#0F172A" />
            </Animated.View>
            {unreadNotifCount > 0 && (
              <View style={styles.bellBadgeCircle}>
                <Text style={styles.bellBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* ─── HERO BALANCE CARD ─── */}
        <View style={styles.heroBalanceCard}>
          <View style={styles.heroCardHeader}>
            <View style={styles.vpaPill}>
              <AppIcon name="shield" size={14} color="#10B981" />
              <Text style={styles.vpaPillText} numberOfLines={1}>{user?.vpa || 'account@sentinelpay'}</Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: backendStatus === 'UP' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
              <View style={[styles.statusDot, { backgroundColor: backendStatus === 'UP' ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusTagText, { color: backendStatus === 'UP' ? '#34D399' : '#F87171' }]}>
                {backendStatus === 'UP' ? 'AI Protected' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={styles.heroBalanceRow}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE BAL</Text>
              <Text style={styles.balanceDisplay}>{formatAmount(balance)}</Text>
            </View>
            <View style={styles.scoreBadgeCircle}>
              <Text style={styles.scoreNumber}>98</Text>
              <Text style={styles.scoreLabel}>SCORE</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${balancePct}%` as any }]} />
          </View>
          <Text style={styles.progressSubtext}>{balancePct}% of ₹1,00,000 Sentinel Credits active</Text>
        </View>

        {/* ─── QUICK ACTIONS ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionGrid}>
          <AnimatedPressable style={styles.actionPillCard} onPress={() => navigation.navigate('SendMoney', {})}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <AppIcon name="send" size={20} color="#059669" />
            </View>
            <Text style={styles.actionPillText}>Send</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionPillCard} onPress={() => navigation.navigate('ReceiveMoney')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <AppIcon name="receive" size={20} color="#2563EB" />
            </View>
            <Text style={styles.actionPillText}>Receive</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionPillCard} onPress={() => navigation.navigate('ScanQR')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#F5F3FF' }]}>
              <AppIcon name="scan" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.actionPillText}>Scan QR</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionPillCard} onPress={() => navigation.navigate('TransactionHistory')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#FFFBEB' }]}>
              <AppIcon name="history" size={20} color="#D97706" />
            </View>
            <Text style={styles.actionPillText}>History</Text>
          </AnimatedPressable>
        </View>

        {/* ─── GUARDIAN SUMMARY CARD ─── */}
        <TouchableOpacity style={styles.summaryCard} onPress={() => navigation.navigate('GuardianManagement')} activeOpacity={0.7}>
          <View style={[styles.summaryIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <AppIcon name="guardian" size={22} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Guardian & Safety</Text>
            <Text style={styles.summarySub}>Manage trusted contacts & protection rules</Text>
          </View>
          <AppIcon name="chevronRight" size={16} color="#94A3B8" />
        </TouchableOpacity>

        {/* ─── FRAUDSHIELD STATUS CARD ─── */}
        <TouchableOpacity style={styles.summaryCard} onPress={() => navigation.navigate('FraudShield')} activeOpacity={0.7}>
          <View style={[styles.summaryIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <AppIcon name="shieldCheck" size={22} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>FraudShield AI</Text>
            <Text style={styles.summarySub}>
              {backendStatus === 'UP' ? '⚡ AI Protection Engine Active · Sub-200ms' : 'Protection offline — tap to view'}
            </Text>
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: backendStatus === 'UP' ? '#ECFDF5' : '#FEF2F2' }]}>
            <View style={[styles.statusDot, { backgroundColor: backendStatus === 'UP' ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.statusTagText, { color: backendStatus === 'UP' ? '#10B981' : '#EF4444' }]}>
              {backendStatus === 'UP' ? 'ON' : 'OFF'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ─── RECENT ACTIVITY ─── */}
        <View style={styles.sectionHeaderBetween}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {txns.length > 0 && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('TransactionHistory')}>
              <Text style={styles.seeAllBtn}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>

        {txns.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppIcon name="coin" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Recent Activity</Text>
            <Text style={styles.emptySub}>Your real-time transactions will appear here.</Text>
          </View>
        ) : (
          txns.map(txn => (
            <TouchableOpacity
              key={txn.id}
              style={styles.activityRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })}
            >
              <View style={[styles.activityIconCircle, { backgroundColor: txn.type === 'DEBIT' ? '#FEF2F2' : '#ECFDF5' }]}>
                <AppIcon name={txn.type === 'DEBIT' ? 'send' : 'receive'} size={18} color={txn.type === 'DEBIT' ? '#EF4444' : '#10B981'} />
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityVpa} numberOfLines={1}>
                  {txn.type === 'DEBIT' ? `To: ${txn.receiver_vpa}` : `From: ${txn.sender_vpa}`}
                </Text>
                <Text style={styles.activityTime}>{formatTime(txn.created_at)}</Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={[styles.activityAmount, { color: txn.type === 'DEBIT' ? '#EF4444' : '#10B981' }]}>
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
      </ScrollView>

      {/* ─── 5-TAB BOTTOM NAV ─── */}
      <View style={styles.bottomTabContainer}>
        {/* Home */}
        <TouchableOpacity style={[styles.tabButton, activeTab === 'home' && styles.tabButtonActive]} activeOpacity={0.7} onPress={() => handleTabPress('home')}>
          <AppIcon name="home" size={20} color={activeTab === 'home' ? '#2563EB' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        {/* Payments */}
        <TouchableOpacity style={[styles.tabButton, activeTab === 'payments' && styles.tabButtonActive]} activeOpacity={0.7} onPress={() => handleTabPress('payments')}>
          <AppIcon name="send" size={20} color={activeTab === 'payments' ? '#EF4444' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'payments' && styles.tabLabelPayments]}>Payments</Text>
        </TouchableOpacity>

        {/* FraudShield */}
        <TouchableOpacity style={[styles.tabButton, activeTab === 'fraudshield' && styles.tabButtonActive]} activeOpacity={0.7} onPress={() => handleTabPress('fraudshield')}>
          <AppIcon name="shieldCheck" size={20} color={activeTab === 'fraudshield' ? '#10B981' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'fraudshield' && styles.tabLabelFraud]}>FraudShield</Text>
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity style={[styles.tabButton, activeTab === 'notifications' && styles.tabButtonActive]} activeOpacity={0.7} onPress={() => handleTabPress('notifications')}>
          <View>
            <AppIcon name="bell" size={20} color={activeTab === 'notifications' ? '#7C3AED' : '#64748B'} />
            {unreadNotifCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'notifications' && styles.tabLabelNotif]}>Alerts</Text>
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity style={[styles.tabButton, activeTab === 'more' && styles.tabButtonActive]} activeOpacity={0.7} onPress={() => handleTabPress('more')}>
          <AppIcon name="menu" size={20} color={activeTab === 'more' ? '#0F172A' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'more' && styles.tabLabelMore]}>More</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  /* Header */
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F8FAFC',
  },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIconSquare: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  brandTitleText: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  brandSubtitleText: { fontSize: 9, fontWeight: '800', color: '#10B981', letterSpacing: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { position: 'relative', padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },
  bellBadgeCircle: {
    position: 'absolute', top: 4, right: 4, width: 16, height: 16,
    borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },

  mainScrollView: { flex: 1 },
  scrollContentContainer: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },

  /* Hero Balance Card */
  heroBalanceCard: {
    backgroundColor: '#0F172A', borderRadius: 24, padding: 20, marginBottom: 16,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  heroCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  vpaPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, maxWidth: '60%' },
  vpaPillText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  statusTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: 11, fontWeight: '800' },
  heroBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  balanceLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 1.5 },
  balanceDisplay: { fontSize: 36, fontWeight: '900', color: '#F8FAFC', letterSpacing: -1, marginTop: 4 },
  scoreBadgeCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#10B981' },
  scoreNumber: { fontSize: 20, fontWeight: '900', color: '#10B981' },
  scoreLabel: { fontSize: 8, fontWeight: '800', color: '#6EE7B7', letterSpacing: 1 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 6 },
  progressFill: { height: 4, backgroundColor: '#10B981', borderRadius: 2 },
  progressSubtext: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  /* Quick Actions */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionHeaderBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  seeAllBtn: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  quickActionGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionPillCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  actionIconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionPillText: { fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },

  /* Summary Cards */
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 14, marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  summaryIconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  summarySub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '500' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },

  /* Activity */
  activityRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  activityIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityDetails: { flex: 1 },
  activityVpa: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  activityTime: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { fontSize: 14, fontWeight: '800' },

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', fontWeight: '500' },

  /* Bottom Nav */
  bottomTabContainer: {
    position: 'absolute', bottom: 16, left: 16, right: 16, height: 62,
    backgroundColor: '#FFFFFF', borderRadius: 31,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  tabButton: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: '#F1F5F9' },
  tabLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', marginTop: 2 },
  tabLabelActive: { color: '#2563EB', fontWeight: '800' },
  tabLabelPayments: { color: '#EF4444', fontWeight: '800' },
  tabLabelFraud: { color: '#10B981', fontWeight: '800' },
  tabLabelNotif: { color: '#7C3AED', fontWeight: '800' },
  tabLabelMore: { color: '#0F172A', fontWeight: '800' },
  tabBadge: {
    position: 'absolute', top: -4, right: -6, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
});
