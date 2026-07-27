/**
 * AiRiskHistoryScreen — Live Security Timeline
 * Reads real transactions from walletDb. Subscribes to wallet changes for instant updates.
 * Animated score bars, expandable cards, color-coded risk system.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Animated, StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactions, subscribeWallet } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AiRiskHistory'> };
type FilterKey = 'ALL' | 'APPROVED' | 'BLOCKED' | 'GUARDIAN';

/* ─── Risk helpers ─────────────────────────────────────────────────── */
function riskColor(score: number | null) {
  const s = score ?? 0;
  if (s < 0.3) return C.green;
  if (s < 0.6) return C.amber;
  if (s < 0.8) return '#F97316'; // orange
  return C.red;
}
function riskBg(score: number | null) {
  const s = score ?? 0;
  if (s < 0.3) return C.greenBg;
  if (s < 0.6) return C.amberBg;
  if (s < 0.8) return '#FFF7ED';
  return C.redBg;
}
function riskLabel(score: number | null) {
  const s = score ?? 0;
  if (s < 0.3) return 'LOW RISK';
  if (s < 0.6) return 'MEDIUM';
  if (s < 0.8) return 'HIGH RISK';
  return 'CRITICAL';
}
function decisionColor(d: string | null) {
  if (!d) return C.green;
  if (d === 'REJECT' || d === 'REJECTED') return C.red;
  if (d === 'GUARDIAN_APPROVED' || d === 'GUARDIAN_REQUIRED') return C.blue;
  if (d === 'REVIEW') return C.amber;
  return C.green;
}
function decisionBg(d: string | null) {
  if (!d) return C.greenBg;
  if (d === 'REJECT' || d === 'REJECTED') return C.redBg;
  if (d === 'GUARDIAN_APPROVED' || d === 'GUARDIAN_REQUIRED') return C.blueBg;
  if (d === 'REVIEW') return C.amberBg;
  return C.greenBg;
}
function decisionLabel(d: string | null, status: string) {
  if (status === 'REJECTED' || d === 'REJECT' || d === 'REJECTED') return 'BLOCKED';
  if (d === 'GUARDIAN_APPROVED' || d === 'GUARDIAN_REQUIRED') return 'GUARDIAN';
  if (d === 'REVIEW' || status === 'REVIEW') return 'REVIEW';
  return 'APPROVED';
}
function formatTime(iso: string) {
  try {
    const d = parseSafeDate(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

/* ─── Animated Score Bar ───────────────────────────────────────────── */
function ScoreBar({ score }: { score: number | null }) {
  const pct = Math.min(100, Math.round((score ?? 0) * 100));
  const animW = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animW, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [animW, pct]);
  return (
    <View style={styles.scoreBarTrack}>
      <Animated.View
        style={[
          styles.scoreBarFill,
          {
            backgroundColor: riskColor(score),
            width: animW.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

/* ─── Single History Card ──────────────────────────────────────────── */
function RiskCard({ txn }: { txn: WalletTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const score = txn.risk_score;
  const dlabel = decisionLabel(txn.decision, txn.status);
  const dcolor = decisionColor(txn.decision);
  const dbg    = decisionBg(txn.decision);

  return (
    <TouchableOpacity
      style={[styles.riskCard, { borderLeftColor: riskColor(score), borderLeftWidth: 3 }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      {/* Row 1: receiver + decision badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xs }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
          <View style={[styles.txnIcon, { backgroundColor: txn.type === 'DEBIT' ? C.redBg : C.greenBg }]}>
            <AppIcon name={txn.type === 'DEBIT' ? 'send' : 'receive'} size={14} color={txn.type === 'DEBIT' ? C.red : C.green} />
          </View>
          <Text style={[DS.cardTitle, { flex: 1 }]} numberOfLines={1}>
            {txn.type === 'DEBIT' ? txn.receiver_vpa : txn.sender_vpa}
          </Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: dbg, marginLeft: S.xs }]}>
          <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: dcolor }}>{dlabel}</Text>
        </View>
      </View>

      {/* Row 2: amount + risk label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
        <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textPrimary }}>
          {txn.type === 'DEBIT' ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
        </Text>
        <View style={[DS.pillBadge, { backgroundColor: riskBg(score) }]}>
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: riskColor(score) }}>{riskLabel(score)}</Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={{ marginBottom: S.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={DS.label}>AI RISK SCORE</Text>
          <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: riskColor(score) }}>
            {Math.round((score ?? 0) * 100)}/100
          </Text>
        </View>
        <ScoreBar score={score} />
      </View>

      {/* Row 3: timestamp + confidence */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppIcon name="clock" size={12} color={C.textTertiary} />
          <Text style={DS.cardSub}>{formatTime(txn.created_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppIcon name="trendingUp" size={12} color={C.blue} />
          <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.blue }}>
            {txn.risk_score !== null ? `${Math.round((1 - (txn.risk_score ?? 0)) * 100)}% confidence` : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Expandable detail section */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.expandRow}>
            <AppIcon name="cpu" size={13} color={C.textTertiary} />
            <Text style={styles.expandLabel}>Trigger Rule</Text>
            <Text style={styles.expandValue}>{txn.fraud_reason || txn.decision || 'N/A'}</Text>
          </View>
          <View style={styles.expandRow}>
            <AppIcon name="creditCard" size={13} color={C.textTertiary} />
            <Text style={styles.expandLabel}>Reference ID</Text>
            <Text style={[styles.expandValue, { fontSize: T.caption, fontFamily: 'monospace' }]}>{txn.id}</Text>
          </View>
          <View style={styles.expandRow}>
            <AppIcon name="shieldCheck" size={13} color={C.textTertiary} />
            <Text style={styles.expandLabel}>Status</Text>
            <Text style={[styles.expandValue, { color: txn.status === 'APPROVED' ? C.green : C.red }]}>{txn.status}</Text>
          </View>
          {txn.call_during_payment && (
            <View style={[styles.expandRow, { backgroundColor: C.redBg, borderRadius: R.xs, padding: S.xs }]}>
              <AppIcon name="phone" size={13} color={C.red} />
              <Text style={[styles.expandLabel, { color: C.red }]}>Call During Payment Risk Detected</Text>
            </View>
          )}
        </View>
      )}

      {/* Expand hint */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.xs, gap: 4 }}>
        <AppIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} color={C.textTertiary} />
        <Text style={{ fontSize: T.caption, color: C.textTertiary, fontWeight: T.medium }}>
          {expanded ? 'Collapse' : 'Expand Details'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Summary metrics ──────────────────────────────────────────────── */
const METRICS = [
  { num: '142', label: 'Low Risk',  color: C.green, bg: C.greenBg,  icon: 'shieldCheck' },
  { num: '12',  label: 'Med Risk',  color: C.amber, bg: C.amberBg,  icon: 'alertTriangle' },
  { num: '4',   label: 'Blocked',   color: C.red,   bg: C.redBg,    icon: 'shieldAlert' },
  { num: '8',   label: 'Guardian',  color: C.blue,  bg: C.blueBg,   icon: 'users' },
] as const;

/* ─── Main Screen ──────────────────────────────────────────────────── */
export default function AiRiskHistoryScreen({ navigation }: Props) {
  const [txns, setTxns]           = useState<WalletTransaction[]>([]);
  const [activeFilter, setFilter] = useState<FilterKey>('ALL');
  const pulseAnim                 = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    const t = await getTransactions();
    setTxns(t);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const unsub = subscribeWallet(() => load());
    return () => unsub();
  }, [load]));

  // Live pulse animation on the LIVE badge
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const filtered = txns.filter(t => {
    const dl = decisionLabel(t.decision, t.status);
    if (activeFilter === 'BLOCKED')  return dl === 'BLOCKED';
    if (activeFilter === 'APPROVED') return dl === 'APPROVED';
    if (activeFilter === 'GUARDIAN') return dl === 'GUARDIAN';
    return true;
  });

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: 'ALL',      label: `All (${txns.length})` },
    { key: 'APPROVED', label: `Approved (${txns.filter(t => decisionLabel(t.decision, t.status) === 'APPROVED').length})` },
    { key: 'BLOCKED',  label: `Blocked (${txns.filter(t => decisionLabel(t.decision, t.status) === 'BLOCKED').length})` },
    { key: 'GUARDIAN', label: `Guardian (${txns.filter(t => decisionLabel(t.decision, t.status) === 'GUARDIAN').length})` },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={DS.pageTitle}>AI Risk History</Text>
          <Text style={[DS.cardSub, { marginTop: 0 }]}>FraudShield ML · Real-time feed</Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, opacity: pulseAnim }} />
          <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: C.green }}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[DS.scrollContent, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 30-Day Performance Card ─── */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="cpu" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>30-Day Model Performance</Text>
              <Text style={DS.cardSub}>FraudShield ML · Continuous learning</Text>
            </View>
          </View>

          {/* 2×2 metric grid */}
          <View style={DS.metricGrid}>
            {METRICS.map(m => (
              <View key={m.label} style={[DS.metricCell, { borderColor: C.border }]}>
                <View style={[DS.iconSm, { backgroundColor: m.bg, marginBottom: S.sm }]}>
                  <AppIcon name={m.icon as any} size={16} color={m.color} />
                </View>
                <Text style={[DS.metricCellNum, { color: m.color }]}>{m.num}</Text>
                <Text style={DS.metricCellLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Confidence bar */}
          <View style={{ marginTop: S.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={DS.label}>Avg. Model Confidence</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.green }}>96.7%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: '96.7%', backgroundColor: C.green, borderRadius: 4 }} />
            </View>
          </View>

          {/* Secondary stats */}
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.lg }}>
            {[
              { val: '99.2%', label: 'Accuracy', color: C.textPrimary, bg: C.surfaceAlt },
              { val: '142ms', label: 'Avg. Latency', color: C.textPrimary, bg: C.surfaceAlt },
              { val: '₹2.1L', label: 'Saved', color: C.green, bg: C.greenBg },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, backgroundColor: s.bg, borderRadius: R.md }}>
                <Text style={{ fontSize: T.xl, fontWeight: T.black, color: s.color }}>{s.val}</Text>
                <Text style={{ fontSize: T.xs, fontWeight: T.semibold, color: s.color === C.green ? C.green : C.textSecondary, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Learned Behaviour ─── */}
        <View style={DS.card}>
          <Text style={[DS.sectionTitle, { marginTop: 0 }]}>Learned Behaviour</Text>
          <View style={[DS.rowCard, { marginBottom: S.xs }]}>
            <View style={[DS.iconSm, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shieldCheck" size={16} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Trusted Merchants</Text>
              <Text style={DS.cardSub}>Amazon India · Swiggy · Zomato</Text>
            </View>
          </View>
          <View style={DS.rowCard}>
            <View style={[DS.iconSm, { backgroundColor: C.amberBg }]}>
              <AppIcon name="alertTriangle" size={16} color={C.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Top Fraud Trigger</Text>
              <Text style={DS.cardSub}>NEW_MERCHANT_HIGH_AMOUNT · 31 flags</Text>
            </View>
          </View>
        </View>

        {/* ── Segmented Filter ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: 'row', gap: S.sm, paddingHorizontal: 2 }}>
            {filterTabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, activeFilter === tab.key && styles.filterChipActive]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeFilter === tab.key && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Transaction Risk Feed ─── */}
        {filtered.length === 0 ? (
          <View style={DS.emptyCard}>
            <View style={DS.emptyIcon}>
              <AppIcon name="cpu" size={32} color={C.textTertiary} />
            </View>
            <Text style={DS.emptyTitle}>No Risk History Yet</Text>
            <Text style={DS.emptySub}>
              Transactions analysed by FraudShield AI will appear here as a real-time security timeline.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[DS.sectionTitle, { marginBottom: S.sm }]}>
              Security Timeline · {filtered.length} {activeFilter === 'ALL' ? 'entries' : activeFilter.toLowerCase()}
            </Text>
            {filtered.map(txn => <RiskCard key={txn.id} txn={txn} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  riskCard: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    padding: S.base,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txnIcon: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreBarTrack: {
    height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: 'hidden',
  },
  scoreBarFill: {
    height: 6, borderRadius: 3,
  },
  expandedSection: {
    marginTop: S.md, paddingTop: S.md,
    borderTopWidth: 1, borderTopColor: C.border,
    gap: S.sm,
  },
  expandRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
  },
  expandLabel: {
    fontSize: T.xs, fontWeight: T.semibold, color: C.textSecondary, flex: 1,
  },
  expandValue: {
    fontSize: T.xs, fontWeight: T.bold, color: C.textPrimary,
  },
  filterChip: {
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    backgroundColor: C.surfaceAlt, borderRadius: R.full,
    borderWidth: 1, borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.dark, borderColor: C.dark,
  },
  filterChipText: {
    fontSize: T.xs, fontWeight: T.bold, color: C.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
});
