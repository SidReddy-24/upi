import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DeviceTrust'>;
};

export default function DeviceTrustScreen({ navigation }: Props) {
  const securityChecks = [
    { title: 'Root / Jailbreak Detection', status: 'PASSED', desc: 'System binary integrity verified. No su or Magisk binaries found.' },
    { title: 'Emulator Hardware Check', status: 'PASSED', desc: 'Running on authentic physical arm64-v8a hardware architecture.' },
    { title: 'Overlay Attack Shield', status: 'PASSED', desc: 'No tapjacking or transparent window overlays detected over payment UI.' },
    { title: 'Accessibility Abuse Check', status: 'PASSED', desc: 'No unauthorized third-party keyloggers or screen scraping services active.' },
    { title: 'VPN & Tunneling Shield', status: 'PASSED', desc: 'Direct ISP network routing. No proxy or VPN tunnel detected.' },
    { title: 'Screen Recording Protection', status: 'PASSED', desc: 'Android FLAG_SECURE active. Screen capture disabled for sensitive views.' },
    { title: 'USB Debugging Guard', status: 'PASSED', desc: 'ADB remote shell execution disabled or monitored for runtime safety.' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enterprise Device Trust</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Main Trust Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.trustBadgeRow}>
            <View style={styles.shieldIconBg}>
              <AppIcon name="shieldCheck" size={36} color="#10B981" />
            </View>
            <View>
              <Text style={styles.trustScoreVal}>94%</Text>
              <Text style={styles.trustScoreText}>HIGHLY TRUSTED DEVICE</Text>
            </View>
          </View>

          <Text style={styles.heroDesc}>
            SentinelPay Hardware Integrity Engine continuously monitors system runtime environment to prevent overlay fraud, malware interception, and unauthorized device cloning.
          </Text>

          <View style={styles.deviceMetaGrid}>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>OS Version</Text>
              <Text style={styles.metaVal}>{Platform.OS.toUpperCase()} (API 34)</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Hardware</Text>
              <Text style={styles.metaVal}>ARM64 Secure Enclave</Text>
            </View>
          </View>
        </View>

        {/* Security Checks List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System Security Checks (7/7 Passed)</Text>
        </View>

        {securityChecks.map((item, idx) => (
          <View key={idx} style={styles.checkCard}>
            <View style={styles.checkTitleRow}>
              <View style={styles.checkTitleGroup}>
                <AppIcon name="checkCircle" size={18} color="#10B981" />
                <Text style={styles.checkTitle}>{item.title}</Text>
              </View>
              <View style={styles.passedPill}>
                <Text style={styles.passedPillText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.checkDesc}>{item.desc}</Text>
          </View>
        ))}

        {/* Security Note */}
        <View style={styles.infoFooterCard}>
          <AppIcon name="info" size={18} color="#60A5FA" />
          <Text style={styles.infoFooterText}>
            Device trust signals are evaluated dynamically during every transaction scoring request by FraudShield AI to protect your wallet.
          </Text>
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
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 18,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  shieldIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustScoreVal: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '900',
  },
  trustScoreText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  deviceMetaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 10,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  metaVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  checkCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  checkTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  passedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  passedPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  checkDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    paddingLeft: 26,
  },
  infoFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginTop: 8,
    marginBottom: 24,
  },
  infoFooterText: {
    color: '#93C5FD',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
});
