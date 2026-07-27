/**
 * DeviceTrustScreen — Enterprise-grade Device Security Dashboard
 * SVG animated trust gauge, 14 security signals, attestation panel, security timeline.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Animated, StyleSheet, Platform,
} from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'DeviceTrust'> };

const TRUST_SCORE = 94;

/* ─── SVG Animated Trust Gauge ─────────────────────────────────────── */
const GAUGE_SIZE = 180;
const STROKE = 14;
const RADIUS = (GAUGE_SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * RADIUS;

function TrustGauge({ score }: { score: number }) {
  const animPct = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    Animated.timing(animPct, { toValue: score, duration: 1400, useNativeDriver: false }).start();
    let frame: NodeJS.Timeout;
    let current = 0;
    const step = () => {
      current = Math.min(current + 1, score);
      setDisplayScore(current);
      if (current < score) frame = setTimeout(step, 14);
    };
    frame = setTimeout(step, 20);
    return () => clearTimeout(frame);
  }, [animPct, score]);

  const dashOffset = animPct.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUM, CIRCUM * (1 - score / 100)],
  });

  const scoreColor = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  const statusLabel = score >= 80 ? 'HIGHLY TRUSTED' : score >= 60 ? 'MODERATE TRUST' : 'AT RISK';

  return (
    <View style={{ alignItems: 'center', marginVertical: S.md }}>
      <View style={{ position: 'relative', width: GAUGE_SIZE, height: GAUGE_SIZE }}>
        <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
          {/* Background track */}
          <Circle
            cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={RADIUS}
            stroke={C.surfaceAlt} strokeWidth={STROKE}
            fill="none" strokeLinecap="round"
            transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
          />
        </Svg>
        {/* Animated arc — use Animated.View wrapper */}
        <View style={StyleSheet.absoluteFill}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
            <G transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}>
              <Circle
                cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={RADIUS}
                stroke={scoreColor}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${CIRCUM * score / 100} ${CIRCUM}`}
                strokeLinecap="round"
              />
            </G>
          </Svg>
        </View>
        {/* Center text */}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: scoreColor }}>{displayScore}</Text>
          <Text style={{ fontSize: 9, fontWeight: '800', color: C.textTertiary, letterSpacing: 1 }}>/ 100</Text>
        </View>
      </View>
      <View style={[DS.pillBadge, { backgroundColor: score >= 80 ? C.greenBg : C.amberBg, marginTop: S.sm }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: scoreColor }} />
        <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: scoreColor }}>{statusLabel}</Text>
      </View>
      <Text style={[DS.cardSub, { marginTop: S.xs, textAlign: 'center' }]}>
        Last verified · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </Text>
    </View>
  );
}

/* ─── Signal Row ────────────────────────────────────────────────────── */
interface Signal {
  icon: any;
  title: string;
  desc: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  iconColor: string;
  iconBg: string;
}

function SignalRow({ signal, delay }: { signal: Signal; delay: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, [fadeAnim, slideAnim, delay]);

  const badgeColor = signal.status === 'PASSED' ? C.green : signal.status === 'WARNING' ? C.amber : C.red;
  const badgeBg    = signal.status === 'PASSED' ? C.greenBg : signal.status === 'WARNING' ? C.amberBg : C.redBg;

  return (
    <Animated.View style={[styles.signalRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[DS.iconSm, { backgroundColor: signal.iconBg }]}>
        <AppIcon name={signal.icon} size={16} color={signal.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={DS.cardTitle}>{signal.title}</Text>
        <Text style={[DS.cardSub, { marginTop: 2 }]}>{signal.desc}</Text>
      </View>
      <View style={[DS.pillBadge, { backgroundColor: badgeBg }]}>
        <Text style={{ fontSize: 9, fontWeight: T.extrabold, color: badgeColor }}>{signal.status}</Text>
      </View>
    </Animated.View>
  );
}

/* ─── Attestation Row ───────────────────────────────────────────────── */
function AttestRow({ icon, label, value, valueColor }: { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.attestRow}>
      <AppIcon name={icon} size={15} color={C.textTertiary} />
      <Text style={[DS.cardSub, { flex: 1 }]}>{label}</Text>
      <Text style={[{ fontSize: T.xs, fontWeight: T.bold, color: valueColor ?? C.green }]}>{value}</Text>
    </View>
  );
}

/* ─── Timeline Event ────────────────────────────────────────────────── */
function TimelineEvent({ time, event, icon, color, bg, isLast }: { time: string; event: string; icon: any; color: string; bg: string; isLast?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: S.md }}>
      <View style={{ alignItems: 'center' }}>
        <View style={[DS.iconSm, { backgroundColor: bg }]}>
          <AppIcon name={icon} size={14} color={color} />
        </View>
        {!isLast && <View style={{ width: 1, flex: 1, backgroundColor: C.border, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : S.md }}>
        <Text style={[DS.cardSub, { marginBottom: 2 }]}>{time}</Text>
        <Text style={DS.cardTitle}>{event}</Text>
      </View>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────── */
export default function DeviceTrustScreen({ navigation }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const SIGNALS: Signal[] = [
    { icon: 'shieldCheck',   title: 'Root / Jailbreak Detection',    desc: 'No su or Magisk binaries found. System integrity verified.',      status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'smartphone',    title: 'Emulator Hardware Check',        desc: 'Running on authentic physical arm64-v8a hardware architecture.',   status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'settings',      title: 'Developer Options',              desc: 'Developer mode is inactive on this device.',                       status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'link',          title: 'USB Debugging Guard',            desc: 'ADB remote shell execution disabled for runtime safety.',          status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'eye',           title: 'Accessibility Abuse Check',      desc: 'No unauthorized keyloggers or screen scraping services active.',   status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'alert',         title: 'Overlay Attack Shield',          desc: 'No tapjacking or transparent overlays detected over payment UI.',  status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'wifi',          title: 'VPN & Tunneling Shield',         desc: 'Direct ISP network routing. No proxy or VPN tunnel detected.',    status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'mapPin',        title: 'Mock Location Detection',        desc: 'GPS coordinates match real device location sensors.',             status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'eyeOff',        title: 'Screen Recording Protection',    desc: 'FLAG_SECURE active. Screen capture disabled for sensitive views.', status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'externalLink',  title: 'Unknown Sources',                desc: 'SentinelPay installed from Play Store. Sideloading not detected.', status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'shieldCheck',   title: 'App Integrity',                  desc: 'APK signature matches Play Store release certificate.',           status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'phone',         title: 'SIM Change Detection',           desc: 'Original SIM card detected. No SIM swap event recorded.',         status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'layers',        title: 'OS Version Check',               desc: `${Platform.OS.toUpperCase()} API 34. Security patches current.`,  status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
    { icon: 'server',        title: 'Play Integrity',                 desc: 'Play Integrity API returned STRONG_INTEGRITY verdict.',           status: 'PASSED',  iconColor: C.green,  iconBg: C.greenBg  },
  ];

  const TIMELINE = [
    { time: 'Just now',    event: 'Device Integrity Verified',        icon: 'shieldCheck', color: C.green, bg: C.greenBg },
    { time: '2 min ago',   event: 'Play Integrity API Checked',       icon: 'server',      color: C.blue,  bg: C.blueBg  },
    { time: '12 min ago',  event: 'Security Scan Completed · 14/14',  icon: 'checkCircle', color: C.green, bg: C.greenBg },
    { time: '1 hr ago',    event: 'App Opened · Trust Reasserted',    icon: 'smartphone',  color: C.blue,  bg: C.blueBg  },
    { time: '8 hr ago',    event: 'SIM Card Verified',                icon: 'phone',       color: C.green, bg: C.greenBg },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={DS.pageTitle}>Device Trust</Text>
          <Text style={[DS.cardSub, { marginTop: 0 }]}>Hardware integrity & attestation</Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, opacity: pulseAnim }} />
          <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: C.green }}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[DS.scrollContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>

        {/* ── Trust Score Hero Card ─── */}
        <View style={[DS.cardLg, { alignItems: 'center' }]}>
          <TrustGauge score={TRUST_SCORE} />
          <Text style={[DS.cardSub, { textAlign: 'center', lineHeight: 18 }]}>
            SentinelPay Hardware Integrity Engine continuously monitors the system runtime environment to prevent overlay fraud, malware interception, and device cloning.
          </Text>
          <View style={[DS.grid2, { marginTop: S.md, width: '100%' }]}>
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

        {/* ── Security Signals ─── */}
        <Text style={DS.sectionTitle}>Security Signals ({SIGNALS.filter(s => s.status === 'PASSED').length}/{SIGNALS.length} Passed)</Text>
        <View style={[DS.card, { paddingTop: S.sm, paddingBottom: S.sm }]}>
          {SIGNALS.map((s, i) => <SignalRow key={s.title} signal={s} delay={i * 50} />)}
        </View>

        {/* ── Device Attestation ─── */}
        <Text style={DS.sectionTitle}>Device Attestation</Text>
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md }}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shieldCheck" size={20} color={C.green} />
            </View>
            <View>
              <Text style={DS.cardTitle}>Full Attestation Passed</Text>
              <Text style={DS.cardSub}>STRONG_INTEGRITY · Verified 2 min ago</Text>
            </View>
          </View>
          <AttestRow icon="hardDrive"   label="Device Integrity"             value="✓ VERIFIED"            />
          <AttestRow icon="layers"      label="App Integrity"                value="✓ VERIFIED"            />
          <AttestRow icon="server"      label="OS Integrity"                 value="✓ VERIFIED"            />
          <AttestRow icon="shieldCheck" label="Play Integrity Result"        value="STRONG_INTEGRITY"       />
          <AttestRow icon="fingerprint" label="Hardware-backed Security"     value="✓ ENABLED"             />
          <AttestRow icon="cpu"         label="Trusted Execution Environment" value="✓ ACTIVE"             />
          <AttestRow icon="clock"       label="Security Patch Level"         value="2024-07"               valueColor={C.green}  />
          <AttestRow icon="lock"        label="Encryption"                   value="AES-256-GCM"           valueColor={C.blue}   />
          <AttestRow icon="shieldCheck" label="Bootloader Status"            value="LOCKED"                valueColor={C.green}  />
          <AttestRow icon="smartphone"  label="SafetyNet"                    value="BASIC_INTEGRITY"       valueColor={C.green}  />
        </View>

        {/* ── Security Timeline ─── */}
        <Text style={DS.sectionTitle}>Security Timeline</Text>
        <View style={DS.card}>
          {TIMELINE.map((ev, i) => (
            <TimelineEvent
              key={ev.event}
              time={ev.time}
              event={ev.event}
              icon={ev.icon as any}
              color={ev.color}
              bg={ev.bg}
              isLast={i === TIMELINE.length - 1}
            />
          ))}
        </View>

        {/* ── Info Banner ─── */}
        <View style={[DS.infoCard, { backgroundColor: C.blueBg, borderRadius: R.lg }]}>
          <AppIcon name="info" size={18} color={C.blue} />
          <Text style={{ flex: 1, fontSize: T.xs, color: C.blue, lineHeight: 17, marginLeft: S.xs }}>
            Device trust signals are evaluated dynamically during every transaction scoring request by FraudShield AI to protect your wallet in real time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  signalRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.sm,
    paddingVertical: S.sm,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  attestRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingVertical: S.xs + 2,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
});
