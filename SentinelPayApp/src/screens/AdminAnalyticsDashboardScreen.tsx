import React from 'react';
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
import AppIcon, { IconName } from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
    { title: 'Transactions Today', value: '₹1,42,850', color: C.green, icon: 'activity' },
    { title: 'Total Wallet Volume', value: '₹8,72,400', color: C.blue, icon: 'creditCard' },
    { title: 'Fraud Prevented', value: '₹28,300', color: C.amber, icon: 'shieldAlert' },
    { title: 'Blocked Transactions', value: '42', color: C.red, icon: 'xCircle' },
    { title: 'Successful Txns', value: '1,482', color: C.green, icon: 'checkCircle' },
    { title: 'Avg AI Latency', value: '142 ms', color: C.violet, icon: 'zap' },
    { title: 'Guardian Approvals', value: '16', color: C.violet, icon: 'users' },
    { title: 'Avg Risk Score', value: '18 / 100', color: C.green, icon: 'pieChart' },
    { title: 'High-Risk Accounts', value: '7', color: C.red, icon: 'alertTriangle' },
    { title: 'Verified Users', value: '312', color: C.blue, icon: 'userCheck' },
    { title: 'Scam Reports', value: '54', color: C.amber, icon: 'flag' },
    { title: 'QR Scans Today', value: '287', color: C.green, icon: 'qrCode' },
    { title: 'SMS Threats', value: '19', color: C.red, icon: 'messageSquare' },
    { title: 'Device Trust Avg', value: '94%', color: C.green, icon: 'shieldCheck' },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Ops & Security Analytics</Text>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <View style={[DS.statusDot, { backgroundColor: C.green }]} />
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Operations Banner */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <View style={[DS.iconLg, { backgroundColor: C.greenBg }]}>
              <AppIcon name="barChart2" size={24} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>SentinelPay System Operations</Text>
              <Text style={DS.cardSub}>Real-time monitoring platform for settlement engine & AI scoring nodes</Text>
            </View>
          </View>
        </View>

        {/* Grid of KPIs with Icons */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginBottom: S.md }}>
          {kpis.map((kpi, idx) => (
            <View key={idx} style={[DS.card, { width: '48%', marginBottom: 0, padding: S.sm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
                <View style={[DS.iconSm, { backgroundColor: `${kpi.color}15` }]}>
                  <AppIcon name={kpi.icon} size={14} color={kpi.color} />
                </View>
                <Text style={[DS.cardSub, { fontSize: T.xs }]} numberOfLines={1}>{kpi.title}</Text>
              </View>
              <Text style={{ fontSize: T.md, fontWeight: T.black, color: kpi.color }}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        {/* Real-Time Fraud & Threat Trends */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.md }}>
            <AppIcon name="shieldAlert" size={18} color={C.amber} />
            <Text style={DS.cardTitle}>Real-Time Fraud & Threat Trends</Text>
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
            <View style={[DS.statusDot, { backgroundColor: C.amber }]} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
              Top Vector: <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>Investment Scheme SMS Scams (42%)</Text>
            </Text>
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
            <View style={[DS.statusDot, { backgroundColor: C.green }]} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
              AI Precision Score: <Text style={{ color: C.green, fontWeight: T.bold }}>99.2% Zero False Positives</Text>
            </Text>
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
            <View style={[DS.statusDot, { backgroundColor: C.blue }]} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary, flex: 1 }}>
              Database Uptime: <Text style={{ color: C.green, fontWeight: T.bold }}>99.99% PostgreSQL & Redis</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
