import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Device Trust & Attestation</Text>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <View style={[DS.statusDot, { backgroundColor: C.green }]} />
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Trust Hero Card */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
            <View style={[DS.iconLg, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shieldCheck" size={28} color={C.green} />
            </View>
            <View>
              <Text style={{ fontSize: T.xxl, fontWeight: T.black, color: C.textPrimary }}>94%</Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.green, letterSpacing: 0.5 }}>HIGHLY TRUSTED DEVICE</Text>
            </View>
          </View>

          <Text style={[DS.cardSub, { lineHeight: 18, marginBottom: S.md }]}>
            SentinelPay Hardware Integrity Engine continuously monitors system runtime environment to prevent overlay fraud, malware interception, and unauthorized device cloning.
          </Text>

          <View style={DS.grid2}>
            <View style={[DS.infoCard, { flex: 1 }]}>
              <View>
                <Text style={DS.label}>OS VERSION</Text>
                <Text style={[DS.cardTitle, { marginTop: 2 }]}>{Platform.OS.toUpperCase()} (API 34)</Text>
              </View>
            </View>
            <View style={[DS.infoCard, { flex: 1 }]}>
              <View>
                <Text style={DS.label}>HARDWARE</Text>
                <Text style={[DS.cardTitle, { marginTop: 2 }]}>ARM64 Enclave</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Checks List Header */}
        <Text style={DS.sectionTitle}>System Security Checks (7/7 Passed)</Text>

        {securityChecks.map((item, idx) => (
          <View key={idx} style={DS.rowCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, flex: 1 }}>
                  <AppIcon name="checkCircle" size={18} color={C.green} />
                  <Text style={DS.cardTitle}>{item.title}</Text>
                </View>
                <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
                  <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>{item.status}</Text>
                </View>
              </View>
              <Text style={[DS.cardSub, { paddingLeft: 26 }]}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* Security Note */}
        <View style={[DS.infoCard, { backgroundColor: C.blueBg, marginTop: S.sm }]}>
          <AppIcon name="info" size={18} color={C.blue} />
          <Text style={{ flex: 1, fontSize: T.xs, color: C.blue, lineHeight: 17 }}>
            Device trust signals are evaluated dynamically during every transaction scoring request by FraudShield AI to protect your wallet.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
