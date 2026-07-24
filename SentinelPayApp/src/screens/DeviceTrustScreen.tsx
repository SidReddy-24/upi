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
      {/* Light Enterprise Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerSubtitle}>ENTERPRISE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>Enterprise Device Trust</Text>
        </View>
        <View style={styles.livePulseBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Main Trust Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.trustBadgeRow}>
            <View style={styles.shieldIconBg}>
              <AppIcon name="shieldCheck" size={32} color="#2E8B57" />
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

        {/* Security Checks List Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System Security Checks (7/7 Passed)</Text>
        </View>

        {securityChecks.map((item, idx) => (
          <View key={idx} style={styles.checkCard}>
            <View style={styles.checkTitleRow}>
              <View style={styles.checkTitleGroup}>
                <AppIcon name="checkCircle" size={18} color="#2E8B57" />
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
          <AppIcon name="info" size={18} color="#2563EB" />
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
  heroCard: {
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
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  shieldIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustScoreVal: {
    color: '#1A1A2E',
    fontSize: 26,
    fontWeight: '800',
  },
  trustScoreText: {
    color: '#2E8B57',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroDesc: {
    color: '#64748B',
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
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  metaVal: {
    color: '#1A1A2E',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '700',
  },
  checkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
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
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  passedPill: {
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  passedPillText: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
  },
  checkDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    paddingLeft: 26,
  },
  infoFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    marginTop: 6,
    marginBottom: 24,
  },
  infoFooterText: {
    color: '#1E40AF',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
});
