/**
 * SendMoneyScreen — UPI payment form with real-time fraud scoring.
 *
 * Flow:
 *  1. User enters receiver VPA + amount
 *  2. Tap "Check & Pay" → calls FraudShield /score endpoint
 *  3. Decision = APPROVE → execute payment immediately
 *  4. Decision = REVIEW  → show warning, user must confirm after 5s cooldown
 *  5. Decision = REJECT  → block, show reason, no payment
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Keyboard, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, FraudScore } from '../types';
import { getUser, executePayment } from '../utils/walletDb';
import fraudShieldApi from '../services/fraudShieldApi';
import RiskBadge from '../components/RiskBadge';
import FraudExplanationCard from '../components/FraudExplanationCard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SendMoney'>;
  route: RouteProp<RootStackParamList, 'SendMoney'>;
};

type Step = 'FORM' | 'SCORING' | 'RESULT' | 'SUCCESS' | 'BLOCKED';

function genTxnId() {
  return `TXN_SP_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

export default function SendMoneyScreen({ navigation, route }: Props) {
  const [receiverVpa, setReceiverVpa] = useState(route.params?.prefillVpa ?? '');
  const [amountStr, setAmountStr] = useState(
    route.params?.prefillAmount ? String(route.params.prefillAmount) : '',
  );
  const [step, setStep] = useState<Step>('FORM');
  const [score, setScore] = useState<FraudScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const amount = parseFloat(amountStr) || 0;
  const vpaValid = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/.test(receiverVpa.trim());
  const amountValid = amount > 0 && amount <= 200000;

  // ── Step 1: Score the transaction ──────────────────────────────────────────
  const handleScore = async () => {
    if (!vpaValid)  return Alert.alert('Invalid VPA', 'Enter a valid VPA like name@bankname');
    if (!amountValid) return Alert.alert('Invalid Amount', 'Amount must be between ₹1 and ₹2,00,000');

    Keyboard.dismiss();
    setStep('SCORING');
    setError(null);

    try {
      const user = await getUser();
      if (amount > user.balance) {
        setError('Insufficient SPC balance');
        setStep('FORM');
        return;
      }

      const txnId = genTxnId();
      const result = await fraudShieldApi.scoreTransaction({
        transaction_id: txnId,
        sender_vpa: user.vpa,
        receiver_vpa: receiverVpa.trim(),
        amount,
        currency: 'INR',
        transaction_type: 'P2P',
        device: {
          device_id: `DEV_SP_${Platform.OS.toUpperCase()}`,
          os_type: 'ANDROID',
          is_rooted: false,
          is_emulator: true, // demo: flag as emulator honestly
        },
        location: { latitude: 19.076, longitude: 72.877 }, // Mumbai
        network: { ip_address: '10.0.2.2', connection_type: 'Wifi' },
        metadata: { org_id: 'ORG_DEMO_001', channel: 'mobile_app' },
      });

      setScore(result);
      setStep('RESULT');

      // For REVIEW, start 5-second cooldown before confirm button enables
      if (result.decision === 'REVIEW') {
        setCooldown(5);
        cooldownRef.current = setInterval(() => {
          setCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownRef.current!);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Network error';
      setError(`FraudShield error: ${msg}`);
      setStep('FORM');
    }
  };

  // ── Step 2: Execute payment after decision ─────────────────────────────────
  const handleExecute = async () => {
    if (!score) return;

    const fraudReason =
      score.explanation?.summary ?? score.signals?.rule_flags?.join(', ') ?? null;

    const result = await executePayment(
      receiverVpa.trim(),
      amount,
      score.risk_score,
      score.decision,
      fraudReason,
    );

    if (result.success) {
      setStep('SUCCESS');
    } else {
      setError(result.error ?? 'Payment failed');
      setStep('BLOCKED');
    }
  };

  const handleReject = () => setStep('BLOCKED');
  const goHome = () => navigation.navigate('Home');

  // ─── Render ────────────────────────────────────────────────────────────────
  if (step === 'SCORING') {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.scoringTitle}>Analysing transaction…</Text>
        <Text style={styles.scoringSubtitle}>Running ML + rule engine checks</Text>
      </View>
    );
  }

  if (step === 'SUCCESS') {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.bigEmoji}>✅</Text>
        <Text style={styles.successTitle}>Payment Sent!</Text>
        <Text style={styles.successAmount}>₹{amount.toLocaleString('en-IN')}</Text>
        <Text style={styles.successTo}>to {receiverVpa.trim()}</Text>
        {score && (
          <View style={{ marginTop: 12 }}>
            <RiskBadge decision={score.decision} riskScore={score.risk_score} />
          </View>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={goHome}>
          <Text style={styles.primaryBtnText}>Back to Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'BLOCKED') {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.bigEmoji}>🚫</Text>
        <Text style={styles.blockedTitle}>Payment Blocked</Text>
        <Text style={styles.blockedReason}>
          {error ?? score?.explanation?.summary ?? 'High fraud risk detected'}
        </Text>
        {score && (
          <View style={{ marginTop: 12 }}>
            <RiskBadge decision="REJECT" riskScore={score.risk_score} />
          </View>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
          <Text style={styles.secondaryBtnText}>Back to Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} keyboardShouldPersistTaps="handled">

      {/* ── SIMULATED BADGE ── */}
      <View style={styles.simulatedBanner}>
        <Text style={styles.simulatedText}>🧪 SIMULATED — Not real money</Text>
      </View>

      {/* ── FORM ── */}
      {step === 'FORM' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Send SPC</Text>

          <Text style={styles.label}>Receiver UPI ID (VPA)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. merchant@okaxis"
            placeholderTextColor="#9ca3af"
            value={receiverVpa}
            onChangeText={setReceiverVpa}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {receiverVpa.length > 3 && !vpaValid && (
            <Text style={styles.fieldError}>VPA format: name@bank</Text>
          )}

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5000"
            placeholderTextColor="#9ca3af"
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="numeric"
          />
          {amountStr.length > 0 && !amountValid && (
            <Text style={styles.fieldError}>Enter amount between ₹1 and ₹2,00,000</Text>
          )}

          {error && <Text style={styles.apiError}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, (!vpaValid || !amountValid) && styles.disabledBtn]}
            onPress={handleScore}
            disabled={!vpaValid || !amountValid}>
            <Text style={styles.primaryBtnText}>🛡️ Check & Pay</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            FraudShield AI will score this transaction before executing it.
          </Text>
        </View>
      )}

      {/* ── RESULT (score returned, awaiting user confirmation) ── */}
      {step === 'RESULT' && score && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Fraud Check Complete</Text>
            <RiskBadge decision={score.decision} riskScore={score.risk_score} />
          </View>

          <View style={styles.txnSummaryBox}>
            <Text style={styles.txnSummaryAmount}>₹{amount.toLocaleString('en-IN')}</Text>
            <Text style={styles.txnSummaryTo}>→ {receiverVpa.trim()}</Text>
          </View>

          <FraudExplanationCard
            decision={score.decision}
            explanation={score.explanation}
            riskScore={score.risk_score}
          />

          {/* Signals grid */}
          <View style={styles.signalsGrid}>
            {[
              { label: 'ML Score', val: score.signals.ml_score },
              { label: 'Rule Score', val: score.signals.rule_score },
              { label: 'Device Risk', val: score.signals.device_risk },
              { label: 'Velocity', val: score.signals.velocity_risk },
            ].map(s => (
              <View key={s.label} style={styles.signalChip}>
                <Text style={styles.signalLabel}>{s.label}</Text>
                <Text style={styles.signalVal}>{Math.round((s.val ?? 0) * 100)}%</Text>
              </View>
            ))}
          </View>

          {/* Action buttons based on decision */}
          {score.decision === 'APPROVE' && (
            <TouchableOpacity style={styles.approveBtn} onPress={handleExecute}>
              <Text style={styles.approveBtnText}>✓ Confirm Payment</Text>
            </TouchableOpacity>
          )}

          {score.decision === 'REVIEW' && (
            <View>
              <View style={styles.reviewWarning}>
                <Text style={styles.reviewWarningText}>
                  ⚠️ This transaction was flagged for review. Please verify the recipient before proceeding.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.reviewBtn, cooldown > 0 && styles.disabledBtn]}
                onPress={handleExecute}
                disabled={cooldown > 0}>
                <Text style={styles.approveBtnText}>
                  {cooldown > 0 ? `Wait ${cooldown}s to confirm…` : '⚠️ Proceed Anyway'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleReject}>
                <Text style={styles.cancelBtnText}>Cancel Payment</Text>
              </TouchableOpacity>
            </View>
          )}

          {score.decision === 'REJECT' && (
            <View>
              <View style={styles.rejectBanner}>
                <Text style={styles.rejectBannerText}>
                  🚫 This payment has been blocked by FraudShield AI due to high risk signals.
                </Text>
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={goHome}>
                <Text style={styles.cancelBtnText}>Back to Wallet</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.latencyNote}>
            Scored in {score.latency_ms}ms · FraudShield AI v1.0
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  simulatedBanner: {
    backgroundColor: '#fef3c7', paddingVertical: 8,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  simulatedText: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  centeredState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 80,
  },
  bigEmoji: { fontSize: 64, marginBottom: 16 },
  scoringTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
  scoringSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  successAmount: { fontSize: 32, fontWeight: '800', color: '#16a34a' },
  successTo: { fontSize: 15, color: '#6b7280', marginBottom: 16 },
  blockedTitle: { fontSize: 24, fontWeight: '800', color: '#dc2626', marginBottom: 8 },
  blockedReason: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 },

  formCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16,
    padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: '#f9fafb',
  },
  fieldError: { fontSize: 12, color: '#dc2626', marginTop: 4 },
  apiError: {
    fontSize: 13, color: '#dc2626', backgroundColor: '#fee2e2',
    borderRadius: 8, padding: 10, marginTop: 12,
  },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 },

  primaryBtn: {
    backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.45 },
  secondaryBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 12,
  },
  secondaryBtnText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  approveBtn: {
    backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  reviewBtn: {
    backgroundColor: '#d97706', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
  },
  cancelBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },

  resultCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16,
    padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  txnSummaryBox: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 14,
    alignItems: 'center', marginBottom: 4,
  },
  txnSummaryAmount: { fontSize: 28, fontWeight: '800', color: '#111827' },
  txnSummaryTo: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  signalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  signalChip: {
    backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10,
    alignItems: 'center', minWidth: '22%',
  },
  signalLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginBottom: 2 },
  signalVal: { fontSize: 15, fontWeight: '700', color: '#374151' },

  reviewWarning: {
    backgroundColor: '#fef9c3', borderRadius: 10, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#fde68a',
  },
  reviewWarningText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  rejectBanner: {
    backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#fecaca',
  },
  rejectBannerText: { fontSize: 13, color: '#991b1b', lineHeight: 18 },
  latencyNote: { fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 16 },
});
