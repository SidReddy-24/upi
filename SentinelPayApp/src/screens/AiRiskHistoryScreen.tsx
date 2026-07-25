import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AiRiskHistory'>;
};

const METRICS = [
  { num: '142', label: 'Low Risk', color: C.green,  iconColor: C.green,  bg: C.greenBg,  icon: 'shieldCheck' },
  { num: '12',  label: 'Med Risk', color: C.amber,  iconColor: C.amber,  bg: C.amberBg,  icon: 'alertTriangle' },
  { num: '4',   label: 'Blocked',  color: C.red,    iconColor: C.red,    bg: C.redBg,    icon: 'shieldAlert' },
  { num: '8',   label: 'Guardian', color: C.blue,   iconColor: C.blue,   bg: C.blueBg,   icon: 'users' },
] as const;

export default function AiRiskHistoryScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BLOCKED' | 'APPROVED'>('ALL');

  const historyItems = [
    { id: 'SP260724X91M84', amount: 500,   receiver: 'alice@sentinelpay',           score: 0.12, decision: 'APPROVE',           confidence: 98.4, date: 'Today, 8:02 PM',        rule: 'Trusted Recipient' },
    { id: 'SP260724A81D72', amount: 1200,  receiver: 'merchant_shop@sentinelpay',   score: 0.45, decision: 'GUARDIAN_APPROVED',  confidence: 94.1, date: 'Today, 6:15 PM',        rule: 'Guardian Threshold Exhausted' },
    { id: 'SP250724R99K10', amount: 15000, receiver: 'unknown_scammer@sentinelpay', score: 0.88, decision: 'REJECT',            confidence: 97.8, date: 'Yesterday, 11:30 AM',   rule: 'NEW_MERCHANT_HIGH_AMOUNT' },
    { id: 'SP240724V12L04', amount: 350,   receiver: 'canteen@sentinelpay',         score: 0.08, decision: 'APPROVE',           confidence: 99.1, date: '24 Jul, 1:45 PM',       rule: 'Frequent Merchant' },
  ];

  const filteredItems = historyItems.filter(item => {
    if (activeFilter === 'BLOCKED')  return item.decision === 'REJECT';
    if (activeFilter === 'APPROVED') return item.decision === 'APPROVE' || item.decision === 'GUARDIAN_APPROVED';
    return true;
  });

  const decisionColor = (d: string) => d === 'REJECT' ? C.red : C.green;
  const decisionBg    = (d: string) => d === 'REJECT' ? C.redBg : C.greenBg;
  const decisionLabel = (d: string) => d === 'REJECT' ? 'BLOCKED' : d === 'GUARDIAN_APPROVED' ? 'GUARDIAN' : 'APPROVED';

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header — single title */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>AI Risk History</Text>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <View style={[DS.statusDot, { backgroundColor: C.green }]} />
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Premium Analytics Card ─────────────────────────────────────── */}
        <View style={DS.cardLg}>
          {/* Card header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shield" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>30-Day Model Performance</Text>
              <Text style={DS.cardSub}>FraudShield ML · Continuous learning</Text>
            </View>
            <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
              <View style={[DS.statusDot, { backgroundColor: C.green }]} />
              <Text style={{ fontSize: T.caption, fontWeight: T.black, color: C.green }}>LIVE</Text>
            </View>
          </View>

          {/* 2×2 Metric grid — no text wrapping */}
          <View style={DS.metricGrid}>
            {METRICS.map(m => (
              <View key={m.label} style={[DS.metricCell, { borderColor: C.border }]}>
                <View style={[DS.iconSm, { backgroundColor: m.bg, marginBottom: S.sm }]}>
                  <AppIcon name={m.icon as any} size={16} color={m.iconColor} />
                </View>
                <Text style={[DS.metricCellNum, { color: m.color }]}>{m.num}</Text>
                <Text style={DS.metricCellLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* AI Confidence progress bar */}
          <View style={{ marginTop: S.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs }}>
              <Text style={DS.label}>Avg. Model Confidence</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.green }}>96.7%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: '96.7%', backgroundColor: C.green, borderRadius: 4 }} />
            </View>
          </View>

          {/* Secondary metrics row */}
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.lg }}>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, backgroundColor: C.surfaceAlt, borderRadius: R.md }}>
              <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textPrimary }}>99.2%</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.semibold, color: C.textSecondary, marginTop: 2 }}>Accuracy</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, backgroundColor: C.surfaceAlt, borderRadius: R.md }}>
              <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textPrimary }}>142ms</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.semibold, color: C.textSecondary, marginTop: 2 }}>Avg. Latency</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, backgroundColor: C.greenBg, borderRadius: R.md }}>
              <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.green }}>₹2.1L</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.semibold, color: C.green, marginTop: 2 }}>Saved</Text>
            </View>
          </View>
        </View>

        {/* ── Learned Triggers Card ──────────────────────────────────────── */}
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

        {/* ── Compact Segmented Filter ───────────────────────────────────── */}
        <View style={DS.segmentedBar}>
          {([['ALL', 'All (4)'], ['APPROVED', 'Approved (3)'], ['BLOCKED', 'Blocked (1)']] as const).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[DS.segmentTab, activeFilter === val && DS.segmentTabActive]}
              onPress={() => setActiveFilter(val)}
              activeOpacity={0.7}
            >
              <Text style={[DS.segmentTabText, activeFilter === val && DS.segmentTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Decision History Feed ──────────────────────────────────────── */}
        {filteredItems.map(item => (
          <View key={item.id} style={DS.card}>
            {/* Top row: receiver + badge */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
              <Text style={[DS.cardTitle, { flex: 1, marginRight: S.sm }]} numberOfLines={1}>{item.receiver}</Text>
              <View style={[DS.pillBadge, { backgroundColor: decisionBg(item.decision) }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: decisionColor(item.decision) }}>
                  {decisionLabel(item.decision)}
                </Text>
              </View>
            </View>

            {/* Amount + confidence */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
              <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textPrimary }}>
                ₹{item.amount.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.blue }}>
                {item.confidence}% confidence
              </Text>
            </View>

            {/* Date + trigger row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={DS.cardSub}>{item.date}</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: item.score > 0.7 ? C.red : C.green }}>
                Risk {Math.round(item.score * 100)}/100
              </Text>
            </View>

            {/* Trigger tag */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, backgroundColor: C.surfaceAlt, borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xs }}>
              <AppIcon name="cpu" size={12} color={C.textTertiary} />
              <Text style={{ fontSize: T.xs, color: C.textSecondary, fontWeight: T.medium }}>
                Trigger: <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>{item.rule}</Text>
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
