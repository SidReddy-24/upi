import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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

export default function AiRiskHistoryScreen({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'BLOCKED' | 'APPROVED'>('ALL');

  const historyItems = [
    { id: 'SP260724X91M84', amount: 500, receiver: 'alice@sentinelpay', score: 0.12, decision: 'APPROVE', confidence: 98.4, date: 'Today, 8:02 PM', rule: 'Trusted Recipient' },
    { id: 'SP260724A81D72', amount: 1200, receiver: 'merchant_shop@sentinelpay', score: 0.45, decision: 'GUARDIAN_APPROVED', confidence: 94.1, date: 'Today, 6:15 PM', rule: 'Guardian Threshold Exhausted' },
    { id: 'SP250724R99K10', amount: 15000, receiver: 'unknown_scammer@sentinelpay', score: 0.88, decision: 'REJECT', confidence: 97.8, date: 'Yesterday, 11:30 AM', rule: 'NEW_MERCHANT_HIGH_AMOUNT' },
    { id: 'SP240724V12L04', amount: 350, receiver: 'canteen@sentinelpay', score: 0.08, decision: 'APPROVE', confidence: 99.1, date: '24 Jul, 1:45 PM', rule: 'Frequent Merchant' },
  ];

  const filteredItems = historyItems.filter(item => {
    if (activeFilter === 'BLOCKED') return item.decision === 'REJECT';
    if (activeFilter === 'APPROVED') return item.decision === 'APPROVE' || item.decision === 'GUARDIAN_APPROVED';
    return true;
  });

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Child Header */}
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
        {/* Top Summary Card */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="cpu" size={20} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>30-Day Model Performance</Text>
              <Text style={DS.cardSub}>FraudShield ML Model continuous learning stats</Text>
            </View>
          </View>

          <View style={DS.statsRow}>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.green }]}>142</Text>
              <Text style={DS.statLabel}>Low Risk</Text>
            </View>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.amber }]}>12</Text>
              <Text style={DS.statLabel}>Med Risk</Text>
            </View>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.red }]}>4</Text>
              <Text style={DS.statLabel}>Blocked</Text>
            </View>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.blue }]}>8</Text>
              <Text style={DS.statLabel}>Guardian</Text>
            </View>
          </View>

          {/* AI Confidence Meter */}
          <View style={{ marginTop: S.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs }}>
              <Text style={DS.cardSub}>Average AI Model Confidence</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.green }}>96.7% High Confidence</Text>
            </View>
            <View style={{ height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: '96.7%', backgroundColor: C.green, borderRadius: 3 }} />
            </View>
          </View>
        </View>

        {/* Learned Merchants & Rules */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Learned Behaviour & Top Triggers</Text>

          <View style={[DS.rowCard, { marginBottom: S.xs }]}>
            <AppIcon name="shieldCheck" size={18} color={C.green} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
              Learned Trusted Merchants: <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>Amazon India, Swiggy, Zomato</Text>
            </Text>
          </View>
          <View style={DS.rowCard}>
            <AppIcon name="alertTriangle" size={18} color={C.amber} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
              Top Fraud Trigger: <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>NEW_MERCHANT_HIGH_AMOUNT (+31)</Text>
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.md }}>
          <TouchableOpacity
            style={[DS.chip, activeFilter === 'ALL' && { backgroundColor: C.dark }]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[DS.chipText, activeFilter === 'ALL' && { color: C.textInverse }]}>All Decisions (4)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[DS.chip, activeFilter === 'BLOCKED' && { backgroundColor: C.red }]}
            onPress={() => setActiveFilter('BLOCKED')}
            activeOpacity={0.7}
          >
            <Text style={[DS.chipText, activeFilter === 'BLOCKED' && { color: C.textInverse }]}>Blocked (1)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[DS.chip, activeFilter === 'APPROVED' && { backgroundColor: C.green }]}
            onPress={() => setActiveFilter('APPROVED')}
            activeOpacity={0.7}
          >
            <Text style={[DS.chipText, activeFilter === 'APPROVED' && { color: C.textInverse }]}>Approved (3)</Text>
          </TouchableOpacity>
        </View>

        {/* Decisions History Feed */}
        {filteredItems.map((item) => (
          <View key={item.id} style={DS.rowCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
                <Text style={DS.cardTitle} numberOfLines={1}>{item.receiver}</Text>
                <View style={[DS.pillBadge, { backgroundColor: item.decision === 'REJECT' ? C.redBg : C.greenBg }]}>
                  <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: item.decision === 'REJECT' ? C.red : C.green }}>
                    {item.decision === 'REJECT' ? 'BLOCKED' : item.decision}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
                <Text style={{ fontSize: T.md, fontWeight: T.black, color: C.textPrimary }}>₹{item.amount.toLocaleString('en-IN')}</Text>
                <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.blue }}>Confidence: {item.confidence}%</Text>
              </View>

              <Text style={DS.cardSub}>{item.date} • Ref: {item.id}</Text>
              <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginTop: S.xs, padding: S.xs + 2 }]}>
                <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
                  Trigger: <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>{item.rule}</Text>
                </Text>
                <Text style={{ fontSize: T.xs, color: item.score > 0.7 ? C.red : C.green, fontWeight: T.extrabold }}>
                  Risk: {Math.round(item.score * 100)}/100
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
