/**
 * FraudExplanationCard — shows the AI explanation for a fraud decision.
 * Displays summary text + top risk factors as bullet points.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FraudExplanation } from '../types';
import { C, S, T, R, DS } from '../theme/ds';

interface Props {
  decision: string;
  explanation: FraudExplanation;
  riskScore: number;
}

export default function FraudExplanationCard({ decision, explanation, riskScore }: Props) {
  const isHighRisk = decision !== 'APPROVE';
  const borderColor = decision === 'APPROVE' ? C.green : decision === 'REVIEW' ? C.amber : C.red;

  return (
    <View style={[DS.card, { borderLeftWidth: 4, borderLeftColor: borderColor }]}>
      <Text style={DS.cardTitle}>🤖 FraudShield Analysis</Text>
      <Text style={[DS.cardSub, { fontSize: T.body, color: C.textPrimary, marginVertical: S.xs }]}>{explanation.summary}</Text>

      {explanation.top_factors && explanation.top_factors.length > 0 && (
        <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, flexDirection: 'column', alignItems: 'flex-start', marginVertical: S.xs }]}>
          <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.textPrimary, marginBottom: 4 }}>
            {isHighRisk ? '⚠️ Risk Factors Detected:' : '✅ Why this looks safe:'}
          </Text>
          {explanation.top_factors.map((factor, i) => (
            <Text key={i} style={{ fontSize: T.xs, color: C.textSecondary, marginTop: 2 }}>
              • {factor}
            </Text>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xs }}>
        <Text style={DS.label}>Risk Score</Text>
        <View style={{ flex: 1, height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
          <View
            style={[
              {
                height: 6,
                borderRadius: 3,
                width: `${Math.round(riskScore * 100)}%` as any,
                backgroundColor: borderColor,
              },
            ]}
          />
        </View>
        <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: borderColor }}>
          {Math.round(riskScore * 100)}%
        </Text>
      </View>
    </View>
  );
}
