/**
 * TransactionDetailScreen — Digital Receipt UI Breakdown.
 * Shows payment details formatted like a physical digital receipt.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactionById } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import RiskBadge from '../components/RiskBadge';
import FraudExplanationCard from '../components/FraudExplanationCard';
import AppIcon from '../components/AppIcon';

type Props = { route: RouteProp<RootStackParamList, 'TransactionDetail'> };

function formatTime(iso: string) {
  return parseSafeDate(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function ReceiptRow({ label, value, mono, isBold }: { label: string; value: string; mono?: boolean; isBold?: boolean }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.monoText, isBold && styles.boldText]}>
        {value}
      </Text>
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!txn) {
    return (
      <View style={styles.centerContainer}>
        <AppIcon name="alert" size={40} color="#EF4444" />
        <Text style={styles.notFound}>Transaction Not Found</Text>
      </View>
    );
  }

  const isDebit = txn.type === 'DEBIT';
  const statusColor =
    txn.decision === 'REJECT' ? '#EF4444' :
    txn.decision === 'REVIEW' ? '#F59E0B' : '#10B981';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />

      {/* ─── DIGITAL RECEIPT CONTAINER ─── */}
      <View style={styles.receiptCard}>
        {/* Receipt Header Badge */}
        <View style={styles.receiptHeader}>
          <View style={[styles.statusIconCircle, { backgroundColor: isDebit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
            <AppIcon name={isDebit ? 'send' : 'receive'} size={26} color={isDebit ? '#EF4444' : '#10B981'} />
          </View>

          <Text style={styles.receiptTitle}>
            {isDebit ? 'Payment Sent' : 'Payment Received'}
          </Text>

          <Text style={[styles.receiptAmount, { color: isDebit ? '#F8FAFC' : '#10B981' }]}>
            {isDebit ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN')}
          </Text>

          <View style={[styles.statusStamp, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <AppIcon name={txn.decision === 'REJECT' ? 'alert' : 'check'} size={12} color={statusColor} />
            <Text style={[styles.statusStampText, { color: statusColor }]}>
              {txn.decision === 'REJECT' ? 'PAYMENT BLOCKED' : txn.status === 'APPROVED' ? 'SUCCESSFUL' : txn.status}
            </Text>
          </View>
        </View>

        {/* Dotted Perforated Divider */}
        <View style={styles.dottedDividerRow}>
          <View style={styles.notchLeft} />
          <View style={styles.dottedLine} />
          <View style={styles.notchRight} />
        </View>

        {/* Receipt Body Information */}
        <View style={styles.receiptBody}>
          <Text style={styles.sectionHeader}>TRANSACTION BREAKDOWN</Text>

          <ReceiptRow label="To / Recipient" value={txn.receiver_vpa} mono isBold />
          <ReceiptRow label="From / Sender" value={txn.sender_vpa} mono />
          <ReceiptRow label="Date & Time" value={formatTime(txn.created_at)} />
          <ReceiptRow label="Payment Type" value="UPI Wallet Transfer" />
          <ReceiptRow label="Ref Transaction ID" value={txn.id} mono />
        </View>

        {/* Dotted Separator */}
        <View style={styles.dottedDividerRow}>
          <View style={styles.notchLeft} />
          <View style={styles.dottedLine} />
          <View style={styles.notchRight} />
        </View>

        {/* FraudShield AI Audit Section */}
        <View style={styles.receiptAuditSection}>
          <View style={styles.auditTitleRow}>
            <AppIcon name="shield" size={16} color="#10B981" />
            <Text style={styles.auditSectionTitle}>FraudShield AI Audit</Text>
          </View>

          <View style={styles.auditMetricsRow}>
            <View style={styles.auditMetricBox}>
              <Text style={styles.auditMetricLabel}>AI RISK SCORE</Text>
              <Text style={[styles.auditMetricVal, { color: statusColor }]}>
                {txn.risk_score != null ? `${Math.round(txn.risk_score * 100)}%` : 'N/A'}
              </Text>
            </View>

            <View style={styles.auditMetricDivider} />

            <View style={styles.auditMetricBox}>
              <Text style={styles.auditMetricLabel}>DECISION</Text>
              <Text style={[styles.auditMetricVal, { color: statusColor }]}>
                {txn.decision || 'APPROVE'}
              </Text>
            </View>
          </View>

          {txn.fraud_reason && txn.decision && (
            <View style={styles.explanationBox}>
              <FraudExplanationCard
                decision={txn.decision}
                explanation={{ summary: txn.fraud_reason, top_factors: [] }}
                riskScore={txn.risk_score ?? 0}
              />
            </View>
          )}
        </View>

        {/* Receipt Footer */}
        <View style={styles.receiptFooter}>
          <AppIcon name="shield" size={14} color="#64748B" />
          <Text style={styles.footerText}>Secured by FraudShield AI v1.0 • SentinelPay</Text>
        </View>
      </View>

      {/* ─── RECEIPT ACTION BUTTONS ─── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => Alert.alert('Share Receipt', 'Digital transaction receipt copied to clipboard.')}
        >
          <AppIcon name="externalLink" size={16} color="#F8FAFC" />
          <Text style={styles.shareBtnText}> Share Receipt</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F3EA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F7F3EA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFound: {
    color: '#C0392B',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },

  /* RECEIPT CARD */
  receiptCard: {
    backgroundColor: '#EFE7DA',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCD1BF',
    shadowColor: '#181818',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#EFE7DA',
  },
  statusIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  receiptAmount: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 12,
    color: '#181818',
  },
  statusStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusStampText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* DOTTED SEPARATOR */
  dottedDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    backgroundColor: '#EFE7DA',
    overflow: 'hidden',
  },
  notchLeft: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F7F3EA',
    marginLeft: -8,
  },
  dottedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#DCD1BF',
    borderStyle: 'dashed',
  },
  notchRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F7F3EA',
    marginRight: -8,
  },

  /* BODY */
  receiptBody: {
    padding: 20,
    backgroundColor: '#EFE7DA',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#666666',
    letterSpacing: 1,
    marginBottom: 14,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#DCD1BF',
  },
  rowLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
    flex: 1,
  },
  rowValue: {
    fontSize: 13,
    color: '#181818',
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  boldText: {
    fontWeight: '800',
    color: '#181818',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#2E8B57',
  },

  /* AUDIT SECTION */
  receiptAuditSection: {
    padding: 20,
    backgroundColor: '#F7F3EA',
    borderTopWidth: 1,
    borderTopColor: '#DCD1BF',
  },
  auditTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  auditSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#181818',
  },
  auditMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#EFE7DA',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  auditMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  auditMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 0.5,
  },
  auditMetricVal: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  auditMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#DCD1BF',
  },
  explanationBox: {
    marginTop: 4,
  },

  /* FOOTER */
  receiptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: '#EFE7DA',
    borderTopWidth: 1,
    borderTopColor: '#DCD1BF',
  },
  footerText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '700',
  },

  /* ACTIONS */
  actionRow: {
    marginTop: 18,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E8B57',
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
