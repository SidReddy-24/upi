import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import fraudShieldApi from '../services/fraudShieldApi';

const PRESETS = [
  "Someone from RBI called asking to verify account",
  "Part-time job: Like YouTube videos to earn ₹5000/day",
  "FedEx courier parcel stuck containing illegal items",
  "Urgent: Your HDFC electricity connection will be disconnected",
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
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI Scam Assistant</Text>
        <Text style={styles.subtitle}>Ask "Is this safe?" — paste suspicious SMS, calls, or investment offers.</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Paste SMS, message, or describe what happened..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          value={input}
          onChangeText={setInput}
        />

        <TouchableOpacity
          style={styles.analyzeBtn}
          onPress={() => handleAnalyze()}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>Analyze with AI Scam Engine →</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.presetLabel}>Quick Presets to Test:</Text>
      <View style={styles.presetContainer}>
        {PRESETS.map((p, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.presetChip}
            onPress={() => {
              setInput(p);
              handleAnalyze(p);
            }}>
            <Text style={styles.presetText}>💡 "{p}"</Text>
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

          {result.recommended_actions.map((act: string, idx: number) => (
            <Text key={idx} style={styles.actionText}>{act}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, fontSize: 14, color: '#f8fafc', height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#334155' },
  analyzeBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  presetLabel: { fontSize: 13, fontWeight: '700', color: '#cbd5e1', marginBottom: 8 },
  presetContainer: { gap: 8, marginBottom: 20 },
  presetChip: { backgroundColor: '#1e293b', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  presetText: { fontSize: 13, color: '#818cf8' },
  resultCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#475569', marginBottom: 30 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  catTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelDanger: { backgroundColor: '#ef4444' },
  levelSafe: { backgroundColor: '#22c55e' },
  levelBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  explanationText: { fontSize: 14, color: '#e2e8f0', lineHeight: 20, marginBottom: 14 },
  actionText: { fontSize: 13, color: '#cbd5e1', marginBottom: 6, fontWeight: '600' },
});
