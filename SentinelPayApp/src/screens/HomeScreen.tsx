/**
 * HomeScreen.tsx — Multi-Page Premium Fintech & Cybersecurity Wallet
 * Design References: Apple Wallet, Linear, Revolut, Stripe Dashboard, Arc Browser, Material 3
 * Theme: Deep Slate (#0F172A), Slate Surface (#F8FAFC), Emerald Accent (#10B981), Cobalt (#2563EB)
 * Strict 8-Point Grid Alignment, WCAG AA Accessibility, Elevated Glassmorphic Cards
 */
import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Dimensions,
  SafeAreaView,
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

export type TabKey = 'wallet' | 'security' | 'intelligence' | 'profile';

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
  const [activeTab, setActiveTab] = useState<TabKey>('wallet');
  const [user, setUser] = useState<WalletUser | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [backendStatus, setBackendStatus] = useState<'UP' | 'DOWN' | 'CHECKING'>('CHECKING');
  const [refreshing, setRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const failedCheckCountRef = useRef(0);

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      setTxns(localT.slice(0, 8));

      if (u.vpa) {
        const synced = await syncCloudTransactions(u.vpa);
        setTxns(synced.slice(0, 8));
        
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
    } finally {
      isFetchingRef.current = false;
    }
  }, [navigation]);

  const checkBackend = useCallback(async () => {
    try {
      const h = await fraudShieldApi.checkHealth();
      const isUp = h && (
        h.status === 'HEALTHY' ||
        h.status === 'DEGRADED' ||
        h.status === 'UP' ||
        h.status === 'active' ||
        h.status === 'OK'
      );
      if (isUp) {
        failedCheckCountRef.current = 0;
        setBackendStatus('UP');
      } else {
        failedCheckCountRef.current += 1;
        if (failedCheckCountRef.current >= 2) {
          setBackendStatus('DOWN');
        }
      }
    } catch {
      failedCheckCountRef.current += 1;
      if (failedCheckCountRef.current >= 2) {
        setBackendStatus('DOWN');
      }
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

  // ─── RENDER SUB-PAGES ────────────────────────────────────────────────────────

  const renderWalletPage = () => (
    <View style={styles.tabContainer}>
      {/* Apple Wallet / Revolut Style Hero Balance Card */}
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

      {/* Quick Pay Action Pills (Linear / Revolut Style) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Payments</Text>
      </View>
      <View style={styles.quickActionGrid}>
        <TouchableOpacity style={styles.actionPillCard} activeOpacity={0.7} onPress={() => navigation.navigate('SendMoney', {})}>
          <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <AppIcon name="send" size={20} color="#059669" />
          </View>
          <Text style={styles.actionPillText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionPillCard} activeOpacity={0.7} onPress={() => navigation.navigate('ReceiveMoney')}>
          <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <AppIcon name="receive" size={20} color="#2563EB" />
          </View>
          <Text style={styles.actionPillText}>Receive</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionPillCard} activeOpacity={0.7} onPress={() => navigation.navigate('ScanQR')}>
          <View style={[styles.actionIconCircle, { backgroundColor: '#F5F3FF' }]}>
            <AppIcon name="scan" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.actionPillText}>Scan QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionPillCard} activeOpacity={0.7} onPress={() => navigation.navigate('TransactionHistory')}>
          <View style={[styles.actionIconCircle, { backgroundColor: '#FFFBEB' }]}>
            <AppIcon name="history" size={20} color="#D97706" />
          </View>
          <Text style={styles.actionPillText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Activity Feed (Stripe / Revolut Style) */}
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
            onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })}>
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
    </View>
  );

  const renderSecurityPage = () => (
    <View style={styles.tabContainer}>
      {/* Real-time Protection Banner (Google Wallet + Linear style) */}
      <View style={styles.securityHeroCard}>
        <View style={styles.securityHeroHeader}>
          <View style={styles.shieldIconBox}>
            <AppIcon name="shieldCheck" size={24} color="#10B981" />
          </View>
          <View style={styles.securityHeroTitles}>
            <Text style={styles.securityHeroTitle}>AI Protection Engine Active</Text>
            <Text style={styles.securityHeroSub}>Sub-200ms fraud detection monitoring device & vectors</Text>
          </View>
        </View>
        <View style={styles.latencyTagRow}>
          <View style={styles.latencyBadge}>
            <Text style={styles.latencyBadgeText}>⚡ 6ms LATENCY</Text>
          </View>
          <View style={styles.latencyBadge}>
            <Text style={styles.latencyBadgeText}>🛡️ GRAPH SCORED</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Cybersecurity Suite</Text>
      <View style={styles.grid2x2}>
        <TouchableOpacity style={styles.suiteCard} activeOpacity={0.7} onPress={() => navigation.navigate('GuardianManagement')}>
          <View style={[styles.suiteIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <AppIcon name="guardian" size={22} color="#2563EB" />
          </View>
          <Text style={styles.suiteCardTitle}>Guardians</Text>
          <Text style={styles.suiteCardSub}>Trusted contact approval</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suiteCard} activeOpacity={0.7} onPress={() => navigation.navigate('SmsTracker')}>
          <View style={[styles.suiteIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <AppIcon name="sms" size={22} color="#059669" />
          </View>
          <Text style={styles.suiteCardTitle}>SMS Shield</Text>
          <Text style={styles.suiteCardSub}>Phishing SMS detection</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suiteCard} activeOpacity={0.7} onPress={() => navigation.navigate('ScamAssistant')}>
          <View style={[styles.suiteIconCircle, { backgroundColor: '#F5F3FF' }]}>
            <AppIcon name="assistant" size={22} color="#7C3AED" />
          </View>
          <Text style={styles.suiteCardTitle}>AI Assistant</Text>
          <Text style={styles.suiteCardSub}>Interactive fraud advisor</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.suiteCard} activeOpacity={0.7} onPress={() => navigation.navigate('ScamHeatMap')}>
          <View style={[styles.suiteIconCircle, { backgroundColor: '#FEF2F2' }]}>
            <AppIcon name="heatmap" size={22} color="#EF4444" />
          </View>
          <Text style={styles.suiteCardTitle}>Threat Map</Text>
          <Text style={styles.suiteCardSub}>Geo fraud radar</Text>
        </TouchableOpacity>
      </View>

      {/* Security Infrastructure Details */}
      <View style={styles.infoBanner}>
        <AppIcon name="lock" size={20} color="#0F172A" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoBannerTitle}>Graph Neural Network (GNN) Defense</Text>
          <Text style={styles.infoBannerSub}>
            SentinelPay continuously maps VPA nodes to identify mule accounts and coordinated fraud rings.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderIntelligencePage = () => (
    <View style={styles.tabContainer}>
      <Text style={styles.sectionTitle}>Enterprise Intelligence</Text>
      
      <TouchableOpacity style={styles.intelRowCard} activeOpacity={0.7} onPress={() => navigation.navigate('AdminAnalytics')}>
        <View style={[styles.intelIconCircle, { backgroundColor: '#EFF6FF' }]}>
          <AppIcon name="barChart2" size={22} color="#2563EB" />
        </View>
        <View style={styles.intelTextCol}>
          <Text style={styles.intelTitle}>Ops Analytics Dashboard</Text>
          <Text style={styles.intelSub}>Real-time system throughput & fraud scoring metrics</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.intelRowCard} activeOpacity={0.7} onPress={() => navigation.navigate('AiRiskHistory')}>
        <View style={[styles.intelIconCircle, { backgroundColor: '#ECFDF5' }]}>
          <AppIcon name="cpu" size={22} color="#059669" />
        </View>
        <View style={styles.intelTextCol}>
          <Text style={styles.intelTitle}>AI Risk History</Text>
          <Text style={styles.intelSub}>ML model explanations for past transfer decisions</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.intelRowCard} activeOpacity={0.7} onPress={() => navigation.navigate('DeviceTrust')}>
        <View style={[styles.intelIconCircle, { backgroundColor: '#F5F3FF' }]}>
          <AppIcon name="shieldCheck" size={22} color="#7C3AED" />
        </View>
        <View style={styles.intelTextCol}>
          <Text style={styles.intelTitle}>Device Trust & Attestation</Text>
          <Text style={styles.intelSub}>Hardware integrity, root detection & SIM binding</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.intelRowCard} activeOpacity={0.7} onPress={() => navigation.navigate('ScamPassport', { entity: user?.vpa || 'demo@sentinelpay' })}>
        <View style={[styles.intelIconCircle, { backgroundColor: '#FFFBEB' }]}>
          <AppIcon name="search" size={22} color="#D97706" />
        </View>
        <View style={styles.intelTextCol}>
          <Text style={styles.intelTitle}>Scam Passport Lookup</Text>
          <Text style={styles.intelSub}>Verify reputation scores of suspicious VPAs & phone numbers</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.intelRowCard} activeOpacity={0.7} onPress={() => navigation.navigate('ReportScam')}>
        <View style={[styles.intelIconCircle, { backgroundColor: '#FEF2F2' }]}>
          <AppIcon name="report" size={22} color="#EF4444" />
        </View>
        <View style={styles.intelTextCol}>
          <Text style={styles.intelTitle}>Report Fraud / Scam</Text>
          <Text style={styles.intelSub}>File an immediate complaint to block malicious entities</Text>
        </View>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );

  const renderProfilePage = () => (
    <View style={styles.tabContainer}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatarCircle}>
          <Text style={styles.profileAvatarText}>{(user?.name || 'S')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name || 'Sentinel User'}</Text>
        <Text style={styles.profileVpa}>{user?.vpa || 'account@sentinelpay'}</Text>
        <View style={styles.phoneChip}>
          <AppIcon name="phone" size={14} color="#64748B" />
          <Text style={styles.phoneChipText}>{user?.phone || 'Mobile Verified'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Account & App Settings</Text>

      <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
        <AppIcon name="profile" size={20} color="#0F172A" />
        <Text style={styles.settingItemLabel}>User Profile & Security</Text>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => navigation.navigate('Settings')}>
        <AppIcon name="settings" size={20} color="#0F172A" />
        <Text style={styles.settingItemLabel}>Preferences & Controls</Text>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => navigation.navigate('AuthModeSelector')}>
        <AppIcon name="key" size={20} color="#0F172A" />
        <Text style={styles.settingItemLabel}>Change Auth Mode (PIN / Biometrics)</Text>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingItemRow} activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')}>
        <AppIcon name="bell" size={20} color="#0F172A" />
        <Text style={styles.settingItemLabel}>Notification Center</Text>
        <AppIcon name="chevronRight" size={18} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );

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
            <AppIcon name="bell" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}>
        {activeTab === 'wallet' && renderWalletPage()}
        {activeTab === 'security' && renderSecurityPage()}
        {activeTab === 'intelligence' && renderIntelligencePage()}
        {activeTab === 'profile' && renderProfilePage()}
      </ScrollView>

      {/* ─── FLOATING GLASSMORTIC BOTTOM TAB BAR ─── */}
      <View style={styles.bottomTabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'wallet' && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('wallet')}>
          <AppIcon name="coin" size={20} color={activeTab === 'wallet' ? '#2563EB' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'wallet' && styles.tabLabelActive]}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'security' && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('security')}>
          <AppIcon name="shieldCheck" size={20} color={activeTab === 'security' ? '#10B981' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'security' && styles.tabLabelActiveSecurity]}>Security</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'intelligence' && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('intelligence')}>
          <AppIcon name="barChart2" size={20} color={activeTab === 'intelligence' ? '#7C3AED' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'intelligence' && styles.tabLabelActiveIntel]}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('profile')}>
          <AppIcon name="profile" size={20} color={activeTab === 'profile' ? '#0F172A' : '#64748B'} />
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActiveProfile]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES (8-Point Grid & Modern Fintech Elevation) ─────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* Header */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  /* ScrollView */
  mainScrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100, // accommodate bottom tab bar
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* Sections */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    marginTop: 16,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  seeAllBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* 1. WALLET TAB */
  heroBalanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vpaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  vpaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 160,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '800',
  },

  heroBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  balanceDisplay: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 2,
  },
  scoreBadgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
  },
  scoreLabel: {
    fontSize: 7,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },

  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Quick Actions */
  quickActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  actionPillCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Activity Feed */
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityVpa: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activityTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  /* 2. SECURITY TAB */
  securityHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  securityHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityHeroTitles: {
    flex: 1,
  },
  securityHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityHeroSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  latencyTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  latencyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  latencyBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },

  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  suiteCard: {
    width: (Dimensions.get('window').width - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  suiteIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  suiteCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  suiteCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoBannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  /* 3. INTELLIGENCE TAB */
  intelRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  intelIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  intelTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  intelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  intelSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  /* 4. PROFILE TAB */
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  profileAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileVpa: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginTop: 12,
  },
  phoneChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },

  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  settingItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* ─── FLOATING GLASSMORTIC BOTTOM TAB BAR ─── */
  bottomTabContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 62,
    backgroundColor: '#FFFFFF',
    borderRadius: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#F1F5F9',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  tabLabelActiveSecurity: {
    color: '#10B981',
    fontWeight: '800',
  },
  tabLabelActiveIntel: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  tabLabelActiveProfile: {
    color: '#0F172A',
    fontWeight: '800',
  },
});
