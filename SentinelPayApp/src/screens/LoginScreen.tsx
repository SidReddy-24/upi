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
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const BIOMETRIC_PREF_KEY = 'biometric_login_enabled';

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Forgot Password modal state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotStage, setForgotStage] = useState<1 | 2>(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotDemoOtp, setForgotDemoOtp] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSendResetOtp = async () => {
    if (forgotPhone.trim().length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await authService.sendOtp(forgotPhone.trim(), 'PASSWORD_RESET');
      setForgotStage(2);
      if (res && res.data && res.data.otp_code) {
        setForgotDemoOtp(res.data.otp_code);
      }
      Alert.alert('OTP Sent', 'A verification OTP code has been generated for your mobile number.');
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Failed to send OTP for password reset.';
      Alert.alert('Reset Error', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    if (forgotOtp.trim().length !== 6) {
      Alert.alert('Validation Error', 'Please enter valid 6-digit OTP code');
      return;
    }
    if (forgotNewPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters long');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }

    setForgotLoading(true);
    try {
      await authService.resetPassword(forgotPhone.trim(), forgotOtp.trim(), forgotNewPassword);
      Alert.alert('Password Reset Successful', 'Your password has been reset securely. You can now log in with your new password.', [
        {
          text: 'OK',
          onPress: () => {
            setForgotModalVisible(false);
            setIdentifier(forgotPhone.trim());
            setPassword('');
          }
        }
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Password reset failed. Please check OTP and try again.';
      Alert.alert('Reset Failed', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    checkBiometricsSupport();
  }, []);

  const checkBiometricsSupport = async () => {
    try {
      // Check if user has previously set up biometric login preference
      const isEnabled = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
      setBiometricsEnabled(isEnabled === 'true');

      const loggedIn = await authService.isLoggedIn();
      if (loggedIn) {
        // Already logged in, check if we can autologin
        if (isEnabled === 'true') {
          handleBiometricLogin();
        } else {
          navigation.replace('Home');
        }
      }
    } catch (e) {
      console.warn('Biometric support check failed:', e);
    }
  };

  const handleBiometricLogin = async () => {
    const success = await authService.authenticateWithBiometrics();
    if (success) {
      setLoading(true);
      try {
        // Validate session is still active
        const profile = await authService.getMe();
        if (profile) {
          navigation.replace('Home');
        }
      } catch (e) {
        Alert.alert('Session Expired', 'Please enter your password to login.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Validation Error', 'Please enter your Mobile Number or Email VPA');
      return;
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter your Password');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(identifier.trim(), password);
      if (response && response.access_token) {
        // If biometric login is not set up, ask if they want to enable it
        const isBiometricSetup = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
        if (isBiometricSetup === null) {
          Alert.alert(
            'Enable Biometrics',
            'Would you like to enable fingerprint login for future sessions?',
            [
              {
                text: 'No',
                onPress: async () => {
                  await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, 'false');
                  navigation.replace('Home');
                },
                style: 'cancel',
              },
              {
                text: 'Yes',
                onPress: async () => {
                  await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, 'true');
                  navigation.replace('Home');
                },
              },
            ]
          );
        } else {
          navigation.replace('Home');
        }
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Invalid phone/email or password';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <AppIcon name="shield" size={54} color="#10B981" />
          <Text style={styles.title}>SentinelPay AI</Text>
          <Text style={styles.subtitle}>India's First AI-Native Secure Wallet</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <Text style={styles.label}>Mobile Number or VPA</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9999999901 or name@sentinelpay"
            placeholderTextColor="#94a3b8"
            value={identifier}
            onChangeText={setIdentifier}
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

          <TouchableOpacity
            style={{ alignSelf: 'flex-end', marginBottom: 16 }}
            onPress={() => {
              setForgotPhone(identifier);
              setForgotStage(1);
              setForgotOtp('');
              setForgotNewPassword('');
              setForgotConfirmPassword('');
              setForgotModalVisible(true);
            }}
          >
            <Text style={{ color: '#60A5FA', fontSize: 13, fontWeight: '600' }}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Secure Login</Text>
            )}
          </TouchableOpacity>

          {biometricsEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Text style={styles.biometricButtonText}>👉 Authenticate with Fingerprint</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footerContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={loading}>
            <Text style={styles.footerText}>
              New to SentinelPay? <Text style={styles.footerLink}>Create Secure Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FORGOT PASSWORD MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={forgotModalVisible}
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1E293B', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>Reset Password</Text>
              <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                <Text style={{ color: '#94A3B8', fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {forgotStage === 1 ? (
              <>
                <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 14 }}>
                  Enter your registered mobile phone number to receive a sandbox verification OTP code.
                </Text>
                <Text style={styles.label}>Registered Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 9999999901"
                  placeholderTextColor="#64748B"
                  value={forgotPhone}
                  onChangeText={setForgotPhone}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  style={[styles.loginButton, forgotLoading && styles.buttonDisabled, { marginTop: 12 }]}
                  onPress={handleSendResetOtp}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Send Reset OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {forgotDemoOtp ? (
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>📱 Sandbox OTP Code (Demo):</Text>
                    <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: 4 }}>{forgotDemoOtp}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>6-Digit Verification OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor="#64748B"
                  value={forgotOtp}
                  onChangeText={setForgotOtp}
                  keyboardType="numeric"
                  maxLength={6}
                />

                <Text style={styles.label}>New Password (min 8 chars)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  value={forgotNewPassword}
                  onChangeText={setForgotNewPassword}
                  secureTextEntry
                />

                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  value={forgotConfirmPassword}
                  onChangeText={setForgotConfirmPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.loginButton, forgotLoading && styles.buttonDisabled, { marginTop: 12 }]}
                  onPress={handleCompleteReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    backgroundColor: '#1e293b', // Slate 800
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
  loginButton: {
    backgroundColor: '#6366f1', // Indigo 500
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  biometricButton: {
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  biometricButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#818cf8',
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
