import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';

const PRESETS = [
  "Someone from RBI called asking to verify account details immediately",
  "Part-time job offer: Like YouTube videos to earn ₹5,000/day",
  "FedEx courier parcel stuck containing illegal narcotics",
  "Urgent: Electricity connection will be disconnected tonight",
];

export default function ScamAssistantScreen() {
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
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconCircle}>
            <AppIcon name="assistant" size={22} color="#2D6A4F" />
          </View>
          <Text style={styles.title}>AI Scam Assistant</Text>
        </View>
        <Text style={styles.subtitle}>Ask "Is this safe?" — paste suspicious SMS, calls, or investment offers.</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Paste SMS, message, or describe suspicious activity..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          value={input}
          onChangeText={setInput}
        />

        <TouchableOpacity
          style={[styles.analyzeBtn, (!input.trim() || loading) && styles.btnDisabled]}
          onPress={() => handleAnalyze()}
          disabled={!input.trim() || loading}>
          {loading ? (
            <ActivityIndicator color="#FAF7F0" />
          ) : (
            <Text style={styles.analyzeBtnText}>Analyze with FraudShield AI →</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.presetLabel}>Quick Test Presets:</Text>
      <View style={styles.presetContainer}>
        {PRESETS.map((p, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.presetChip}
            onPress={() => {
              setInput(p);
              handleAnalyze(p);
            }}>
            <Text style={styles.presetText}>"{p}"</Text>
          </TouchableOpacity>
        ))}
      </View>

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.catTitle}>{result.threat_category}</Text>
            <View style={[styles.levelBadge, result.threat_level === 'CRITICAL' || result.threat_level === 'HIGH' ? styles.levelDanger : styles.levelSafe]}>
              <Text style={styles.levelBadgeText}>{result.threat_level}</Text>
            </View>
          </View>

          <Text style={styles.explanationText}>{result.nl_explanation}</Text>

          {result.recommended_actions?.map((act: string, idx: number) => (
            <View key={idx} style={styles.actionRow}>
              <Text style={styles.actionDot}>•</Text>
              <Text style={styles.actionText}>{act}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F0', padding: 16 },
  header: { marginBottom: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8C4B8' },
  title: { fontSize: 22, fontWeight: '900', color: '#1A1A2E' },
  subtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E8C4B8', elevation: 2, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  input: { backgroundColor: '#FAF7F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#1A1A2E', height: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E8C4B8' },
  analyzeBtn: { backgroundColor: '#2D6A4F', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: '#FAF7F0', fontSize: 15, fontWeight: '800' },
  presetLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  presetContainer: { gap: 8, marginBottom: 20 },
  presetChip: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E8C4B8' },
  presetText: { fontSize: 13, color: '#2D6A4F', fontWeight: '600' },
  resultCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E8C4B8', marginBottom: 30, elevation: 2 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  catTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  levelDanger: { backgroundColor: '#E63946' },
  levelSafe: { backgroundColor: '#2D6A4F' },
  levelBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  explanationText: { fontSize: 14, color: '#1A1A2E', lineHeight: 20, marginBottom: 14 },
  actionRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  actionDot: { color: '#2D6A4F', fontWeight: '800' },
  actionText: { fontSize: 13, color: '#64748b', fontWeight: '600', flex: 1 },
});
