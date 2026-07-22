import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  // Stage 1: Details, Stage 2: OTP
  const [stage, setStage] = useState<1 | 2>(1);
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [timer, setTimer] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stage === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stage, timer]);

  const validateEmail = (emailStr: string) => {
    return /\S+@\S+\.\S+/.test(emailStr);
  };

  const checkPasswordStrength = (pass: string) => {
    if (pass.length < 8) return false;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasDigit = /[0-9]/.test(pass);
    return hasUpperCase && hasLowerCase && hasDigit;
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your Full Name');
      return;
    }
    if (email.trim() && !validateEmail(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }
    if (!checkPasswordStrength(password)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters long, containing uppercase, lowercase, and numeric digits.'
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.sendOtp(cleanPhone, 'REGISTRATION');
      setStage(2);
      setTimer(300);
      Alert.alert(
        'OTP Sent Successfully',
        'A mock OTP has been generated. For testing, please check the FastAPI backend terminal console logs.'
      );
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to send OTP. Phone number may already be registered.';
      Alert.alert('OTP Request Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (otpCode.trim().length !== 6) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP first
      await authService.verifyOtp(phone.trim(), otpCode.trim(), 'REGISTRATION');
      
      // 2. Perform actual registration
      const response = await authService.register(
        phone.trim(),
        password,
        email.trim() || undefined,
        name.trim()
      );
      
      if (response && response.access_token) {
        Alert.alert('Registration Successful', 'Welcome to SentinelPay AI! Your unique VPA has been generated.', [
          {
            text: 'Let\'s Go',
            onPress: () => {
              navigation.replace('Home');
            },
          },
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'OTP verification or registration failed.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(timer / 60);
    const secs = timer % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Text style={styles.logoEmoji}>🔐</Text>
          <Text style={styles.title}>SentinelPay AI</Text>
          <Text style={styles.subtitle}>Onboarding & Device Registration</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {stage === 1 ? 'Create Account' : 'Verify Mobile Number'}
          </Text>

          {stage === 1 ? (
            <View>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />

              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9999999901"
                placeholderTextColor="#94a3b8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                autoCorrect={false}
              />

              <Text style={styles.label}>Email Address (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. rahul@example.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>PIN / Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.tipText}>
                ⚠️ Minimum 8 chars, 1 uppercase, 1 lowercase, 1 digit.
              </Text>

              <Text style={styles.label}>Confirm PIN / Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Register & Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.instructions}>
                We sent a 6-digit OTP code to <Text style={styles.bold}>{phone}</Text>. Enter the code below to verify your device identity.
              </Text>

              <Text style={styles.label}>OTP Verification Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="123456"
                placeholderTextColor="#94a3b8"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
              />

              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  OTP expires in: <Text style={styles.timerValue}>{formatTimer()}</Text>
                </Text>
                {timer === 0 && (
                  <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyAndRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Verify & Complete Setup</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStage(1)}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>← Edit Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.footerContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 54,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  eyeText: {
    fontSize: 20,
  },
  tipText: {
    fontSize: 12,
    color: '#e2e8f0',
    marginTop: -10,
    marginBottom: 14,
  },
  actionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  instructions: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  timerValue: {
    fontWeight: '700',
    color: '#f43f5e',
  },
  resendLink: {
    color: '#6366f1',
    fontWeight: '700',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  footerLink: {
    color: '#6366f1',
    fontWeight: '700',
  },
});
