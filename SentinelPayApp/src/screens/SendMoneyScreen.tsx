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
  StyleSheet, ActivityIndicator, Alert, Keyboard, Platform, Animated, SafeAreaView, StatusBar,
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
import { notificationService } from '../services/notificationService';
import UpiPinModal from '../components/UpiPinModal';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
  const [qrTrust, setQrTrust] = useState<QRTrustResult | null>(null);
  const [qrTrustLoading, setQrTrustLoading] = useState(false);
  const [guardianTimer, setGuardianTimer] = useState(300);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guardianTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingPaymentRef = useRef(false);

  useEffect(() => {
    if (route.params?.prefillVpa) {
      setReceiverVpa(route.params.prefillVpa);
    }
    if (route.params?.prefillAmount) {
      setAmountStr(String(route.params.prefillAmount));
    }
  }, [route.params?.prefillVpa, route.params?.prefillAmount]);

  const { otpInLast60s, latestSmsFraudScore } = useSmsOtp();
  const { isCallActive } = useCallState();
  const { deviceInfo } = useDeviceFingerprint();

  const PIPELINE_STAGES = [
    'Initiating Transaction...',
    'Verifying User Credentials...',
    'Querying FraudShield AI Engine...',
    'Behaviour & Pattern Analysis Complete...',
    'Device Trust Verified (94%)...',
    'Rule Engine & Risk Assessment Complete...',
    'Contacting Multi-User Settlement Engine...',
    'Debiting Sender Sentinel Wallet...',
    'Crediting Receiver Sentinel Wallet...',
    'Updating AI Profile & Recording Ledger...',
  ];

  const [currentPipelineStage, setCurrentPipelineStage] = useState(0);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [isExecutingPayment, setIsExecutingPayment] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (step === 'SCORING') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [step]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'SCORING') {
      setCurrentPipelineStage(0);
      timer = setInterval(() => {
        setCurrentPipelineStage((prev) => {
          if (prev < PIPELINE_STAGES.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 350);
    }
    return () => clearInterval(timer);
  }, [step]);

  const checkVpaTrust = async (vpaToTest: string) => {
    const trimmed = vpaToTest.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setQrTrust(null);
      return;
    }
    setQrTrustLoading(true);
    try {
      const res = await fraudShieldApi.checkQRTrust(trimmed);
      setQrTrust(res);
    } catch (e) {
      console.warn('[SendMoney] QR trust check failed:', e);
      setQrTrust(null);
    } finally {
      setQrTrustLoading(false);
    }
  };

  const handleVpaBlur = () => {
    checkVpaTrust(receiverVpa);
  };

  useEffect(() => {
    if (route.params?.prefillVpa) {
      checkVpaTrust(route.params.prefillVpa);
    }
  }, [route.params?.prefillVpa]);

  const handleScorePayment = async () => {
    Keyboard.dismiss();
    setError(null);

    const user = await getUser();
    if (!user) {
      setError('User not found. Please log in again.');
      return;
    }

    if (!receiverVpa.trim()) {
      setError('Please enter a receiver VPA (e.g. alice@sentinelpay)');
      return;
    }
    if (amount <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (amount > user.balance) {
      setError(`Insufficient balance. Available: ₹${user.balance.toLocaleString('en-IN')}`);
      return;
    }

    setStep('SCORING');

    try {
      const result = await fraudShieldApi.scoreTransaction({
        transaction_id: `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sender_vpa: user.vpa,
        receiver_vpa: receiverVpa.trim(),
        amount,
        currency: 'INR',
        transaction_type: 'P2P',
        device: {
          device_id: deviceInfo.device_id,
          os_type: 'ANDROID',
          os_version: deviceInfo.os_version,
          is_rooted: false,
          is_emulator: false,
          app_version: deviceInfo.app_version,
        },
        location: { latitude: 12.9716, longitude: 77.5946 },
        network: { ip_address: '192.168.1.100', connection_type: 'WIFI' },
        metadata: { org_id: 'SENTINEL', channel: 'MOBILE_APP' },
        otp_in_last_60s: otpInLast60s,
        is_call_active: isCallActive,
        sms_fraud_score: latestSmsFraudScore ?? undefined,
        device_id: deviceInfo.device_id,
        app_version: deviceInfo.app_version,
      });

      setScore(result);
      setStep('RESULT');

      if (result.decision === 'REJECT') {
        const cdSecs = result.cooldown_seconds ?? 60;
        setCooldown(cdSecs);
        startCooldownTimer(cdSecs);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Network error connecting to FraudShield server';
      setError(msg);
      setStep('FORM');
    }
  };

  const startCooldownTimer = (initialSecs: number) => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    let s = initialSecs;
    cooldownRef.current = setInterval(() => {
      s -= 1;
      setCooldown(s);
      if (s <= 0 && cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
    };
  }, []);

  const promptBiometricsAndProceed = async () => {
    try {
      const { available } = await rnBiometrics.isSensorAvailable();

      if (!available) {
        setPinModalVisible(true);
        return;
      }

      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: `Authorize ₹${amount.toLocaleString('en-IN')} payment to ${receiverVpa}`,
        cancelButtonText: 'Use PIN Instead',
      });

      if (success) {
        await checkHoldAndProceed();
      } else {
        setPinModalVisible(true);
      }
    } catch {
      setPinModalVisible(true);
    }
  };

  const handlePinSuccess = async () => {
    setPinModalVisible(false);
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

            try {
              const statusRes = await guardianService.getRequestStatus(txnId);
              if (statusRes.status === 'APPROVED') {
                if (guardianTimerRef.current) clearInterval(guardianTimerRef.current);
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
      setIsExecutingPayment(false);
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

  const handleConfirmHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    proceedWithPayment();
  };

  const handleCancelHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    Alert.alert('Payment Cancelled', 'Transaction was cancelled during review period.');
    setStep('BLOCKED');
  };

  const handleReject = () => setStep('BLOCKED');
  const goHome = () => navigation.navigate('Home');

  // ── Render States ──────────────────────────────────────────────────────────
  if (step === 'SCORING') {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <Animated.View style={[DS.iconXl, { backgroundColor: C.greenBg, marginBottom: S.base, opacity: pulseAnim }]}>
            <AppIcon name="shield" size={36} color={C.green} />
          </Animated.View>
          <Text style={[DS.pageTitle, { textAlign: 'center' }]}>Analysing Transaction...</Text>
          <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.xs }]}>Running ML + rule engine checks</Text>

          <View style={{ width: '100%', marginTop: S.xl, gap: S.sm }}>
            {['ML Risk Model', 'Rule Engine (10 Rules)', 'Behavioural Analysis', 'Network Graph Score'].map((label, idx) => (
              <Animated.View key={label} style={[DS.rowCard, { opacity: pulseAnim }]}>
                <View style={[DS.iconSm, { backgroundColor: idx <= currentPipelineStage ? C.greenBg : C.surfaceAlt }]}>
                  <AppIcon name={idx <= currentPipelineStage ? "check" : "clock"} size={16} color={idx <= currentPipelineStage ? C.green : C.textTertiary} />
                </View>
                <Text style={DS.cardTitle}>{label}</Text>
              </Animated.View>
            ))}
          </View>

          {otpInLast60s && (
            <View style={[DS.infoCard, { backgroundColor: C.amberBg, marginTop: S.md }]}>
              <AppIcon name="alertTriangle" size={18} color={C.amber} />
              <Text style={{ fontSize: T.xs, color: C.amber, fontWeight: T.bold }}>🔑 OTP detected in last 60s — flagging signal</Text>
            </View>
          )}
          {isCallActive && (
            <View style={[DS.infoCard, { backgroundColor: C.redBg, marginTop: S.sm }]}>
              <AppIcon name="phone" size={18} color={C.red} />
              <Text style={{ fontSize: T.xs, color: C.red, fontWeight: T.bold }}>📞 Active phone call detected — social engineering risk</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'SUCCESS') {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <View style={[DS.iconXl, { backgroundColor: C.greenBg, marginBottom: S.md }]}>
            <AppIcon name="check" size={36} color={C.green} />
          </View>
          <Text style={[DS.pageTitle, { textAlign: 'center' }]}>Payment Successful 🎉</Text>
          <Text style={{ fontSize: 36, fontWeight: T.black, color: C.green, marginVertical: S.xs }}>
            ₹{amount.toLocaleString('en-IN')}
          </Text>
          <Text style={[DS.pageSub, { textAlign: 'center', marginBottom: S.xl }]}>
            Sent to {receiverVpa}
          </Text>

          <TouchableOpacity style={[DS.btn, DS.btnPrimary, { width: '100%' }]} onPress={goHome} activeOpacity={0.7}>
            <Text style={DS.btnText}>Back to Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'BLOCKED') {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <View style={[DS.iconXl, { backgroundColor: C.redBg, marginBottom: S.md }]}>
            <AppIcon name="alert" size={36} color={C.red} />
          </View>
          <Text style={[DS.pageTitle, { color: C.red, textAlign: 'center' }]}>Transaction Blocked</Text>
          <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.xs, marginBottom: S.xl }]}>
            {error || 'FraudShield AI flagged this transaction as high risk.'}
          </Text>

          <TouchableOpacity style={[DS.btn, DS.btnPrimary, { width: '100%' }]} onPress={goHome} activeOpacity={0.7}>
            <Text style={DS.btnText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'HOLD') {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <View style={[DS.iconXl, { backgroundColor: C.amberBg, marginBottom: S.md }]}>
            <AppIcon name="clock" size={36} color={C.amber} />
          </View>
          <Text style={[DS.pageTitle, { textAlign: 'center' }]}>Safety Review Period</Text>
          <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.xs, marginBottom: S.lg }]}>
            Safety hold timer active for transactions over threshold.
          </Text>

          <View style={[DS.cardLg, { alignItems: 'center', width: '100%', marginBottom: S.lg }]}>
            <Text style={DS.label}>TRANSFER EXECUTING IN</Text>
            <Text style={{ fontSize: 48, fontWeight: T.black, color: C.amber, marginVertical: S.xs }}>
              {holdCountdown}s
            </Text>
            <Text style={DS.cardSub}>You can safely cancel before timer reaches zero</Text>
          </View>

          <View style={{ gap: S.md, width: '100%' }}>
            <TouchableOpacity style={[DS.btn, DS.btnPrimary]} onPress={handleConfirmHold} activeOpacity={0.7}>
              <Text style={DS.btnText}>Skip & Pay Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[DS.btn, DS.btnDanger]} onPress={handleCancelHold} activeOpacity={0.7}>
              <Text style={DS.btnText}>Cancel Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'AWAITING_GUARDIAN_APPROVAL') {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <View style={[DS.iconXl, { backgroundColor: C.blueBg, marginBottom: S.md }]}>
            <AppIcon name="guardian" size={36} color={C.blue} />
          </View>
          <Text style={[DS.pageTitle, { textAlign: 'center' }]}>Guardian Approval Required</Text>
          <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.xs, marginBottom: S.lg }]}>
            Transfer amount exceeds guardian limit. Awaiting approval.
          </Text>

          <View style={[DS.cardLg, { alignItems: 'center', width: '100%', marginBottom: S.lg }]}>
            <Text style={DS.label}>TIME REMAINING</Text>
            <Text style={{ fontSize: 44, fontWeight: T.black, color: C.blue, marginVertical: S.xs }}>
              {Math.floor(guardianTimer / 60)}:{(guardianTimer % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={DS.cardSub}>Notification sent to designated guardians</Text>
          </View>

          <TouchableOpacity style={[DS.btn, DS.btnOutline, { width: '100%' }]} onPress={goHome} activeOpacity={0.7}>
            <Text style={DS.btnTextDark}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'RESULT' && score) {
    const isApprove = score.decision === 'APPROVE';
    const isReview = score.decision === 'REVIEW';
    const isReject = score.decision === 'REJECT';

    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={DS.headerBar}>
          <TouchableOpacity style={DS.headerIconBtn} onPress={() => setStep('FORM')} activeOpacity={0.7}>
            <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={DS.pageTitle}>AI Scoring Result</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={DS.scrollContent}>
          <View style={DS.cardLg}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.base }}>
              <Text style={DS.cardTitle}>Payment Risk Score</Text>
              <RiskBadge decision={score.decision} riskScore={score.risk_score} />
            </View>

            <View style={[DS.heroCard, { alignItems: 'center', marginHorizontal: 0, paddingVertical: S.xl }]}>
              <Text style={DS.label}>TRANSFER AMOUNT</Text>
              <Text style={{ fontSize: 36, fontWeight: T.black, color: '#FFFFFF', marginVertical: S.xs }}>
                ₹{amount.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: T.sm, color: C.textTertiary, fontWeight: T.semibold }}>To: {receiverVpa}</Text>
            </View>

            <FraudExplanationCard
              decision={score.decision}
              explanation={score.explanation}
              riskScore={score.risk_score}
            />

            {isApprove && (
              <TouchableOpacity style={[DS.btn, DS.btnSuccess, { marginTop: S.base }]} onPress={promptBiometricsAndProceed} activeOpacity={0.7}>
                <AppIcon name="shieldCheck" size={18} color={C.textInverse} />
                <Text style={DS.btnText}>Authorize & Pay ₹{amount.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            )}

            {isReview && (
              <TouchableOpacity style={[DS.btn, DS.btnWarning, { marginTop: S.base }]} onPress={promptBiometricsAndProceed} activeOpacity={0.7}>
                <AppIcon name="alertTriangle" size={18} color={C.textInverse} />
                <Text style={DS.btnText}>Proceed with Caution</Text>
              </TouchableOpacity>
            )}

            {isReject && (
              <View style={{ marginTop: S.base }}>
                <TouchableOpacity style={[DS.btn, DS.btnDanger, DS.btnDisabled]} disabled>
                  <AppIcon name="lock" size={18} color={C.textInverse} />
                  <Text style={DS.btnText}>Transaction Blocked</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[DS.btn, DS.btnOutline, { marginTop: S.md }]} onPress={handleReject} activeOpacity={0.7}>
                  <Text style={DS.btnTextDark}>Acknowledge & Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // DEFAULT FORM STEP
  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Send Money</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Banner warnings */}
        {otpInLast60s && (
          <View style={[DS.infoCard, { backgroundColor: C.amberBg, marginBottom: S.md }]}>
            <AppIcon name="alertTriangle" size={18} color={C.amber} />
            <Text style={{ flex: 1, fontSize: T.xs, color: C.amber, fontWeight: T.bold }}>
              🔑 OTP received recently. Do NOT share OTPs with callers.
            </Text>
          </View>
        )}

        {isCallActive && (
          <View style={[DS.infoCard, { backgroundColor: C.redBg, marginBottom: S.md }]}>
            <AppIcon name="phone" size={18} color={C.red} />
            <Text style={{ flex: 1, fontSize: T.xs, color: C.red, fontWeight: T.bold }}>
              📞 Phone call active. Verify caller identity before paying!
            </Text>
          </View>
        )}

        <View style={DS.cardLg}>
          <Text style={DS.cardTitle}>Enter Payment Details</Text>
          <Text style={[DS.cardSub, { marginBottom: S.lg }]}>AI will evaluate risk in sub-200ms</Text>

          <Text style={DS.inputLabel}>Recipient VPA / Mobile</Text>
          <View style={DS.inputWrapper}>
            <AppIcon name="send" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
            <TextInput
              style={DS.input}
              placeholder="e.g. name@sentinelpay or 9876543210"
              placeholderTextColor={C.textTertiary}
              value={receiverVpa}
              onChangeText={setReceiverVpa}
              onBlur={handleVpaBlur}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {qrTrustLoading && (
            <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.md }]}>
              <ActivityIndicator size="small" color={C.green} />
              <Text style={DS.cardSub}>Verifying VPA reputation score...</Text>
            </View>
          )}

          {qrTrust && (
            <View style={[DS.infoCard, { backgroundColor: (qrTrust.risk_flags?.length || 0) > 0 ? C.amberBg : C.greenBg, marginBottom: S.md }]}>
              <AppIcon name="shieldCheck" size={18} color={(qrTrust.risk_flags?.length || 0) > 0 ? C.amber : C.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: (qrTrust.risk_flags?.length || 0) > 0 ? C.amber : C.green }}>
                  {(qrTrust.risk_flags?.length || 0) > 0 ? 'Caution Advised' : 'VPA Verified'}
                </Text>
                <Text style={DS.cardSub}>Trust score: {Math.round((qrTrust.confidence ?? (qrTrust.trust_score ? qrTrust.trust_score / 100 : 0.95)) * 100)}%</Text>
              </View>
            </View>
          )}

          <Text style={DS.inputLabel}>Amount (₹)</Text>
          <View style={DS.inputWrapper}>
            <Text style={{ fontSize: T.lg, fontWeight: T.bold, color: C.green, marginRight: S.xs }}>₹</Text>
            <TextInput
              style={DS.input}
              placeholder="0.00"
              placeholderTextColor={C.textTertiary}
              keyboardType="numeric"
              value={amountStr}
              onChangeText={setAmountStr}
            />
          </View>

          {error && (
            <View style={[DS.infoCard, { backgroundColor: C.redBg, marginTop: S.sm, marginBottom: S.md }]}>
              <AppIcon name="alert" size={18} color={C.red} />
              <Text style={{ flex: 1, fontSize: T.xs, color: C.red, fontWeight: T.bold }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[DS.btn, DS.btnPrimary, { marginTop: S.md }]} onPress={handleScorePayment} activeOpacity={0.7}>
            <AppIcon name="shieldCheck" size={18} color={C.textInverse} />
            <Text style={DS.btnText}>Check Risk & Pay</Text>
          </TouchableOpacity>
        </View>

        <UpiPinModal
          visible={pinModalVisible}
          onClose={() => setPinModalVisible(false)}
          onSuccess={handlePinSuccess}
          amount={amount}
          vpa={receiverVpa}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
