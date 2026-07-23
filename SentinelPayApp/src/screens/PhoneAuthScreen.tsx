/**
 * PhoneAuthScreen.tsx - Phone number + OTP authentication
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

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneAuth'>;

export default function PhoneAuthScreen({ navigation, route }: Props): React.JSX.Element {
  const useMock = route.params?.useMock ?? true;
  
  const [phone, setPhone] = useState('9876543210');

  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  /**
   * Validate phone number
   */
  const validatePhone = (phoneNumber: string): boolean => {
    // Indian phone number: 10 digits
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  };

  /**
   * Send OTP to phone number
   */
  const handleSendOtp = async () => {
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
   * Verify OTP and login
   */
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.verifyOtp(phone, otp, sessionId, useMock);
      
      if (result.success) {
        navigation.replace('Home');
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid OTP. Please try again.');
        setOtp('');
      }

    } catch (error) {
      console.error('[PhoneAuth] Verify OTP error:', error);
      Alert.alert('Error', 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Change phone number (go back to phone step)
   */
  const handleChangePhone = () => {
    setStep('phone');
    setOtp('');
    setSessionId('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>📱</Text>
          <Text style={styles.title}>
            {step === 'phone' ? 'Enter Your Phone Number' : 'Verify OTP'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'We will send you a one-time password'
              : `Enter the 6-digit code sent to ${phone}`}
          </Text>
        </View>

        {/* Phone Number Entry */}
        {step === 'phone' && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
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
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, (!phone || loading) && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={!phone || loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            {useMock && (
              <View style={styles.mockInfo}>
                <Text style={styles.mockInfoIcon}>🧪</Text>
                <Text style={styles.mockInfoText}>
                  Mock Mode Active - Use OTP: 123456
                </Text>
              </View>
            )}
          </View>
        )}

        {/* OTP Entry */}
        {step === 'otp' && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Enter OTP</Text>
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleChangePhone}
              disabled={loading}>
              <Text style={styles.secondaryButtonText}>← Change Phone Number</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleSendOtp}
              disabled={loading}>
              <Text style={styles.resendButtonText}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Your phone number is encrypted and stored securely
          </Text>
        </View>

        {/* Back to Mode Selector */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('AuthModeSelector')}
          disabled={loading}>
          <Text style={styles.backButtonText}>← Back to Login Options</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#f8fafc',
  },
  otpInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    fontSize: 24,
    color: '#f8fafc',
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#818cf8',
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
  mockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  mockInfoIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  mockInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  securityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
