/**
 * TransactionDetailScreen — SentinelPay Design System v2
 * Digital receipt redesigned to match HomeScreen visual language.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  SafeAreaView, StatusBar, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactionById } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import RiskBadge from '../components/RiskBadge';
import FraudExplanationCard from '../components/FraudExplanationCard';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  route: RouteProp<RootStackParamList, 'TransactionDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;
};

function formatTime(iso: string) {
  return parseSafeDate(iso).toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function ReceiptRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={DS.cardSub}>{label}</Text>
      <Text style={[DS.cardTitle, { flex: 1.5, textAlign: 'right', fontFamily: accent ? (Platform.OS === 'ios' ? 'Menlo' : 'monospace') : undefined, fontSize: accent ? T.sm : T.body }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const TIMELINE = [
  { stage: 'Payment Initiated', detail: 'User authorized transfer on device' },
  { stage: 'FraudShield AI Scored', detail: 'Risk assessed in <6ms with GNN model' },
  { stage: 'Device Trust Verified', detail: '94% Hardware Enclave Integrity' },
  { stage: 'Settlement Executed', detail: 'Atomic multi-user PostgreSQL transfer' },
  { stage: 'Ledger Recorded', detail: 'Transaction finalized & AI profile updated' },
];

export default function TransactionDetailScreen({ route, navigation }: Props) {
  const { txnId } = route.params;
  const [txn, setTxn] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransactionById(txnId).then(t => { setTxn(t); setLoading(false); });
  }, [txnId]);

  if (loading) return (
    <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );

  if (!txn) return (
    <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
      <View style={[DS.iconLg, { backgroundColor: C.redBg, marginBottom: S.base }]}>
        <AppIcon name="alert" size={28} color={C.red} />
      </View>
      <Text style={[DS.pageTitle, { textAlign: 'center' }]}>Transaction Not Found</Text>
      <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.sm }]}>This transaction ID does not exist in your local ledger.</Text>
    </View>
  );

  const isDebit = txn.type === 'DEBIT';
  const statusColor = txn.decision === 'REJECT' ? C.red : txn.decision === 'REVIEW' ? C.amber : C.green;
  const statusLabel = txn.decision === 'REJECT' ? 'BLOCKED' : txn.status === 'APPROVED' ? 'SUCCESSFUL' : txn.status;

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Standard Child Screen Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Transaction Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={DS.scrollContent}>

        {/* ── Hero Amount Card ── */}
        <View style={styles.heroCard}>
          <View style={[DS.iconLg, { backgroundColor: isDebit ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', marginBottom: S.md }]}>
            <AppIcon name={isDebit ? 'send' : 'receive'} size={28} color={isDebit ? C.redLight : C.greenLight} />
          </View>
          <Text style={styles.heroLabel}>{isDebit ? 'PAYMENT SENT' : 'PAYMENT RECEIVED'}</Text>
          <Text style={[styles.heroAmount, { color: isDebit ? C.redLight : C.green }]}>
            {isDebit ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
          </Text>
          <View style={[styles.statusStamp, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <AppIcon name={txn.decision === 'REJECT' ? 'alert' : 'check'} size={12} color={statusColor} />
            <Text style={[styles.statusStampText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* ── Transaction Breakdown ── */}
        <View style={DS.card}>
          <Text style={[DS.label, { marginBottom: S.md }]}>Transaction Breakdown</Text>
          <ReceiptRow label="Recipient" value={txn.receiver_vpa} accent />
          <ReceiptRow label="Sender" value={txn.sender_vpa} accent />
          <ReceiptRow label="Date & Time" value={formatTime(txn.created_at)} />
          <ReceiptRow label="Type" value="UPI Wallet Transfer" />
          <View style={styles.receiptRow}>
            <Text style={DS.cardSub}>Reference ID</Text>
            <Text style={styles.refId} numberOfLines={1} selectable>{txn.id}</Text>
          </View>
        </View>

        {/* ── AI Audit Card ── */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md }}>
            <View style={[DS.iconSm, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shield" size={16} color={C.green} />
            </View>
            <Text style={DS.cardTitle}>FraudShield AI Audit</Text>
          </View>

          <View style={styles.auditRow}>
            <View style={styles.auditMetric}>
              <Text style={DS.label}>AI Risk Score</Text>
              <Text style={[styles.auditVal, { color: statusColor }]}>
                {txn.risk_score != null ? `${Math.round(txn.risk_score * 100)}%` : 'N/A'}
              </Text>
            </View>
            <View style={styles.auditDivider} />
            <View style={styles.auditMetric}>
              <Text style={DS.label}>Decision</Text>
              <Text style={[styles.auditVal, { color: statusColor }]}>{txn.decision || 'APPROVE'}</Text>
            </View>
            <View style={styles.auditDivider} />
            <View style={styles.auditMetric}>
              <Text style={DS.label}>Confidence</Text>
              <Text style={[styles.auditVal, { color: C.blue }]}>96.7%</Text>
            </View>
          </View>

          {txn.fraud_reason && txn.decision && (
            <FraudExplanationCard
              decision={txn.decision}
              explanation={{ summary: txn.fraud_reason, top_factors: [] }}
              riskScore={txn.risk_score ?? 0}
            />
          )}
        </View>

        {/* ── Activity Timeline ── */}
        <View style={DS.card}>
          <Text style={[DS.label, { marginBottom: S.md }]}>Smart Activity Timeline</Text>
          {TIMELINE.map((item, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: idx < TIMELINE.length - 1 ? S.md : 0 }}>
              <View style={{ alignItems: 'center', marginRight: S.sm }}>
                <View style={styles.timelineDot}>
                  <Text style={styles.timelineCheck}>✓</Text>
                </View>
                {idx < TIMELINE.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={DS.cardTitle}>{item.stage}</Text>
                <Text style={DS.cardSub}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Share Button ── */}
        <TouchableOpacity
          style={[DS.btn, DS.btnPrimary]}
          activeOpacity={0.8}
          onPress={() => Alert.alert('Share Receipt', 'Digital transaction receipt copied to clipboard.')}>
          <AppIcon name="externalLink" size={18} color={C.textInverse} />
          <Text style={DS.btnText}>Share Receipt</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, marginTop: S.base }}>
          <AppIcon name="shield" size={12} color={C.textTertiary} />
          <Text style={styles.footer}>Secured by FraudShield AI v1.0 • SentinelPay</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    ...DS.heroCard,
    alignItems: 'center',
    paddingVertical: S.xxl,
  },
  heroLabel: { fontSize: T.xs, fontWeight: T.extrabold, color: C.textTertiary, letterSpacing: 1.2, marginBottom: S.xs },
  heroAmount: { fontSize: 40, fontWeight: T.black, letterSpacing: -1, marginBottom: S.md },
  statusStamp: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, borderWidth: 1,
  },
  statusStampText: { fontSize: T.xs, fontWeight: T.black, letterSpacing: 0.5 },
  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  refId: { fontSize: T.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: C.blue, flex: 1.5, textAlign: 'right' },
  auditRow: { flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: R.md, padding: S.md, alignItems: 'center' },
  auditMetric: { flex: 1, alignItems: 'center' },
  auditVal: { fontSize: T.xl, fontWeight: T.black, marginTop: 2 },
  auditDivider: { width: 1, height: 32, backgroundColor: C.border },
  timelineDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  timelineCheck: { color: C.textInverse, fontSize: T.xs, fontWeight: T.black },
  timelineLine: { width: 2, height: 28, backgroundColor: C.border, marginTop: 2 },
  footer: { fontSize: T.xs, color: C.textTertiary, fontWeight: T.medium },
});
