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
      {/* Light Enterprise Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerSubtitle}>ENTERPRISE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>FraudShield AI Risk History</Text>
        </View>
        <View style={styles.livePulseBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Top Summary Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <AppIcon name="cpu" size={20} color="#2E8B57" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>30-Day Model Performance</Text>
              <Text style={styles.cardSub}>FraudShield ML Model continuous learning stats</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#2E8B57' }]}>142</Text>
              <Text style={styles.kpiLabel}>Low Risk</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#D97706' }]}>12</Text>
              <Text style={styles.kpiLabel}>Med Risk</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#DC2626' }]}>4</Text>
              <Text style={styles.kpiLabel}>Blocked</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#2563EB' }]}>8</Text>
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
            <AppIcon name="shieldCheck" size={16} color="#2E8B57" />
            <Text style={styles.infoText}>Learned Trusted Merchants: <Text style={{ color: '#1A1A2E', fontWeight: '700' }}>Amazon India, Swiggy, Zomato</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <AppIcon name="alertTriangle" size={16} color="#D97706" />
            <Text style={styles.infoText}>Top Fraud Rule Trigger: <Text style={{ color: '#1A1A2E', fontWeight: '700' }}>NEW_MERCHANT_HIGH_AMOUNT (+31)</Text></Text>
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
                <Text style={[styles.badgeText, item.decision === 'REJECT' ? { color: '#DC2626' } : { color: '#2E8B57' }]}>
                  {item.decision === 'REJECT' ? 'BLOCKED' : item.decision}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.amountText}>₹{item.amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.confidenceText}>Confidence: {item.confidence}%</Text>
            </View>

            <View style={styles.ruleBox}>
              <Text style={styles.ruleLabel}>Trigger: <Text style={{ color: '#1A1A2E', fontWeight: '600' }}>{item.rule}</Text></Text>
              <Text style={styles.scoreLabel}>Risk Score: <Text style={{ color: item.score > 0.7 ? '#DC2626' : '#2E8B57', fontWeight: '700' }}>{(item.score * 100).toFixed(0)}/100</Text></Text>
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
    backgroundColor: '#FAF7F0',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#FAF7F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerSubtitle: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E8B57',
  },
  liveText: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 16,
  },
  kpiBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '23%',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  meterContainer: {
    marginTop: 4,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterTitle: {
    color: '#64748B',
    fontSize: 12,
  },
  meterVal: {
    color: '#2E8B57',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E8B57',
    borderRadius: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    color: '#64748B',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  filterText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receiverText: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeApprove: {
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
  },
  badgeReject: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
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
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '800',
  },
  confidenceText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  ruleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
