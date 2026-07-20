/**
 * RiskBadge — colour-coded pill showing fraud decision + score.
 * APPROVE = green, REVIEW = amber, REJECT = red
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  decision: 'APPROVE' | 'REVIEW' | 'REJECT' | string;
  riskScore?: number | null;
}

const COLORS: Record<string, { bg: string; text: string; label: string }> = {
  APPROVE: { bg: '#dcfce7', text: '#166534', label: '✓ APPROVED' },
  REVIEW:  { bg: '#fef9c3', text: '#92400e', label: '⚠ REVIEW' },
  REJECT:  { bg: '#fee2e2', text: '#991b1b', label: '✕ BLOCKED' },
};

export default function RiskBadge({ decision, riskScore }: Props) {
  const colors = COLORS[decision] ?? { bg: '#f3f4f6', text: '#374151', label: decision };
  const pct = riskScore != null ? Math.round(riskScore * 100) : null;

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{colors.label}</Text>
      {pct != null && (
        <Text style={[styles.score, { color: colors.text }]}> · Risk {pct}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  label: { fontSize: 13, fontWeight: '700' },
  score: { fontSize: 13, fontWeight: '500' },
});
