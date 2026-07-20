/**
 * FraudExplanationCard — shows the AI explanation for a fraud decision.
 * Displays summary text + top risk factors as bullet points.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FraudExplanation } from '../types';

interface Props {
  decision: string;
  explanation: FraudExplanation;
  riskScore: number;
}

export default function FraudExplanationCard({ decision, explanation, riskScore }: Props) {
  const isHighRisk = decision !== 'APPROVE';
  const borderColor = decision === 'APPROVE' ? '#16a34a' : decision === 'REVIEW' ? '#d97706' : '#dc2626';

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <Text style={styles.title}>🤖 FraudShield Analysis</Text>
      <Text style={styles.summary}>{explanation.summary}</Text>

      {explanation.top_factors && explanation.top_factors.length > 0 && (
        <View style={styles.factorsBox}>
          <Text style={styles.factorsTitle}>
            {isHighRisk ? '⚠️ Risk Factors Detected:' : '✅ Why this looks safe:'}
          </Text>
          {explanation.top_factors.map((factor, i) => (
            <Text key={i} style={styles.factor}>
              • {factor}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Risk Score</Text>
        <View style={styles.scoreBarBg}>
          <View
            style={[
              styles.scoreBarFill,
              {
                width: `${Math.round(riskScore * 100)}%` as any,
                backgroundColor: borderColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.scoreNum, { color: borderColor }]}>
          {Math.round(riskScore * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  summary: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 10 },
  factorsBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 10 },
  factorsTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  factor: { fontSize: 13, color: '#4b5563', marginTop: 3 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  scoreLabel: { fontSize: 12, color: '#9ca3af', width: 68 },
  scoreBarBg: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreNum: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
});
