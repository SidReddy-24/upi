/**
 * TransactionDetailScreen — full breakdown of a single transaction.
 * Shows all fraud signals, explanation, and transaction metadata.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactionById } from '../utils/walletDb';
import RiskBadge from '../components/RiskBadge';
import FraudExplanationCard from '../components/FraudExplanationCard';

type Props = { route: RouteProp<RootStackParamList, 'TransactionDetail'> };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen({ route }: Props) {
  const { txnId } = route.params;
  const [txn, setTxn] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransactionById(txnId).then(t => {
      setTxn(t);
      setLoading(false);
    });
  }, [txnId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!txn) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Transaction not found</Text>
      </View>
    );
  }

  const decisionColor =
    txn.decision === 'APPROVE' ? '#16a34a' :
    txn.decision === 'REVIEW'  ? '#d97706' : '#dc2626';

  return (
    <ScrollView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── AMOUNT HEADER ── */}
      <View style={[styles.header, { borderBottomColor: decisionColor }]}>
        <Text style={styles.headerLabel}>
          {txn.type === 'DEBIT' ? 'Sent' : 'Received'}
        </Text>
        <Text style={[styles.headerAmount, { color: txn.type === 'DEBIT' ? '#dc2626' : '#16a34a' }]}>
          {txn.type === 'DEBIT' ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
        </Text>
        {txn.decision && (
          <View style={{ marginTop: 8 }}>
            <RiskBadge decision={txn.decision} riskScore={txn.risk_score} />
          </View>
        )}
      </View>

      {/* ── DETAILS CARD ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Transaction Details</Text>
        <Row label="Transaction ID" value={txn.id} mono />
        <Row label="Date & Time" value={formatTime(txn.created_at)} />
        <Row label="From" value={txn.sender_vpa} mono />
        <Row label="To" value={txn.receiver_vpa} mono />
        <Row label="Amount" value={`₹${txn.amount.toLocaleString('en-IN')}`} />
        <Row label="Status" value={txn.status} />
        {txn.risk_score != null && (
          <Row label="Risk Score" value={`${Math.round(txn.risk_score * 100)}%`} />
        )}
      </View>

      {/* ── FRAUD EXPLANATION (if available) ── */}
      {txn.fraud_reason && txn.decision && txn.risk_score != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FraudShield Decision</Text>
          <FraudExplanationCard
            decision={txn.decision}
            explanation={{ summary: txn.fraud_reason, top_factors: [] }}
            riskScore={txn.risk_score}
          />
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16, color: '#6b7280' },

  header: {
    backgroundColor: '#fff', padding: 24,
    alignItems: 'center', borderBottomWidth: 3, marginBottom: 16,
  },
  headerLabel: { fontSize: 14, color: '#9ca3af', fontWeight: '500', marginBottom: 4 },
  headerAmount: { fontSize: 40, fontWeight: '800' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '500', flex: 1 },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 2, textAlign: 'right' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
});

import { Platform } from 'react-native';
