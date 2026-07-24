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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';
import AppIcon from '../components/AppIcon';

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

  /**
   * Step 1: Send OTP to Phone Number
   */
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

  /**
   * Step 2: Verify OTP and Login/Register
   */
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP code (e.g. 123456)');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.verifyOtp(phone, otp, sessionId, useMock, authMode, name, dob);
      
      if (result.success) {
        // Complete authentication and navigate directly to Home
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <AppIcon name="shield" size={32} color="#2D6A4F" />
          </View>
          <Text style={styles.title}>SentinelPay Wallet</Text>
          <Text style={styles.subtitle}>
            {authMode === 'login' ? 'Sign in to access your persistent wallet' : 'Create a new persistent SentinelPay account'}
          </Text>

          {/* ── Mode Switcher (Log In vs Sign Up) ── */}
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
          <View style={styles.form}>
            {authMode === 'signup' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Pranay Kadam"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1998-08-15"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numbers-and-punctuation"
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mobile Phone Number (Primary Key)</Text>
              <View style={styles.phoneInputWrapper}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="9876543210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, (!phone || loading) && styles.buttonDisabled]}
              onPress={handleProceedToOtp}
              disabled={!phone || loading}>
              {loading ? (
                <ActivityIndicator color="#FAF7F0" />
              ) : (
                <Text style={styles.buttonText}>
                  {authMode === 'login' ? 'Send Login OTP →' : 'Proceed to Verify OTP →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: OTP Entry */}
        {step === 'otp' && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Enter 6-Digit OTP Sent to +91 {phone}</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (!otp || loading) && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={!otp || loading}>
              {loading ? (
                <ActivityIndicator color="#FAF7F0" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP & Log In →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => setStep('details')}>
              <Text style={styles.backLinkText}>← Change Phone Number</Text>
            </TouchableOpacity>

            {useMock && (
              <View style={styles.mockInfo}>
                <AppIcon name="coin" size={16} color="#2D6A4F" />
                <Text style={styles.mockInfoText}>
                  Mock Mode Active - Use OTP: 123456
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8C4B8',
    width: '100%',
    maxWidth: 320,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#2D6A4F',
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#FAF7F0',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8C4B8',
    elevation: 2,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: '#E8C4B8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: '#E8C4B8',
    borderRadius: 14,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  otpInput: {
    backgroundColor: '#FAF7F0',
    borderWidth: 2,
    borderColor: '#2D6A4F',
    borderRadius: 16,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
    color: '#1A1A2E',
  },
  button: {
    backgroundColor: '#2D6A4F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FAF7F0',
    fontSize: 16,
    fontWeight: '800',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    color: '#2D6A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  mockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 12,
  },
  mockInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D6A4F',
  },
});
