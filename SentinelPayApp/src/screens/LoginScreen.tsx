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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';
import { formatApiError } from '../utils/errorUtils';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const BIOMETRIC_PREF_KEY = 'biometric_login_enabled';

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      const msg = formatApiError(e, 'Failed to send OTP for password reset.');
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
      const isEnabled = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
      setBiometricsEnabled(isEnabled === 'true');

      const loggedIn = await authService.isLoggedIn();
      if (loggedIn) {
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
      const msg = formatApiError(error, 'Invalid phone/email or password');
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={DS.screen}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={DS.authBrand}>
            <View style={DS.authBrandIcon}>
              <AppIcon name="shield" size={28} color="#FFFFFF" />
            </View>
            <Text style={DS.authBrandTitle}>SentinelPay</Text>
            <Text style={DS.authBrandSub}>AI CYBERSECURITY WALLET</Text>
          </View>

          <View style={DS.cardLg}>
            <Text style={DS.cardTitle}>Sign In</Text>
            <Text style={[DS.cardSub, { marginBottom: S.lg }]}>Enter your credentials to access your account</Text>

            <Text style={DS.inputLabel}>Mobile Number or VPA</Text>
            <View style={DS.inputWrapper}>
              <AppIcon name="profile" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
              <TextInput
                style={DS.input}
                placeholder="e.g. 9876543210 or name@sentinelpay"
                placeholderTextColor={C.textTertiary}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={DS.inputLabel}>PIN / Password</Text>
            <View style={DS.inputWrapper}>
              <AppIcon name="lock" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
              <TextInput
                style={DS.input}
                placeholder="••••••••"
                placeholderTextColor={C.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={{ padding: S.xs }}
                onPress={() => setShowPassword(!showPassword)}
              >
                <AppIcon name={showPassword ? "eyeOff" : "eye"} size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ alignSelf: 'flex-end', marginBottom: S.lg }}
              onPress={() => {
                setForgotPhone(identifier);
                setForgotStage(1);
                setForgotOtp('');
                setForgotNewPassword('');
                setForgotConfirmPassword('');
                setForgotModalVisible(true);
              }}
            >
              <Text style={DS.seeAll}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[DS.btn, DS.btnPrimary, loading && DS.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={C.textInverse} />
              ) : (
                <>
                  <AppIcon name="shieldCheck" size={18} color={C.textInverse} />
                  <Text style={DS.btnText}>Secure Login</Text>
                </>
              )}
            </TouchableOpacity>

            {biometricsEnabled && (
              <TouchableOpacity
                style={[DS.btn, DS.btnOutline, { marginTop: S.md }]}
                onPress={handleBiometricLogin}
                disabled={loading}
                activeOpacity={0.7}
              >
                <AppIcon name="fingerprint" size={20} color={C.green} />
                <Text style={DS.btnTextDark}>Authenticate with Biometrics</Text>
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
          <View style={DS.modalCenter}>
            <View style={DS.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
                <Text style={DS.cardTitle}>Reset Password</Text>
                <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                  <AppIcon name="close" size={20} color={C.textTertiary} />
                </TouchableOpacity>
              </View>

              {forgotStage === 1 ? (
                <>
                  <Text style={[DS.cardSub, { marginBottom: S.base }]}>
                    Enter your registered mobile phone number to receive a verification OTP code.
                  </Text>
                  <Text style={DS.inputLabel}>Registered Phone Number</Text>
                  <View style={DS.inputWrapper}>
                    <AppIcon name="phone" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                    <TextInput
                      style={DS.input}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor={C.textTertiary}
                      value={forgotPhone}
                      onChangeText={setForgotPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity
                    style={[DS.btn, DS.btnPrimary, forgotLoading && DS.btnDisabled, { marginTop: S.sm }]}
                    onPress={handleSendResetOtp}
                    disabled={forgotLoading}
                    activeOpacity={0.7}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color={C.textInverse} />
                    ) : (
                      <Text style={DS.btnText}>Send Reset OTP</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {forgotDemoOtp ? (
                    <View style={[DS.infoCard, { backgroundColor: C.greenBg, marginBottom: S.md }]}>
                      <AppIcon name="info" size={18} color={C.green} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.green, fontSize: T.xs, fontWeight: T.bold }}>Sandbox OTP Code (Demo):</Text>
                        <Text style={{ color: C.textPrimary, fontSize: T.xl, fontWeight: T.black, letterSpacing: 4 }}>{forgotDemoOtp}</Text>
                      </View>
                    </View>
                  ) : null}

                  <Text style={DS.inputLabel}>6-Digit Verification OTP</Text>
                  <TextInput
                    style={DS.inputStandalone}
                    placeholder="123456"
                    placeholderTextColor={C.textTertiary}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    keyboardType="numeric"
                    maxLength={6}
                  />

                  <Text style={DS.inputLabel}>New Password (min 8 chars)</Text>
                  <TextInput
                    style={DS.inputStandalone}
                    placeholder="••••••••"
                    placeholderTextColor={C.textTertiary}
                    value={forgotNewPassword}
                    onChangeText={setForgotNewPassword}
                    secureTextEntry
                  />

                  <Text style={DS.inputLabel}>Confirm New Password</Text>
                  <TextInput
                    style={DS.inputStandalone}
                    placeholder="••••••••"
                    placeholderTextColor={C.textTertiary}
                    value={forgotConfirmPassword}
                    onChangeText={setForgotConfirmPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[DS.btn, DS.btnPrimary, forgotLoading && DS.btnDisabled, { marginTop: S.sm }]}
                    onPress={handleCompleteReset}
                    disabled={forgotLoading}
                    activeOpacity={0.7}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color={C.textInverse} />
                    ) : (
                      <Text style={DS.btnText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: S.base,
    paddingBottom: S.xxl,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: S.base,
  },
  footerText: {
    fontSize: T.body,
    color: C.textSecondary,
  },
  footerLink: {
    color: C.blue,
    fontWeight: T.bold,
  },
});
