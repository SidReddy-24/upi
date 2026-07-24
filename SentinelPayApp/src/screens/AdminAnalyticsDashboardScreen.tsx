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
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AdminAnalytics'>;
};

export default function AdminAnalyticsDashboardScreen({ navigation }: Props) {
  const kpis = [
    { title: 'Transactions Today', value: '₹1,42,850', color: '#10B981', icon: 'activity' },
    { title: 'Total Wallet Volume', value: '₹8,72,400', color: '#3B82F6', icon: 'creditCard' },
    { title: 'Fraud Prevented', value: '₹28,300', color: '#F59E0B', icon: 'shieldAlert' },
    { title: 'Blocked Transactions', value: '42', color: '#EF4444', icon: 'xCircle' },
    { title: 'Successful Txns', value: '1,482', color: '#10B981', icon: 'checkCircle' },
    { title: 'Avg AI Latency', value: '142 ms', color: '#6366F1', icon: 'zap' },
    { title: 'Guardian Approvals', value: '16', color: '#8B5CF6', icon: 'users' },
    { title: 'Avg Risk Score', value: '18 / 100', color: '#10B981', icon: 'pieChart' },
    { title: 'High-Risk Accounts', value: '7', color: '#EF4444', icon: 'alertTriangle' },
    { title: 'Verified Users', value: '312', color: '#3B82F6', icon: 'userCheck' },
    { title: 'Scam Reports', value: '54', color: '#F59E0B', icon: 'flag' },
    { title: 'QR Scans Today', value: '287', color: '#10B981', icon: 'qrCode' },
    { title: 'SMS Threats', value: '19', color: '#EF4444', icon: 'messageSquare' },
    { title: 'Device Trust Avg', value: '94%', color: '#10B981', icon: 'shieldCheck' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ops & Security Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerHeader}>
            <AppIcon name="barChart2" size={20} color="#10B981" />
            <Text style={styles.bannerTitle}>SentinelPay System Operations</Text>
          </View>
          <Text style={styles.bannerSub}>Real-time monitoring platform for settlement engine & AI scoring nodes</Text>
        </View>

        {/* Grid of KPIs */}
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, idx) => (
            <View key={idx} style={styles.kpiCard}>
              <Text style={styles.kpiTitle}>{kpi.title}</Text>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        {/* Fraud Trends Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Real-Time Fraud & Threat Trends</Text>
          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>Top Vector: <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>Investment Scheme SMS Scams (42%)</Text></Text>
          </View>
          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>AI Precision Score: <Text style={{ color: '#10B981', fontWeight: '700' }}>99.2% Zero False Positives</Text></Text>
          </View>
          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>Database Uptime: <Text style={{ color: '#10B981', fontWeight: '700' }}>99.99% PostgreSQL & Redis</Text></Text>
          </View>
        </View>
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
  bannerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  trendRow: {
    marginBottom: 8,
  },
  trendLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
