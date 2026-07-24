import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon, { IconName } from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdminAnalytics'>;
};

interface KpiItem {
  title: string;
  value: string;
  color: string;
  icon: IconName;
}

export default function AdminAnalyticsDashboardScreen({ navigation }: Props) {
  const kpis: KpiItem[] = [
    { title: 'Transactions Today', value: '₹1,42,850', color: '#2E8B57', icon: 'activity' },
    { title: 'Total Wallet Volume', value: '₹8,72,400', color: '#2563EB', icon: 'creditCard' },
    { title: 'Fraud Prevented', value: '₹28,300', color: '#D97706', icon: 'shieldAlert' },
    { title: 'Blocked Transactions', value: '42', color: '#DC2626', icon: 'xCircle' },
    { title: 'Successful Txns', value: '1,482', color: '#2E8B57', icon: 'checkCircle' },
    { title: 'Avg AI Latency', value: '142 ms', color: '#6366F1', icon: 'zap' },
    { title: 'Guardian Approvals', value: '16', color: '#8B5CF6', icon: 'users' },
    { title: 'Avg Risk Score', value: '18 / 100', color: '#2E8B57', icon: 'pieChart' },
    { title: 'High-Risk Accounts', value: '7', color: '#DC2626', icon: 'alertTriangle' },
    { title: 'Verified Users', value: '312', color: '#2563EB', icon: 'userCheck' },
    { title: 'Scam Reports', value: '54', color: '#D97706', icon: 'flag' },
    { title: 'QR Scans Today', value: '287', color: '#2E8B57', icon: 'qrCode' },
    { title: 'SMS Threats', value: '19', color: '#DC2626', icon: 'messageSquare' },
    { title: 'Device Trust Avg', value: '94%', color: '#2E8B57', icon: 'shieldCheck' },
  ];

  return (
    <View style={styles.container}>
      {/* Light Enterprise Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerSubtitle}>ENTERPRISE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>Ops & Security Analytics</Text>
        </View>
        <View style={styles.livePulseBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Operations Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerHeader}>
            <View style={styles.iconCircleLarge}>
              <AppIcon name="barChart2" size={22} color="#2E8B57" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>SentinelPay System Operations</Text>
              <Text style={styles.bannerSub}>Real-time monitoring platform for settlement engine & AI scoring nodes</Text>
            </View>
          </View>
        </View>

        {/* Grid of KPIs with Icons */}
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, idx) => (
            <View key={idx} style={styles.kpiCard}>
              <View style={styles.kpiCardHeader}>
                <View style={[styles.iconCircleSmall, { backgroundColor: `${kpi.color}15` }]}>
                  <AppIcon name={kpi.icon} size={16} color={kpi.color} />
                </View>
                <Text style={styles.kpiTitle} numberOfLines={1}>{kpi.title}</Text>
              </View>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        {/* Real-Time Fraud & Threat Trends */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <AppIcon name="shieldAlert" size={18} color="#D97706" />
            <Text style={styles.sectionTitle}>Real-Time Fraud & Threat Trends</Text>
          </View>

          <View style={styles.trendRow}>
            <View style={styles.trendDot} />
            <Text style={styles.trendLabel}>Top Vector: <Text style={{ color: '#1A1A2E', fontWeight: '700' }}>Investment Scheme SMS Scams (42%)</Text></Text>
          </View>
          <View style={styles.trendRow}>
            <View style={[styles.trendDot, { backgroundColor: '#2E8B57' }]} />
            <Text style={styles.trendLabel}>AI Precision Score: <Text style={{ color: '#2E8B57', fontWeight: '700' }}>99.2% Zero False Positives</Text></Text>
          </View>
          <View style={styles.trendRow}>
            <View style={[styles.trendDot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.trendLabel}>Database Uptime: <Text style={{ color: '#2E8B57', fontWeight: '700' }}>99.99% PostgreSQL & Redis</Text></Text>
          </View>
        </View>
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
  bannerCard: {
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
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircleLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  trendLabel: {
    color: '#64748B',
    fontSize: 12,
  },
});
