import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  Vibration,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import guardianService, { GuardianRelationship } from '../services/guardianService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GuardianVerification'>;
  route: RouteProp<RootStackParamList, 'GuardianVerification'>;
};

export default function GuardianVerificationScreen({ navigation, route }: Props) {
  const { relationshipId, guardianName, guardianPhone } = route.params || {};

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusState, setStatusState] = useState<'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ERROR' | 'EXPIRED'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [helpExpanded, setHelpExpanded] = useState<boolean>(false);
  const [relationship, setRelationship] = useState<GuardianRelationship | null>(null);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    // Page Entry Animation (Fade + Upward slide)
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    loadRelationshipDetails();
  }, [relationshipId]);

  const loadRelationshipDetails = async () => {
    try {
      const data = await guardianService.listGuardians();
      const match = data.guardians.find(g => g.id === relationshipId || g.guardian_phone === guardianPhone);
      if (match) {
        setRelationship(match);
      }
    } catch (e) {
      console.warn('Failed to load relationship details:', e);
    }
  };

  const triggerShake = () => {
    try { Vibration.vibrate(100); } catch {}
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitChange = (text: string, index: number) => {
    setStatusState('IDLE');
    setErrorMessage('');

    // Handle paste of full 6-digit code
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText.length >= 6) {
      const newDigits = cleanText.slice(0, 6).split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanText.slice(-1);
    setDigits(newDigits);

    // Auto-advance focus to next box
    if (cleanText && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullCode = digits.join('');

  const handleVerify = async () => {
    const targetRelId = relationshipId || relationship?.id;
    if (!targetRelId) {
      Alert.alert('Error', 'No active guardian invitation found.');
      return;
    }

    if (fullCode.length < 6) {
      setStatusState('ERROR');
      setErrorMessage('Please enter all 6 digits of the verification code.');
      triggerShake();
      return;
    }

    setLoading(true);
    setStatusState('VERIFYING');
    setErrorMessage('');

    try {
      const res = await guardianService.verifyGuardianCode(targetRelId, fullCode);
      if (res && res.success) {
        setStatusState('SUCCESS');
        setTimeout(() => {
          Alert.alert('Verification Successful! 🎉', 'Your guardian is now active and protecting your transactions.', [
            { text: 'OK', onPress: () => navigation.navigate('GuardianManagement') },
          ]);
        }, 300);
      }
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.detail || 'Invalid verification code. Please check with your guardian.';
      setStatusState('ERROR');
      setErrorMessage(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    Alert.alert(
      'Resend Code Request',
      'Ask your guardian to check their SentinelPay app. If needed, you can re-invite your guardian from the management screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Back to Guardians', onPress: () => navigation.navigate('GuardianManagement') },
      ]
    );
  };

  // ─── EMPTY STATE (No pending invitation found) ─────────────────────────────
  if (!relationshipId && !relationship) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={DS.headerBar}>
          <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
          </TouchableOpacity>
          <Text style={DS.pageTitle}>Guardian Verification</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[DS.scrollContent, { alignItems: 'center', justifyContent: 'center', paddingTop: 60 }]}>
          <View style={[styles.emptyShieldContainer, { backgroundColor: C.surfaceAlt }]}>
            <AppIcon name="shield" size={48} color={C.textTertiary} />
          </View>
          <Text style={[DS.cardTitle, { fontSize: T.xl, marginTop: S.base, textAlign: 'center' }]}>
            No Pending Verification Request
          </Text>
          <Text style={[DS.cardSub, { textAlign: 'center', marginTop: S.xs, paddingHorizontal: S.xl }]}>
            You do not have an active guardian invitation awaiting code verification.
          </Text>
          <TouchableOpacity
            style={[DS.card, { backgroundColor: C.dark, width: '100%', marginTop: S.xl, alignItems: 'center' }]}
            onPress={() => navigation.navigate('GuardianManagement')}
            activeOpacity={0.8}
          >
            <Text style={{ color: C.surface, fontWeight: T.bold, fontSize: T.md }}>Back to Guardians</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const name = guardianName || relationship?.guardian_name || 'Sentinel Guardian';
  const phone = guardianPhone || relationship?.guardian_phone || relationship?.guardian_vpa || 'Guardian Contact';

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Standard Child Screen Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: S.sm }}>
          <Text style={DS.pageTitle}>Guardian Verification</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Verify your Guardian to activate protection
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={DS.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* ─── 1. GUARDIAN SECURITY CARD (Hero styling) ─── */}
        <View style={styles.securityHeroCard}>
          <View style={styles.securityCardRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{(name[0] || 'G').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={styles.guardianNameText}>{name}</Text>
              <Text style={styles.guardianPhoneText}>{phone}</Text>
            </View>
          </View>

          <View style={styles.badgesRow}>
            <View style={styles.pendingBadge}>
              <View style={styles.statusDotPulse} />
              <Text style={styles.pendingBadgeText}>Pending Verification</Text>
            </View>
            <View style={styles.typeBadge}>
              <AppIcon name="shield" size={12} color="#A5B4FC" />
              <Text style={styles.typeBadgeText}>Guardian Protection</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. VERIFICATION CODE CARD ─── */}
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
            <AppIcon name="key" size={18} color={C.blue} />
            <Text style={[DS.cardTitle, { fontSize: T.lg }]}>Verification Code</Text>
          </View>
          <Text style={[DS.cardSub, { marginBottom: S.lg }]}>
            Enter the 6-digit code displayed on your Guardian's SentinelPay app under Guardian Requests.
          </Text>

          {/* ─── 6 INDIVIDUAL OTP BOXES ─── */}
          <Animated.View style={[styles.otpRowContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {digits.map((digit, index) => {
              const isFocused = focusedIndex === index;
              const hasError = statusState === 'ERROR';
              const isSuccess = statusState === 'SUCCESS';

              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFocused && styles.otpBoxFocused,
                    hasError && styles.otpBoxError,
                    isSuccess && styles.otpBoxSuccess,
                  ]}
                >
                  <TextInput
                    ref={(el) => (inputRefs.current[index] = el)}
                    style={styles.otpInputText}
                    value={digit}
                    onChangeText={(text) => handleDigitChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    autoFocus={index === 0}
                  />
                </View>
              );
            })}
          </Animated.View>

          {/* STATUS INFORMATION CARD */}
          {statusState !== 'IDLE' && (
            <View
              style={[
                DS.infoCard,
                { marginTop: S.lg },
                statusState === 'SUCCESS' && { backgroundColor: C.greenBg },
                statusState === 'ERROR' && { backgroundColor: C.redBg },
                statusState === 'VERIFYING' && { backgroundColor: C.blueBg },
              ]}
            >
              <AppIcon
                name={
                  statusState === 'SUCCESS' ? 'check' : statusState === 'ERROR' ? 'alert' : 'info'
                }
                size={18}
                color={
                  statusState === 'SUCCESS' ? C.green : statusState === 'ERROR' ? C.red : C.blue
                }
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: T.sm,
                  fontWeight: T.medium,
                  color:
                    statusState === 'SUCCESS' ? C.green : statusState === 'ERROR' ? C.red : C.blue,
                }}
              >
                {statusState === 'VERIFYING' && 'Validating verification code with SentinelPay security server...'}
                {statusState === 'SUCCESS' && 'Verification successful! Guardian protection activated.'}
                {statusState === 'ERROR' && (errorMessage || 'Invalid code. Please check with your guardian.')}
              </Text>
            </View>
          )}

          {/* ─── PRIMARY ACTION BUTTON ─── */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (fullCode.length < 6 || loading) && styles.btnDisabled,
              statusState === 'SUCCESS' && { backgroundColor: C.green },
            ]}
            onPress={handleVerify}
            disabled={fullCode.length < 6 || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <AppIcon name="shield" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {statusState === 'SUCCESS' ? 'Guardian Verified ✓' : 'Verify Guardian'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* SECONDARY ACTIONS */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Resend Code Request</Text>
            </TouchableOpacity>
            <Text style={{ color: C.textTertiary }}>•</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 3. EXPANDABLE HELP CARD ─── */}
        <TouchableOpacity
          style={DS.card}
          onPress={() => setHelpExpanded(!helpExpanded)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <AppIcon name="info" size={18} color={C.blue} />
              <Text style={[DS.cardTitle, { fontSize: T.body }]}>Where do I find the code?</Text>
            </View>
            <AppIcon name={helpExpanded ? 'chevronUp' : 'chevronDown'} size={18} color={C.textSecondary} />
          </View>

          {helpExpanded && (
            <View style={{ marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={[DS.cardSub, { lineHeight: 20 }]}>
                The 6-digit verification code is generated server-side and displayed inside your Guardian's SentinelPay app under <Text style={{ fontWeight: T.bold, color: C.dark }}>Guardian Requests → Wards</Text>.
              </Text>
              <Text style={[DS.cardSub, { lineHeight: 20, marginTop: S.xs }]}>
                Ask your guardian to open SentinelPay and share the code displayed on their screen with you.
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerSubtitle: {
    fontSize: T.xs,
    color: C.textSecondary,
    fontWeight: T.medium,
  },
  securityHeroCard: {
    backgroundColor: C.dark,
    borderRadius: R.card,
    padding: S.lg,
    marginBottom: S.base,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  securityCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: T.xxl,
    fontWeight: T.extrabold,
  },
  guardianNameText: {
    color: '#FFFFFF',
    fontSize: T.lg,
    fontWeight: T.bold,
  },
  guardianPhoneText: {
    color: '#94A3B8',
    fontSize: T.sm,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginTop: S.base,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    paddingHorizontal: S.sm,
    paddingVertical: 4,
    borderRadius: R.full,
    gap: 6,
  },
  statusDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  pendingBadgeText: {
    color: '#FBBF24',
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: S.sm,
    paddingVertical: 4,
    borderRadius: R.full,
    gap: 4,
  },
  typeBadgeText: {
    color: '#A5B4FC',
    fontSize: T.xs,
    fontWeight: T.semibold,
  },

  // 6 Individual OTP Boxes
  otpRowContainer: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginBottom: S.base,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justify: 'center',
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  otpBoxFocused: {
    borderColor: C.blue,
    backgroundColor: C.surface,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  otpBoxError: {
    borderColor: C.red,
    backgroundColor: C.redBg,
  },
  otpBoxSuccess: {
    borderColor: C.green,
    backgroundColor: C.greenBg,
  },
  otpInputText: {
    fontSize: T.xxl,
    fontWeight: T.black,
    color: C.dark,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    fontFamily: 'monospace',
  },

  // Buttons
  primaryBtn: {
    backgroundColor: C.dark,
    borderRadius: R.xl,
    paddingVertical: S.base,
    alignItems: 'center',
    justify: 'center',
    marginTop: S.lg,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: T.md,
    fontWeight: T.bold,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: S.md,
    marginTop: S.base,
  },
  secondaryText: {
    color: C.blue,
    fontSize: T.sm,
    fontWeight: T.semibold,
  },

  emptyShieldContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justify: 'center',
  },
});
