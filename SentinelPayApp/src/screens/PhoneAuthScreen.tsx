/**
 * PhoneAuthScreen.tsx - Mandatory Registration & Persistent Login
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneAuth'>;

export default function PhoneAuthScreen({ navigation, route }: Props): React.JSX.Element {
  const useMock = route.params?.useMock ?? true;
  
  // Auth Mode: Signup vs Login
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('login');

  // Mandatory Registration Fields
  const [name, setName] = useState('Pranay Kadam');
  const [dob, setDob] = useState('1998-08-15');
  const [phone, setPhone] = useState('9876543210'); // Primary Key

  // Security & Auth Fields
  const [otp, setOtp] = useState('123456');

  const [sessionId, setSessionId] = useState('');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [loading, setLoading] = useState(false);

  const validatePhone = (phoneNumber: string): boolean => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phoneNumber.trim());
  };

  const handleProceedToOtp = async () => {
    if (authMode === 'signup') {
      if (!name.trim()) {
        Alert.alert('Missing Name', 'Please enter your full name');
        return;
      }
      if (!dob.trim()) {
        Alert.alert('Missing Date of Birth', 'Please enter your Date of Birth (YYYY-MM-DD)');
        return;
      }
    }

    if (!validatePhone(phone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.sendOtp(phone, useMock);
      
      if (result.success && result.sessionId) {
        setSessionId(result.sessionId);
        setStep('otp');
      } else {
        Alert.alert('Error', result.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('[PhoneAuth] Send OTP error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP code (e.g. 123456)');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.verifyOtp(phone, otp, sessionId, useMock, authMode, name, dob);
      
      if (result.success) {
        navigation.replace('Home');
      } else {
        Alert.alert(
          authMode === 'signup' ? 'Sign Up Failed' : 'Login Failed',
          result.error || 'Authentication failed. Please try again.'
        );
        setOtp('');
      }
    } catch (error) {
      console.error('[PhoneAuth] Verify OTP error:', error);
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={DS.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={DS.authBrand}>
            <View style={DS.authBrandIcon}>
              <AppIcon name="shield" size={28} color="#FFFFFF" />
            </View>
            <Text style={DS.authBrandTitle}>SentinelPay Wallet</Text>
            <Text style={DS.authBrandSub}>
              {authMode === 'login' ? 'SIGN IN TO YOUR ACCREDITED WALLET' : 'CREATE SECURE ACCOUNT'}
            </Text>

            {/* Mode Switcher */}
            {step === 'details' && (
              <View style={styles.modeToggleContainer}>
                <TouchableOpacity
                  style={[styles.modeTab, authMode === 'login' && styles.modeTabActive]}
                  onPress={() => setAuthMode('login')}>
                  <Text style={[styles.modeTabText, authMode === 'login' && styles.modeTabTextActive]}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeTab, authMode === 'signup' && styles.modeTabActive]}
                  onPress={() => setAuthMode('signup')}>
                  <Text style={[styles.modeTabText, authMode === 'signup' && styles.modeTabTextActive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* STEP 1: Phone Details Form */}
          {step === 'details' && (
            <View style={DS.cardLg}>
              {authMode === 'signup' && (
                <>
                  <Text style={DS.inputLabel}>Full Name</Text>
                  <View style={DS.inputWrapper}>
                    <AppIcon name="profile" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                    <TextInput
                      style={DS.input}
                      placeholder="Pranay Kadam"
                      placeholderTextColor={C.textTertiary}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <Text style={DS.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
                  <View style={DS.inputWrapper}>
                    <AppIcon name="history" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                    <TextInput
                      style={DS.input}
                      placeholder="1998-08-15"
                      placeholderTextColor={C.textTertiary}
                      keyboardType="numbers-and-punctuation"
                      value={dob}
                      onChangeText={setDob}
                    />
                  </View>
                </>
              )}

              <Text style={DS.inputLabel}>Mobile Phone Number (Primary Key)</Text>
              <View style={DS.inputWrapper}>
                <Text style={{ fontSize: T.body, fontWeight: T.bold, color: C.green, marginRight: S.sm }}>+91</Text>
                <TextInput
                  style={DS.input}
                  placeholder="9876543210"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[DS.btn, DS.btnPrimary, (!phone || loading) && DS.btnDisabled, { marginTop: S.md }]}
                onPress={handleProceedToOtp}
                disabled={!phone || loading}
                activeOpacity={0.7}>
                {loading ? (
                  <ActivityIndicator color={C.textInverse} />
                ) : (
                  <>
                    <AppIcon name="send" size={18} color={C.textInverse} />
                    <Text style={DS.btnText}>
                      {authMode === 'login' ? 'Send Login OTP' : 'Proceed to Verify OTP'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: OTP Entry */}
          {step === 'otp' && (
            <View style={DS.cardLg}>
              <Text style={DS.inputLabel}>Enter 6-Digit OTP Sent to +91 {phone}</Text>
              <TextInput
                style={[DS.inputStandalone, styles.otpInput]}
                placeholder="123456"
                placeholderTextColor={C.textTertiary}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[DS.btn, DS.btnPrimary, (!otp || loading) && DS.btnDisabled, { marginTop: S.md }]}
                onPress={handleVerifyOtp}
                disabled={!otp || loading}
                activeOpacity={0.7}>
                {loading ? (
                  <ActivityIndicator color={C.textInverse} />
                ) : (
                  <>
                    <AppIcon name="shieldCheck" size={18} color={C.textInverse} />
                    <Text style={DS.btnText}>Verify OTP & Log In</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[DS.btn, DS.btnOutline, { marginTop: S.md }]}
                onPress={() => setStep('details')}>
                <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
                <Text style={DS.btnTextDark}>Change Phone Number</Text>
              </TouchableOpacity>

              {useMock && (
                <View style={[DS.infoCard, { backgroundColor: C.greenBg, marginTop: S.base }]}>
                  <AppIcon name="info" size={18} color={C.green} />
                  <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.green }}>
                    Mock Mode Active - Use OTP: 123456
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: S.base,
    paddingBottom: S.xxl,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
    width: '100%',
    maxWidth: 320,
    marginTop: S.base,
  },
  modeTab: {
    flex: 1,
    paddingVertical: S.sm,
    alignItems: 'center',
    borderRadius: R.md,
  },
  modeTabActive: {
    backgroundColor: C.dark,
  },
  modeTabText: {
    fontSize: T.body,
    fontWeight: T.bold,
    color: C.textSecondary,
  },
  modeTabTextActive: {
    color: C.textInverse,
  },
  otpInput: {
    fontSize: T.xxl,
    letterSpacing: 8,
    textAlign: 'center',
  },
});
