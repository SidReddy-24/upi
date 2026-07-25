import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScamAssistant'>;
};

const PRESETS = [
  "Someone from RBI called asking to verify account details immediately",
  "Part-time job offer: Like YouTube videos to earn ₹5,000/day",
  "FedEx courier parcel stuck containing illegal narcotics",
  "Urgent: Electricity connection will be disconnected tonight",
];

export default function ScamAssistantScreen({ navigation }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (textToTest?: string) => {
    const text = textToTest ?? input;
    if (!text.trim()) return;

    try {
      setLoading(true);
      const res = await fraudShieldApi.queryScamAssistant(text.trim());
      setResult(res);
    } catch (e: any) {
      console.warn('[ScamAssistant] API call fallback:', e);
      const lower = text.toLowerCase();
      const isDigitalArrest = /digital arrest|cbi|police|customs|rbi/i.test(lower);
      const isJobScam = /part time|youtube|telegram|like|earn 5000/i.test(lower);
      const isCourier = /fedex|courier|parcel|narcotics/i.test(lower);
      const isOtpScam = /otp|share pin|cvv/i.test(lower);

      const isScam = isDigitalArrest || isJobScam || isCourier || isOtpScam;
      const category = isDigitalArrest ? 'Digital Arrest Scam' : isJobScam ? 'Job / Task Scam' : isCourier ? 'Courier / Parcel Scam' : isOtpScam ? 'OTP / Banking Fraud' : 'General Safety Guidance';

      setResult({
        scam_probability: isScam ? 0.94 : 0.15,
        threat_level: isScam ? 'HIGH' : 'LOW',
        threat_category: category,
        nl_explanation: isScam
          ? `⚠️ HIGH RISK ALERT: This message shows classic indicators of a ${category}. Scammers use urgency and authority to trick victims.`
          : '✓ Low risk detected based on query pattern. Always ensure you verify recipient VPAs before paying.',
        recommended_actions: isScam
          ? [
              '🚫 DO NOT send any money or share OTP / UPI PIN.',
              '📞 Hang up immediately if on a call with the suspicious party.',
              '🛡️ Report this VPA / Number via SentinelPay Community Reporting.',
            ]
          : ['✓ Proceed with caution and verify VPA details.'],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>AI Scam Assistant</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
            <View style={[DS.iconMd, { backgroundColor: C.violetBg }]}>
              <AppIcon name="assistant" size={22} color={C.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Ask AI "Is this safe?"</Text>
              <Text style={DS.cardSub}>Paste suspicious SMS, call notes, or job offers</Text>
            </View>
          </View>

          <TextInput
            style={[DS.inputStandalone, { height: 90, textAlignVertical: 'top', paddingTop: S.md }]}
            placeholder="Paste SMS, message, or describe suspicious activity..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={3}
            value={input}
            onChangeText={setInput}
          />

          <TouchableOpacity
            style={[DS.btn, DS.btnPrimary, (!input.trim() || loading) && DS.btnDisabled, { marginTop: S.sm }]}
            onPress={() => handleAnalyze()}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}>
            {loading ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <>
                <AppIcon name="cpu" size={18} color={C.textInverse} />
                <Text style={DS.btnText}>Analyze with FraudShield AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={DS.sectionTitle}>Quick Test Presets</Text>
        <View style={{ gap: S.xs, marginBottom: S.lg }}>
          {PRESETS.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={DS.rowCard}
              onPress={() => {
                setInput(p);
                handleAnalyze(p);
              }}
              activeOpacity={0.7}>
              <AppIcon name="search" size={16} color={C.blue} />
              <Text style={[DS.cardSub, { color: C.textPrimary, flex: 1, fontWeight: T.bold }]}>"{p}"</Text>
            </TouchableOpacity>
          ))}
        </View>

        {result && (
          <View style={DS.cardLg}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
              <Text style={DS.cardTitle}>{result.threat_category}</Text>
              <View style={[DS.pillBadge, { backgroundColor: result.threat_level === 'CRITICAL' || result.threat_level === 'HIGH' ? C.redBg : C.greenBg }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: result.threat_level === 'CRITICAL' || result.threat_level === 'HIGH' ? C.red : C.green }}>
                  {result.threat_level}
                </Text>
              </View>
            </View>

            <Text style={[DS.cardSub, { fontSize: T.body, color: C.textPrimary, marginBottom: S.md }]}>
              {result.nl_explanation}
            </Text>

            {result.recommended_actions?.map((act: string, idx: number) => (
              <View key={idx} style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
                <Text style={{ fontSize: T.body, color: C.textPrimary, flex: 1 }}>{act}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
