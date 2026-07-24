import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FraudShield AI Risk History</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Top Summary Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <AppIcon name="cpu" size={20} color="#10B981" />
            <Text style={styles.cardTitle}>30-Day Model Performance</Text>
          </View>
          <Text style={styles.cardSub}>FraudShield ML Model continuous learning stats</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#10B981' }]}>142</Text>
              <Text style={styles.kpiLabel}>Low Risk</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#F59E0B' }]}>12</Text>
              <Text style={styles.kpiLabel}>Med Risk</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#EF4444' }]}>4</Text>
              <Text style={styles.kpiLabel}>Blocked</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#3B82F6' }]}>8</Text>
              <Text style={styles.kpiLabel}>Guardian</Text>
            </View>
          </View>

          {/* AI Confidence Meter */}
          <View style={styles.meterContainer}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterTitle}>Average AI Model Confidence</Text>
              <Text style={styles.meterVal}>96.7% High Confidence</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: '96.7%' }]} />
            </View>
          </View>
        </View>

        {/* Learned Merchants & Rules */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Learned Behaviour & Top Triggers</Text>

          <View style={styles.infoRow}>
            <AppIcon name="shieldCheck" size={16} color="#10B981" />
            <Text style={styles.infoText}>Learned Trusted Merchants: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>Amazon India, Swiggy, Zomato</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <AppIcon name="alertTriangle" size={16} color="#F59E0B" />
            <Text style={styles.infoText}>Top Fraud Rule Trigger: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>NEW_MERCHANT_HIGH_AMOUNT (+31)</Text></Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>All Decisions (4)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'BLOCKED' && styles.filterChipActive]}
            onPress={() => setActiveFilter('BLOCKED')}
          >
            <Text style={[styles.filterText, activeFilter === 'BLOCKED' && styles.filterTextActive]}>Blocked (1)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'APPROVED' && styles.filterChipActive]}
            onPress={() => setActiveFilter('APPROVED')}
          >
            <Text style={[styles.filterText, activeFilter === 'APPROVED' && styles.filterTextActive]}>Approved (3)</Text>
          </TouchableOpacity>
        </View>

        {/* Decisions History Feed */}
        {filteredItems.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.receiverText}>{item.receiver}</Text>
                <Text style={styles.dateText}>{item.date} • Ref: {item.id}</Text>
              </View>
              <View style={[styles.badge, item.decision === 'REJECT' ? styles.badgeReject : styles.badgeApprove]}>
                <Text style={[styles.badgeText, item.decision === 'REJECT' ? { color: '#EF4444' } : { color: '#10B981' }]}>
                  {item.decision === 'REJECT' ? 'BLOCKED' : item.decision}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.amountText}>₹{item.amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.confidenceText}>Confidence: {item.confidence}%</Text>
            </View>

            <View style={styles.ruleBox}>
              <Text style={styles.ruleLabel}>Trigger / Factor: <Text style={{ color: '#CBD5E1' }}>{item.rule}</Text></Text>
              <Text style={styles.scoreLabel}>Risk Score: <Text style={{ color: item.score > 0.7 ? '#EF4444' : '#10B981', fontWeight: '700' }}>{(item.score * 100).toFixed(0)}/100</Text></Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiBox: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: '23%',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  meterContainer: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterTitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  meterVal: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBg: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receiverText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeApprove: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeReject: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  confidenceText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  ruleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
  },
  ruleLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  scoreLabel: {
    color: '#64748B',
    fontSize: 11,
  },
});
