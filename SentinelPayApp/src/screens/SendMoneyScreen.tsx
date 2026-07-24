/**
 * SendMoneyScreen — UPI payment form with real-time fraud scoring.
 *
 * Flow:
 *  1. User enters receiver VPA + amount
 *  2. VPA loses focus → calls /qr/trust/{vpa} (Phase 6.3) → shows trust badge
 *  3. Tap "Check & Pay" → calls FraudShield /score endpoint
 *     – Passes `otp_in_last_60s` flag (from SMS hook, Phase 4)
 *     – Passes `is_call_active` flag (from call hook, Phase 5)
 *  4. Decision = APPROVE → biometric prompt (Phase 7) → execute payment
 *  5. Decision = REVIEW  → call-active warning + biometric prompt → execute
 *  6. Decision = REJECT  → block, show reason, no payment
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Keyboard, Platform, Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ReactNativeBiometrics from 'react-native-biometrics';
import { RootStackParamList, FraudScore, WalletTransaction } from '../types';
import { getUser, executePayment, updateBalance, addTransaction } from '../utils/walletDb';
import fraudShieldApi, { QRTrustResult } from '../services/fraudShieldApi';
import RiskBadge from '../components/RiskBadge';
import FraudExplanationCard from '../components/FraudExplanationCard';
import { useSmsOtp } from '../hooks/useSmsOtp';
import { useCallState } from '../hooks/useCallState';
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint';
import { getSettings } from '../utils/settingsDb';
import guardianService from '../services/guardianService';
import UpiPinModal from '../components/UpiPinModal';
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SendMoney'>;
  route: RouteProp<RootStackParamList, 'SendMoney'>;
};

type Step = 'FORM' | 'SCORING' | 'RESULT' | 'HOLD' | 'SUCCESS' | 'BLOCKED' | 'AWAITING_GUARDIAN_APPROVAL';


function genTxnId() {
  return `TXN_SP_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

const rnBiometrics = new ReactNativeBiometrics();

export default function SendMoneyScreen({ navigation, route }: Props) {
  const [receiverVpa, setReceiverVpa] = useState(route.params?.prefillVpa ?? '');
  const [amountStr, setAmountStr] = useState(
    route.params?.prefillAmount ? String(route.params.prefillAmount) : '',
  );
  const [step, setStep] = useState<Step>('FORM');
  const [score, setScore] = useState<FraudScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [holdCountdown, setHoldCountdown] = useState(0);
  // Phase 6.3 — QR trust check
  const [qrTrust, setQrTrust] = useState<QRTrustResult | null>(null);
  const [qrTrustLoading, setQrTrustLoading] = useState(false);
  const [guardianTimer, setGuardianTimer] = useState(300);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guardianTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingPaymentRef = useRef(false);

  // ── Phase 4: SMS OTP detection ─────────────────────────────────────────────
  const { otpInLast60s, latestSmsFraudScore } = useSmsOtp();

  // ── Phase 5: Call detection ────────────────────────────────────────────────
  const { isCallActive } = useCallState();

  // ── Phase 7.2: Device fingerprinting ──────────────────────────────────────
  const { deviceInfo } = useDeviceFingerprint();

  // ── Phase 8.1.3: Skeleton pulse animation ─────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    if (step === 'SCORING') loop.start();
    else loop.stop();
    return () => {
      loop.stop();
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
      guardianService.cleanup();
    };
  }, [step, pulseAnim]);

  const amount = parseFloat(amountStr) || 0;
  const vpaValid = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/.test(receiverVpa.trim());
  const amountValid = amount > 0 && amount <= 200000;

  // ── Phase 6.3: QR trust check on VPA change ────────────────────────────────
  useEffect(() => {
    if (!vpaValid) {
      setQrTrust(null);
      return;
    }
    let cancelled = false;
    setQrTrustLoading(true);
    fraudShieldApi.getQrTrust(receiverVpa.trim())
      .then(result => { if (!cancelled) { setQrTrust(result); setQrTrustLoading(false); } })
      .catch(() => { if (!cancelled) { setQrTrust(null); setQrTrustLoading(false); } });
    return () => { cancelled = true; };
  }, [receiverVpa, vpaValid]);

  // ── Phase 9: Real-time Guardian approval response listener ───────────────
  useEffect(() => {
    if (step !== 'AWAITING_GUARDIAN_APPROVAL' || !score) return;

    guardianService.initialize();

    const unsubscribe = guardianService.subscribe((event) => {
      if (event.type === 'APPROVAL_RESPONSE' && event.data.transaction_id === score.transaction_id) {
        if (event.data.status === 'APPROVED') {
          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          Alert.alert(
            '✅ Guardian Approved',
            `Your payment was approved by ${event.data.guardian_name}. Note: ${event.data.note || 'None'}`,
            [{ text: 'Proceed', onPress: () => proceedWithPayment() }]
          );
        } else if (event.data.status === 'REJECTED') {
          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          Alert.alert(
            '❌ Guardian Rejected',
            `Your payment was rejected by ${event.data.guardian_name}. Note: ${event.data.note || 'None'}`
          );
          setStep('BLOCKED');
        }
      }
    });

    const statusPoll = setInterval(async () => {
      try {
        const statusRes = await guardianService.getRequestStatus(score.transaction_id);
        if (statusRes.status === 'APPROVED') {
          clearInterval(statusPoll);
          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          Alert.alert(
            '✅ Guardian Approved',
            `Your payment was approved by ${statusRes.guardian_name}. Note: ${statusRes.note || 'None'}`,
            [{ text: 'Proceed', onPress: () => proceedWithPayment() }]
          );
        } else if (statusRes.status === 'REJECTED') {
          clearInterval(statusPoll);
          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          Alert.alert(
            '❌ Guardian Rejected',
            `Your payment was rejected by ${statusRes.guardian_name}. Note: ${statusRes.note || 'None'}`
          );
          setStep('BLOCKED');
        } else if (statusRes.status === 'EXPIRED') {
          clearInterval(statusPoll);
          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          Alert.alert('⏳ Guardian Request Expired', 'The guardian approval request timed out (5 minutes). Payment cancelled.');
          setStep('BLOCKED');
        }
      } catch (e) {
        console.debug('Failed to poll status:', e);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(statusPoll);
      guardianService.cleanup();
    };
  }, [step, score]);

  // ── Phase 7: Biometric prompt ──────────────────────────────────────────────
  const requestBiometric = async (): Promise<boolean> => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      if (!available) {
        // No biometrics — fall through to payment
        return true;
      }
      const promptMessage =
        biometryType === 'FaceID'
          ? 'Look at your phone to confirm payment'
          : 'Confirm payment with fingerprint';
      const { success } = await rnBiometrics.simplePrompt({ promptMessage });
      return success;
    } catch (e) {
      console.warn('[Biometrics] Error:', e);
      // Biometric unavailable / cancelled → allow through for UX
      return true;
    }
  };

  // ── Step 1: Score the transaction ──────────────────────────────────────────
  const handleScore = async () => {
    if (!vpaValid)    return Alert.alert('Invalid VPA', 'Enter a valid VPA like name@bankname');
    if (!amountValid) return Alert.alert('Invalid Amount', 'Amount must be between ₹1 and ₹2,00,000');

    // Phase 5: Warn if on a call before even scoring
    if (isCallActive) {
      Alert.alert(
        '📞 You Are On A Call',
        'You appear to be on a phone call right now. Fraudsters often call victims while conducting transactions. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed Anyway', style: 'destructive', onPress: () => doScore() },
        ],
      );
      return;
    }

    doScore();
  };

  const doScore = async () => {
    Keyboard.dismiss();
    setStep('SCORING');
    setError(null);

    try {
      const user = await getUser();
      if (!user || amount > user.balance) {
        setError(user ? 'Insufficient SPC balance' : 'User not logged in');
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
        device: deviceInfo, // Phase 7.2 — real fingerprint
        location: { latitude: 19.076, longitude: 72.877 }, // Mumbai
        network: { ip_address: '10.0.2.2', connection_type: 'Wifi' },
        metadata: {
          org_id: 'ORG_DEMO_001',
          channel: 'mobile_app',
          // Phase 4 — OTP intelligence signal
          ...(otpInLast60s ? { otp_in_last_60s: true } : {}),
          ...(latestSmsFraudScore !== null ? { sms_fraud_score: latestSmsFraudScore } : {}),
          // Phase 5 — Call context signal
          ...(isCallActive ? { is_call_active: true } : {}),
        },
      });

      setScore(result);

      if (result.decision !== 'REJECT' && result.risk_score > 0.7) {
        // Check active guardians count
        let activeGuardiansCount = 0;
        try {
          const listRes = await guardianService.listGuardians();
          activeGuardiansCount = listRes.guardians.filter(g => g.status === 'ACTIVE').length;
        } catch (e) {
          console.warn('Failed to fetch guardians list:', e);
        }

        if (activeGuardiansCount > 0) {
          try {
            const reqRes = await guardianService.requestApproval({
              transaction_id: txnId,
              amount,
              recipient_vpa: receiverVpa.trim(),
              fraud_score: result.risk_score,
              risk_signals: result.signals.rule_flags,
            });

            if (reqRes && reqRes.success) {
              setStep('AWAITING_GUARDIAN_APPROVAL');
              setGuardianTimer(300);
              if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
              guardianTimerRef.current = setInterval(() => {
                setGuardianTimer(prev => {
                  if (prev <= 1) {
                    clearInterval(guardianTimerRef.current!);
                    Alert.alert('⏳ Guardian Request Expired', 'The guardian approval request timed out (5 minutes). Payment cancelled.');
                    setStep('BLOCKED');
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
              return;
            }
          } catch (reqErr: any) {
            Alert.alert('Guardian Error', reqErr.response?.data?.detail || 'Failed to request guardian approval.');
            setStep('FORM');
            return;
          }
        }
      }

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

  const [showUpiPinModal, setShowUpiPinModal] = useState(false);

  // ── Step 2: Direct payment execution without UPI PIN or biometric prompts ──
  const handleExecute = async () => {
    if (!score) return;
    await checkHoldAndProceed();
  };

  // Legacy fallback handler
  const handleUpiPinSuccess = async () => {
    setShowUpiPinModal(false);
    if (!score) return;
    await checkHoldAndProceed();
  };

  const checkHoldAndProceed = async () => {
    const settings = await getSettings();
    if (settings.holdEnabled && amount >= settings.holdThresholdAmount) {
      setStep('HOLD');
      setHoldCountdown(settings.holdDuration);
      
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);

      holdTimerRef.current = setInterval(() => {
        setHoldCountdown(prev => {
          if (prev <= 1) {
            clearInterval(holdTimerRef.current!);
            proceedWithPayment();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    await proceedWithPayment();
  };

  // ── Phase 9: Proceed with payment settlement ──────────────────────────────
  const proceedWithPayment = async () => {
    if (!score || isProcessingPaymentRef.current) return;
    isProcessingPaymentRef.current = true;

    try {
      const currentUser = await getUser();
      if (!currentUser) {
        Alert.alert('Error', 'User is not logged in');
        isProcessingPaymentRef.current = false;
        return;
      }

      // 🛡️ GUARDIAN APPROVAL THRESHOLD CHECK
      try {
        const gListRes = await guardianService.listGuardians();
        const activeGuardians = gListRes?.guardians?.filter(g => g.status === 'ACTIVE') ?? [];
        const gLimitRes = await guardianService.getGuardianLimit();
        const guardianLimit = gLimitRes?.limit ?? 5000;

        if (activeGuardians.length > 0 && amount > guardianLimit) {
          const txnId = score.transaction_id || `TXN_${Date.now()}`;
          await guardianService.requestApproval({
            transaction_id: txnId,
            amount,
            recipient_vpa: receiverVpa.trim(),
            fraud_score: score.risk_score ?? 0.1,
            risk_signals: score.signals?.rule_flags || score.explanation?.top_factors || [],
          });

          setStep('AWAITING_GUARDIAN_APPROVAL');
          setGuardianTimer(300);

          if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
          guardianTimerRef.current = setInterval(async () => {
            setGuardianTimer(prev => {
              if (prev <= 1) {
                if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
                setError('Guardian approval request timed out.');
                setStep('BLOCKED');
                isProcessingPaymentRef.current = false;
                return 0;
              }
              return prev - 1;
            });

            // Poll guardian approval status
            try {
              const statusRes = await guardianService.getRequestStatus(txnId);
              if (statusRes.status === 'APPROVED') {
                if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
                // Guardian Approved! Complete payment settlement
                await finalizeApprovedPayment(currentUser, txnId);
              } else if (statusRes.status === 'REJECTED') {
                if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
                setError('🚨 Transaction Blocked: Your guardian rejected this payment request.');
                setStep('BLOCKED');
                isProcessingPaymentRef.current = false;
              }
            } catch (err) {
              console.debug('Polling approval status note:', err);
            }
          }, 2000);

          return;
        }
      } catch (gErr) {
        console.warn('Guardian threshold check note:', gErr);
      }

      await finalizeApprovedPayment(currentUser, score.transaction_id || `TXN_${Date.now()}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Payment failed';
      setError(msg);
      setStep('BLOCKED');
    } finally {
      isProcessingPaymentRef.current = false;
    }
  };

  const finalizeApprovedPayment = async (currentUser: any, txnId: string) => {
    try {
      const transferRes = await fraudShieldApi.executeP2PTransfer({
        transaction_id: txnId,
        sender_vpa: currentUser.vpa,
        receiver_vpa: receiverVpa.trim(),
        amount,
        device_id: deviceInfo.device_id,
        is_call_active: isCallActive,
        otp_in_last_60s: otpInLast60s,
        sms_fraud_score: latestSmsFraudScore ?? undefined,
      });

      await updateBalance(transferRes.updated_sender_balance);

      // Record local transaction for history
      const newTxnRecord: WalletTransaction = {
        id: transferRes.transaction_id || txnId,
        sender_vpa: currentUser.vpa,
        receiver_vpa: receiverVpa.trim(),
        amount,
        type: 'DEBIT',
        status: score?.decision === 'APPROVE' ? 'APPROVED' : 'REVIEW',
        risk_score: score?.risk_score ?? 0.0,
        decision: score?.decision ?? 'APPROVE',
        fraud_reason: score?.explanation?.summary ?? null,
        created_at: new Date().toISOString(),
      };
      await addTransaction(newTxnRecord);

      // Send SMS notification
      const settings = await getSettings();
      if (settings.smsNotificationsEnabled) {
        try {
          await fraudShieldApi.sendTransactionNotification({
            transaction_id: transferRes.transaction_id || txnId,
            sender_vpa: currentUser.vpa,
            receiver_vpa: receiverVpa.trim(),
            amount,
            status: score?.decision || 'APPROVE',
            risk_score: score?.risk_score || 0.0,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[SMS] Failed to send notification:', e);
        }
      }

      setStep('SUCCESS');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Payment failed';
      setError(msg);
      setStep('BLOCKED');
    }
  };

  // ── Phase 9: Confirm during hold period ────────────────────────────────────
  const handleConfirmHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    proceedWithPayment();
  };

  // ── Phase 9: Cancel during hold period ─────────────────────────────────────
  const handleCancelHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    Alert.alert('Payment Cancelled', 'Transaction was cancelled during review period.');
    setStep('BLOCKED');
  };

  const handleReject = () => setStep('BLOCKED');
  const goHome = () => navigation.navigate('Home');

  // ─── Render ────────────────────────────────────────────────────────────────
  // ── Phase 8.1.3: Skeleton loading state ───────────────────────────────────
  if (step === 'SCORING') {
    return (
      <View style={styles.centeredState}>
        <Animated.View style={[styles.skeletonIcon, { opacity: pulseAnim }]}>
          <AppIcon name="shield" size={44} color="#10B981" />
        </Animated.View>
        <Text style={styles.scoringTitle}>Analysing transaction…</Text>
        <Text style={styles.scoringSubtitle}>Running ML + rule engine checks</Text>
        {/* Skeleton bars */}
        <View style={styles.skeletonBars}>
          {['ML Model', 'Rule Engine', 'Behaviour', 'Graph'].map(label => (
            <Animated.View key={label} style={[styles.skeletonRow, { opacity: pulseAnim }]}>
              <Text style={styles.skeletonLabel}>{label}</Text>
              <View style={styles.skeletonBar} />
            </Animated.View>
          ))}
        </View>
        {otpInLast60s && (
          <View style={styles.otpBadge}>
            <Text style={styles.otpBadgeText}>🔑 OTP detected — flagging signal</Text>
          </View>
        )}
        {isCallActive && (
          <View style={styles.callBadge}>
            <Text style={styles.callBadgeText}>📞 Call active — flagging signal</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Phase 9: HOLD state (transaction review period) ───────────────────────
  if (step === 'HOLD') {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.bigEmoji}>⏱️</Text>
        <Text style={styles.holdTitle}>Transaction on Hold</Text>
        <Text style={styles.holdSubtitle}>Review your payment carefully</Text>

        <View style={styles.holdCountdownBox}>
          <Text style={styles.holdCountdownLabel}>Time Remaining</Text>
          <Text style={styles.holdCountdown}>{holdCountdown}s</Text>
          <Text style={styles.holdCountdownHint}>Auto-cancel in {holdCountdown} seconds</Text>
        </View>

        <View style={styles.holdDetailsCard}>
          <Text style={styles.holdDetailsTitle}>Transaction Details</Text>
          
          <View style={styles.holdDetailRow}>
            <Text style={styles.holdDetailLabel}>Amount</Text>
            <Text style={styles.holdDetailValue}>₹{amount.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.holdDetailRow}>
            <Text style={styles.holdDetailLabel}>To</Text>
            <Text style={styles.holdDetailValue}>{receiverVpa.trim()}</Text>
          </View>

          {score && (
            <>
              <View style={styles.holdDetailRow}>
                <Text style={styles.holdDetailLabel}>Fraud Score</Text>
                <Text style={styles.holdDetailValue}>{Math.round(score.risk_score * 100)}%</Text>
              </View>

              <View style={styles.holdDetailRow}>
                <Text style={styles.holdDetailLabel}>Decision</Text>
                <View>
                  <RiskBadge decision={score.decision} riskScore={score.risk_score} />
                </View>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.holdConfirmBtn} onPress={handleConfirmHold}>
          <Text style={styles.holdConfirmBtnText}>✓ Confirm Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.holdCancelBtn} onPress={handleCancelHold}>
          <Text style={styles.holdCancelBtnText}>✗ Cancel Payment</Text>
        </TouchableOpacity>

        <Text style={styles.holdWarning}>
          ⚠️ If you don't take action, this payment will be automatically cancelled.
        </Text>
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

  if (step === 'AWAITING_GUARDIAN_APPROVAL') {
    const mins = Math.floor(guardianTimer / 60);
    const secs = guardianTimer % 60;
    const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return (
      <View style={styles.centeredState}>
        <View style={styles.guardianIconContainer}>
          <AppIcon name="shield" size={48} color="#10B981" />
        </View>
        <Text style={styles.holdTitle}>Guardian Review Required</Text>
        <Text style={styles.holdSubtitle}>
          This transaction has a high risk score of {score ? (score.risk_score * 100).toFixed(0) : 0}%. We have notified your active guardians to verify and approve this payment.
        </Text>

        <View style={styles.guardianCountdownCard}>
          <Text style={styles.countdownLabel}>REMAINING TIME TO APPROVE</Text>
          <Text style={styles.countdownTime}>{formattedTime}</Text>
        </View>

        <Text style={styles.pollingStatusText}>🔍 Listening for guardian response in real-time...</Text>

        <TouchableOpacity
          style={styles.holdCancelBtn}
          onPress={() => {
            if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
            Alert.alert('Payment Cancelled', 'You cancelled the transaction.');
            setStep('FORM');
          }}
        >
          <Text style={styles.holdCancelBtnText}>Cancel Payment</Text>
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

      {/* ── ACTIVE CALL WARNING (Phase 5) ── */}
      {isCallActive && (
        <View style={styles.callWarningBanner}>
          <Text style={styles.callWarningText}>
            📞 You are currently on a phone call. Scammers often impersonate bank officials during transactions. Stay alert!
          </Text>
        </View>
      )}

      {/* ── OTP RECENTLY RECEIVED WARNING (Phase 4) ── */}
      {otpInLast60s && (
        <View style={styles.otpWarningBanner}>
          <Text style={styles.otpWarningText}>
            🔑 OTP received recently. Never share OTPs with anyone. This signal is being passed to FraudShield AI.
          </Text>
        </View>
      )}

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

          {/* Phase 6.3 — VPA Trust Badge */}
          {qrTrustLoading && vpaValid && (
            <View style={styles.trustBadgeLoading}>
              <Text style={styles.trustBadgeLoadingText}>Checking VPA trust…</Text>
            </View>
          )}
          {!qrTrustLoading && qrTrust && (
            <View style={[
              styles.trustBadge,
              qrTrust.trust_level === 'VERIFIED'  && styles.trustVerified,
              qrTrust.trust_level === 'CAUTION'   && styles.trustCaution,
              qrTrust.trust_level === 'FLAGGED'   && styles.trustFlagged,
            ]}>
              <Text style={styles.trustBadgeText}>{qrTrust.message}</Text>
              {qrTrust.flags.length > 0 && (
                <Text style={styles.trustBadgeFlags}>Flags: {qrTrust.flags.join(', ')}</Text>
              )}
            </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="shield" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Check & Pay</Text>
            </View>
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

          {/* Phase 4/5: Context signals display */}
          {(otpInLast60s || isCallActive) && (
            <View style={styles.signalBanners}>
              {otpInLast60s && (
                <View style={styles.signalChipAlert}>
                  <Text style={styles.signalChipAlertText}>🔑 OTP received in last 60s</Text>
                </View>
              )}
              {isCallActive && (
                <View style={styles.signalChipAlert}>
                  <Text style={styles.signalChipAlertText}>📞 Call active during payment</Text>
                </View>
              )}
            </View>
          )}

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
              <Text style={styles.approveBtnText}>🔒 Confirm Payment</Text>
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
                  {cooldown > 0 ? `Wait ${cooldown}s to confirm…` : '🔒 Proceed Anyway'}
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

      {/* UPI PIN Modal */}
      <UpiPinModal
        visible={showUpiPinModal}
        amount={amount}
        receiverVpa={receiverVpa.trim()}
        onSuccess={handleUpiPinSuccess}
        onCancel={() => setShowUpiPinModal(false)}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F3EA' },

  simulatedBanner: {
    backgroundColor: '#E5DCCB', paddingVertical: 8,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DCD1BF',
  },
  simulatedText: { fontSize: 12, fontWeight: '700', color: '#236847' },

  // Phase 5 call warning
  callWarningBanner: {
    backgroundColor: 'rgba(192, 57, 43, 0.1)', borderLeftWidth: 4, borderLeftColor: '#C0392B',
    marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 12,
  },
  callWarningText: { fontSize: 13, color: '#C0392B', lineHeight: 19, fontWeight: '600' },

  // Phase 4 OTP warning
  otpWarningBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    marginHorizontal: 16, marginTop: 8, borderRadius: 10, padding: 12,
  },
  otpWarningText: { fontSize: 13, color: '#B45309', lineHeight: 19, fontWeight: '600' },

  centeredState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 80,
  },
  bigEmoji: { fontSize: 64, marginBottom: 16 },
  scoringTitle: { fontSize: 18, fontWeight: '800', color: '#181818', marginTop: 16 },
  scoringSubtitle: { fontSize: 14, color: '#666666', marginTop: 6 },

  // Phase 8.1.3 — Skeleton loading
  skeletonIcon: { marginBottom: 8 },
  skeletonBars: { width: '100%', marginTop: 20, gap: 10 },
  skeletonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EFE7DA', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#DCD1BF',
  },
  skeletonLabel: { fontSize: 12, fontWeight: '600', color: '#666666', width: 80 },
  skeletonBar: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: '#DCD1BF', marginLeft: 12,
  },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#181818', marginBottom: 4 },
  successAmount: { fontSize: 32, fontWeight: '900', color: '#2E8B57' },
  successTo: { fontSize: 15, color: '#666666', marginBottom: 16 },
  blockedTitle: { fontSize: 24, fontWeight: '900', color: '#C0392B', marginBottom: 8 },
  blockedReason: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 16 },

  // Scoring state pills
  otpBadge: {
    marginTop: 12, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#F59E0B',
  },
  otpBadgeText: { fontSize: 12, color: '#B45309', fontWeight: '600' },
  callBadge: {
    marginTop: 8, backgroundColor: 'rgba(192, 57, 43, 0.1)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#C0392B',
  },
  callBadgeText: { fontSize: 12, color: '#C0392B', fontWeight: '600' },

  formCard: {
    backgroundColor: '#EFE7DA', margin: 16, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: '#DCD1BF', elevation: 2,
  },
  formTitle: { fontSize: 22, fontWeight: '900', color: '#181818', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '800', color: '#666666', marginBottom: 6, marginTop: 12, letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: '#DCD1BF', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#181818', backgroundColor: '#F7F3EA',
  },
  fieldError: { fontSize: 12, color: '#C0392B', marginTop: 4 },
  apiError: {
    fontSize: 13, color: '#C0392B', backgroundColor: 'rgba(192, 57, 43, 0.1)',
    borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#C0392B',
  },
  hint: { fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 12 },

  primaryBtn: {
    backgroundColor: '#2E8B57', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.45 },
  secondaryBtn: {
    backgroundColor: '#E5DCCB', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#DCD1BF',
  },
  secondaryBtnText: { color: '#181818', fontSize: 16, fontWeight: '700' },
  approveBtn: {
    backgroundColor: '#2E8B57', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  reviewBtn: {
    backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  cancelBtn: {
    backgroundColor: '#E5DCCB', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#DCD1BF',
  },
  cancelBtnText: { color: '#181818', fontSize: 15, fontWeight: '700' },

  resultCard: {
    backgroundColor: '#EFE7DA', margin: 16, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: '#DCD1BF', elevation: 2,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#181818' },
  txnSummaryBox: {
    backgroundColor: '#F7F3EA', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: '#DCD1BF',
  },
  txnSummaryAmount: { fontSize: 28, fontWeight: '900', color: '#181818' },
  txnSummaryTo: { fontSize: 14, color: '#666666', marginTop: 2 },

  // Phase 4/5 signal banner in result card
  signalBanners: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  signalChipAlert: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: '#F59E0B',
    borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8,
  },
  signalChipAlertText: { fontSize: 11, color: '#B45309', fontWeight: '700' },

  signalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  signalChip: {
    backgroundColor: '#F7F3EA', borderRadius: 10, padding: 10,
    alignItems: 'center', minWidth: '22%', borderWidth: 1, borderColor: '#DCD1BF',
  },
  signalLabel: { fontSize: 10, color: '#666666', fontWeight: '700', marginBottom: 2 },
  signalVal: { fontSize: 15, fontWeight: '800', color: '#181818' },

  reviewWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  reviewWarningText: { fontSize: 13, color: '#B45309', lineHeight: 18, fontWeight: '600' },
  rejectBanner: {
    backgroundColor: 'rgba(192, 57, 43, 0.1)', borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#C0392B',
  },
  rejectBannerText: { fontSize: 13, color: '#C0392B', lineHeight: 18, fontWeight: '600' },
  latencyNote: { fontSize: 11, color: '#666666', textAlign: 'center', marginTop: 16 },

  // Phase 6.3 — QR trust badge styles
  trustBadgeLoading: {
    marginTop: 8, padding: 8, borderRadius: 10,
    backgroundColor: '#F7F3EA', alignItems: 'center', borderWidth: 1, borderColor: '#DCD1BF',
  },
  trustBadgeLoadingText: { fontSize: 12, color: '#666666' },
  trustBadge: {
    marginTop: 8, padding: 10, borderRadius: 10,
    borderWidth: 1,
  },
  trustVerified: { backgroundColor: 'rgba(46, 139, 87, 0.1)', borderColor: '#2E8B57' },
  trustCaution:  { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: '#F59E0B' },
  trustFlagged:  { backgroundColor: 'rgba(192, 57, 43, 0.1)', borderColor: '#C0392B' },
  trustBadgeText: { fontSize: 13, fontWeight: '700', color: '#181818' },
  trustBadgeFlags: { fontSize: 11, color: '#666666', marginTop: 2 },

  // Phase 9 — Transaction Hold styles
  holdTitle: { fontSize: 24, fontWeight: '900', color: '#181818', marginTop: 12 },
  holdSubtitle: { fontSize: 14, color: '#666666', marginTop: 4, marginBottom: 20 },
  holdCountdownBox: {
    backgroundColor: '#EFE7DA', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#2E8B57', width: '100%',
  },
  holdCountdownLabel: { fontSize: 12, fontWeight: '800', color: '#2E8B57', textTransform: 'uppercase', letterSpacing: 1 },
  holdCountdown: { fontSize: 48, fontWeight: '900', color: '#236847', marginVertical: 8 },
  holdCountdownHint: { fontSize: 11, color: '#666666' },
  holdDetailsCard: {
    backgroundColor: '#F7F3EA', borderRadius: 14, padding: 16, width: '100%',
    marginBottom: 16, borderWidth: 1, borderColor: '#DCD1BF',
  },
  holdDetailsTitle: { fontSize: 14, fontWeight: '800', color: '#181818', marginBottom: 12, textAlign: 'center' },
  holdDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DCD1BF',
  },
  holdDetailLabel: { fontSize: 13, color: '#666666', fontWeight: '600' },
  holdDetailValue: { fontSize: 13, color: '#181818', fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: 12 },
  holdConfirmBtn: {
    backgroundColor: '#2E8B57', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', width: '100%', marginBottom: 10,
  },
  holdConfirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  holdCancelBtn: {
    backgroundColor: '#E5DCCB', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#DCD1BF',
  },
  holdCancelBtnText: { color: '#181818', fontSize: 16, fontWeight: '700' },
  holdWarning: {
    fontSize: 11, color: '#666666', textAlign: 'center', marginTop: 16,
    paddingHorizontal: 20, lineHeight: 16,
  },
  // Guardian approval styles
  guardianIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(46, 139, 87, 0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 2, borderColor: '#2E8B57',
  },
  guardianCountdownCard: {
    backgroundColor: '#EFE7DA', borderRadius: 16, padding: 20,
    alignItems: 'center', marginVertical: 24, borderWidth: 1, borderColor: '#DCD1BF',
    width: '100%',
  },
  countdownLabel: { fontSize: 11, fontWeight: '800', color: '#2E8B57', textTransform: 'uppercase', letterSpacing: 1 },
  countdownTime: { fontSize: 44, fontWeight: '900', color: '#C0392B', marginVertical: 6 },
  pollingStatusText: { fontSize: 13, color: '#666666', fontStyle: 'italic', marginBottom: 30 },
});
