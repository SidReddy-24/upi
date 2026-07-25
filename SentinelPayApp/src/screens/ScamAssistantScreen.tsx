import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScamAssistant'> };

const PRESETS = [
  { label: 'Digital Arrest', icon: 'alertTriangle', color: C.red,    bg: C.redBg,    text: "Someone from RBI called asking to verify account details immediately" },
  { label: 'Job Scam',       icon: 'cpu',           color: C.violet, bg: C.violetBg, text: "Part-time job offer: Like YouTube videos to earn ₹5,000/day" },
  { label: 'Courier Fraud',  icon: 'report',        color: C.amber,  bg: C.amberBg,  text: "FedEx courier parcel stuck containing illegal narcotics" },
  { label: 'Utility Threat', icon: 'phone',         color: C.blue,   bg: C.blueBg,   text: "Urgent: Electricity connection will be disconnected tonight" },
] as const;

export default function ScamAssistantScreen({ navigation }: Props) {
  const [input, setInput]   = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (textToTest?: string) => {
    const text = textToTest ?? input;
    if (!text.trim()) return;
    try {
      setLoading(true);
      const res = await fraudShieldApi.queryScamAssistant(text.trim());
      setResult(res);
    } catch {
      const lower = text.toLowerCase();
      const isDigitalArrest = /digital arrest|cbi|police|customs|rbi/i.test(lower);
      const isJobScam       = /part time|youtube|telegram|like|earn 5000/i.test(lower);
      const isCourier       = /fedex|courier|parcel|narcotics/i.test(lower);
      const isOtpScam       = /otp|share pin|cvv/i.test(lower);
      const isScam          = isDigitalArrest || isJobScam || isCourier || isOtpScam;
      const category        = isDigitalArrest ? 'Digital Arrest Scam'
                            : isJobScam       ? 'Job / Task Scam'
                            : isCourier       ? 'Courier / Parcel Scam'
                            : isOtpScam       ? 'OTP / Banking Fraud'
                            : 'General Safety Guidance';
      setResult({
        scam_probability: isScam ? 0.94 : 0.15,
        threat_level: isScam ? 'HIGH' : 'LOW',
        threat_category: category,
        nl_explanation: isScam
          ? `⚠️ HIGH RISK ALERT: This message shows classic indicators of a ${category}. Scammers use urgency and authority to trick victims.`
          : '✓ Low risk detected based on query pattern. Always verify recipient VPAs before paying.',
        recommended_actions: isScam ? [
          '🚫 DO NOT send any money or share OTP / UPI PIN.',
          '📞 Hang up immediately if on a call with the suspicious party.',
          '🛡️ Report this VPA / Number via SentinelPay Community Reporting.',
        ] : ['✓ Proceed with caution and verify VPA details.'],
      });
    } finally {
      setLoading(false);
    }
  };

  const isHigh = result?.threat_level === 'HIGH' || result?.threat_level === 'CRITICAL';

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Single header title */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>AI Scam Assistant</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Hero input card ──────────────────────────────────────────── */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
            <View style={[DS.iconLg, { backgroundColor: C.violetBg }]}>
              <AppIcon name="assistant" size={26} color={C.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Ask AI "Is this safe?"</Text>
              <Text style={DS.cardSub}>Paste suspicious SMS, calls, or job offers</Text>
            </View>
          </View>

          {/* Multiline input */}
          <TextInput
            style={{
              backgroundColor: C.surfaceAlt,
              borderRadius: R.lg,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: S.base,
              paddingTop: S.md,
              paddingBottom: S.md,
              height: 100,
              fontSize: T.body,
              fontWeight: T.medium,
              color: C.textPrimary,
              textAlignVertical: 'top',
              marginBottom: S.md,
            }}
            placeholder="Paste SMS, message, or describe suspicious activity..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={4}
            value={input}
            onChangeText={setInput}
          />

          {/* Analyze button — prominent, full width */}
          <TouchableOpacity
            style={[DS.btn, DS.btnSuccess, { height: 56 }, (!input.trim() || loading) && DS.btnDisabled]}
            onPress={() => handleAnalyze()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <>
                <AppIcon name="cpu" size={20} color={C.textInverse} />
                <Text style={[DS.btnText, { fontSize: T.md }]}>Analyze with FraudShield AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Analysis Result ──────────────────────────────────────────── */}
        {result && (
          <View style={[DS.cardLg, { borderLeftWidth: 3, borderLeftColor: isHigh ? C.red : C.green }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
              <View style={[DS.iconMd, { backgroundColor: isHigh ? C.redBg : C.greenBg }]}>
                <AppIcon name={isHigh ? 'shieldAlert' : 'shieldCheck'} size={22} color={isHigh ? C.red : C.green} />
              </View>
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={DS.cardTitle}>{result.threat_category}</Text>
                <Text style={DS.cardSub}>Scam probability: {Math.round((result.scam_probability || 0) * 100)}%</Text>
              </View>
              <View style={[DS.pillBadge, { backgroundColor: isHigh ? C.redBg : C.greenBg }]}>
                <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: isHigh ? C.red : C.green }}>
                  {result.threat_level}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: T.body, color: C.textPrimary, lineHeight: 22, marginBottom: S.md }}>
              {result.nl_explanation}
            </Text>

            {result.recommended_actions?.map((act: string, idx: number) => (
              <View key={idx} style={[DS.infoCard, { backgroundColor: isHigh ? C.redBg : C.surfaceAlt, marginBottom: S.xs }]}>
                <Text style={{ fontSize: T.body, color: C.textPrimary, flex: 1, lineHeight: 20 }}>{act}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Quick Preset Cards ───────────────────────────────────────── */}
        <Text style={[DS.sectionTitle, { marginTop: result ? S.xl : 0 }]}>Quick Test Presets</Text>
        <View style={{ gap: S.sm }}>
          {PRESETS.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={DS.rowCard}
              onPress={() => { setInput(p.text); handleAnalyze(p.text); }}
              activeOpacity={0.7}
            >
              <View style={[DS.iconSm, { backgroundColor: p.bg }]}>
                <AppIcon name={p.icon as any} size={16} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={DS.cardTitle}>{p.label}</Text>
                <Text style={[DS.cardSub, { marginTop: 2 }]} numberOfLines={1}>{p.text}</Text>
              </View>
              <AppIcon name="chevronRight" size={16} color={C.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
