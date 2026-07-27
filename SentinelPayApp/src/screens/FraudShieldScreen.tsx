/**
 * FraudShieldScreen — AI Fraud prevention hub for the 🛡 FraudShield bottom tab.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'FraudShield'> };

interface FraudTool {
  label: string;
  sub: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  badge?: string;
  onPress: () => void;
}

export default function FraudShieldScreen({ navigation }: Props) {
  const tools: FraudTool[] = [
    { label: 'AI Risk History', sub: 'ML model explanations for past decisions', icon: 'cpu', iconColor: '#10B981', iconBg: '#ECFDF5', onPress: () => navigation.navigate('AiRiskHistory') },
    { label: 'Device Trust & Attestation', sub: 'Hardware integrity, root & SIM binding', icon: 'shieldCheck', iconColor: '#7C3AED', iconBg: '#F5F3FF', onPress: () => navigation.navigate('DeviceTrust') },
    { label: 'SMS Fraud Tracker', sub: 'Real-time phishing SMS detection', icon: 'sms', iconColor: '#059669', iconBg: '#ECFDF5', onPress: () => navigation.navigate('SmsTracker') },
    { label: 'AI Scam Assistant', sub: 'Interactive fraud advisor powered by AI', icon: 'assistant', iconColor: '#7C3AED', iconBg: '#F5F3FF', onPress: () => navigation.navigate('ScamAssistant') },
    { label: 'Scam Passport Lookup', sub: 'Verify reputation of suspicious VPAs', icon: 'search', iconColor: '#D97706', iconBg: '#FFFBEB', onPress: () => navigation.navigate('ScamPassport', {}) },
    { label: 'Threat HeatMap', sub: 'Geographic fraud radar across India', icon: 'heatmap', iconColor: '#EF4444', iconBg: '#FEF2F2', onPress: () => navigation.navigate('ScamHeatMap') },
    { label: 'Report Fraud / Scam', sub: 'File complaint to block malicious entities', icon: 'report', iconColor: '#EF4444', iconBg: '#FEF2F2', badge: 'ACTION', onPress: () => navigation.navigate('ReportScam', undefined) },
    { label: 'Ops Analytics Dashboard', sub: 'Real-time system throughput & scoring', icon: 'barChart2', iconColor: '#2563EB', iconBg: '#EFF6FF', onPress: () => navigation.navigate('AdminAnalytics') },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={DS.headerBar}>
        <View>
          <Text style={[DS.label, { color: C.green }]}>SENTINELPAY</Text>
          <Text style={DS.pageTitle}>FraudShield AI</Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
            <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>ACTIVE</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[DS.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Protection Status Card */}
        <View style={[DS.cardLg, { backgroundColor: C.dark }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
            <View style={[DS.iconMd, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <AppIcon name="shieldCheck" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: T.md, fontWeight: T.bold, color: '#F8FAFC' }}>AI Protection Engine</Text>
              <Text style={{ fontSize: T.xs, color: '#94A3B8', marginTop: 2 }}>Sub-200ms fraud detection active</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
            {['⚡ 6ms LATENCY', '🛡️ GRAPH SCORED', '🔐 DEVICE BOUND', '🧠 ML ACTIVE'].map(tag => (
              <View key={tag} style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: T.bold, color: '#CBD5E1' }}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tools */}
        <Text style={[DS.sectionTitle, { marginTop: S.sm }]}>Security Tools</Text>
        {tools.map(tool => (
          <TouchableOpacity key={tool.label} style={DS.rowCard} onPress={tool.onPress} activeOpacity={0.7}>
            <View style={[DS.iconMd, { backgroundColor: tool.iconBg, marginRight: S.sm }]}>
              <AppIcon name={tool.icon} size={20} color={tool.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <Text style={DS.cardTitle}>{tool.label}</Text>
                {tool.badge && (
                  <View style={[DS.pillBadge, { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2 }]}>
                    <Text style={{ fontSize: 9, fontWeight: T.extrabold, color: '#EF4444' }}>{tool.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={DS.cardSub}>{tool.sub}</Text>
            </View>
            <AppIcon name="chevronRight" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* GNN Info Banner */}
        <View style={[DS.infoCard, { backgroundColor: '#F0FDF4', borderColor: C.green, borderWidth: 1, marginTop: S.sm }]}>
          <AppIcon name="lock" size={18} color={C.green} />
          <View style={{ flex: 1, marginLeft: S.sm }}>
            <Text style={[DS.cardTitle, { color: C.dark }]}>Graph Neural Network (GNN) Defense</Text>
            <Text style={[DS.cardSub, { marginTop: 2 }]}>
              SentinelPay maps VPA nodes to identify mule accounts and coordinated fraud rings in real time.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
