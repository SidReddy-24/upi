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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [stage, setStage] = useState<1 | 2>(1);
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [timer, setTimer] = useState(300);
  const [demoOtp, setDemoOtp] = useState('');

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
      Alert.alert('Validation Error', 'Please enter your Full Name (Given name & surname)');
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
      const res = await authService.sendOtp(cleanPhone, 'REGISTRATION');
      setStage(2);
      setTimer(300);
      if (res && res.data && res.data.otp_code) {
        setDemoOtp(res.data.otp_code);
      }
      Alert.alert(
        'OTP Sent Successfully',
        'We have generated a 6-digit sandbox verification OTP code for your mobile number.'
      );
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'This phone number is already registered.';
      Alert.alert('Registration Blocked', msg);
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
      await authService.verifyOtp(phone.trim(), otpCode.trim(), 'REGISTRATION');
      
      const response = await authService.register(
        phone.trim(),
        password,
        email.trim() || undefined,
        name.trim()
      );
      
      if (response && response.access_token) {
        const phoneDigits = phone.trim().replace(/\D/g, '').slice(-10);
        const autoVpa = `${phoneDigits}@sentinelpay`;

        Alert.alert(
          'Registration Successful 🎉',
          `Welcome to SentinelPay! Your account is created with unique UPI ID: ${autoVpa}.\n\nWould you like to enable biometric authentication (Fingerprint / Face ID) for faster future logins?`,
          [
            {
              text: 'Skip',
              onPress: async () => {
                await AsyncStorage.setItem('biometric_login_enabled', 'false');
                navigation.replace('Home');
              },
              style: 'cancel',
            },
            {
              text: 'Enable Biometrics',
              onPress: async () => {
                const bioSuccess = await authService.authenticateWithBiometrics();
                if (bioSuccess) {
                  await AsyncStorage.setItem('biometric_login_enabled', 'true');
                  Alert.alert('Biometrics Enabled', 'Biometric authentication configured successfully!');
                } else {
                  await AsyncStorage.setItem('biometric_login_enabled', 'false');
                }
                navigation.replace('Home');
              },
            },
          ]
        );
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
            <Text style={DS.authBrandSub}>ONBOARDING & DEVICE REGISTRATION</Text>
          </View>

          <View style={DS.cardLg}>
            <Text style={DS.cardTitle}>
              {stage === 1 ? 'Create Account' : 'Verify Mobile Number'}
            </Text>
            <Text style={[DS.cardSub, { marginBottom: S.lg }]}>
              {stage === 1 ? 'Join India\'s most secure AI cybersecurity wallet' : `Code sent to ${phone}`}
            </Text>

            {stage === 1 ? (
              <View>
                <Text style={DS.inputLabel}>Full Name</Text>
                <View style={DS.inputWrapper}>
                  <AppIcon name="profile" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                  <TextInput
                    style={DS.input}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor={C.textTertiary}
                    value={name}
                    onChangeText={setName}
                    autoCorrect={false}
                  />
                </View>

                <Text style={DS.inputLabel}>Mobile Number</Text>
                <View style={DS.inputWrapper}>
                  <AppIcon name="phone" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                  <TextInput
                    style={DS.input}
                    placeholder="e.g. 9999999901"
                    placeholderTextColor={C.textTertiary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    autoCorrect={false}
                  />
                </View>

                <Text style={DS.inputLabel}>Email Address (Optional)</Text>
                <View style={DS.inputWrapper}>
                  <AppIcon name="mail" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                  <TextInput
                    style={DS.input}
                    placeholder="e.g. rahul@example.com"
                    placeholderTextColor={C.textTertiary}
                    value={email}
                    onChangeText={setEmail}
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
                <Text style={styles.tipText}>
                  🛡️ Min 8 chars, 1 uppercase, 1 lowercase, 1 digit.
                </Text>

                <Text style={DS.inputLabel}>Confirm PIN / Password</Text>
                <View style={DS.inputWrapper}>
                  <AppIcon name="lock" size={18} color={C.textTertiary} style={{ marginRight: S.sm }} />
                  <TextInput
                    style={DS.input}
                    placeholder="••••••••"
                    placeholderTextColor={C.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[DS.btn, DS.btnPrimary, loading && DS.btnDisabled, { marginTop: S.sm }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color={C.textInverse} />
                  ) : (
                    <>
                      <AppIcon name="send" size={18} color={C.textInverse} />
                      <Text style={DS.btnText}>Register & Send OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={[DS.cardSub, { marginBottom: S.base }]}>
                  Enter the 6-digit verification code below to confirm your phone identity.
                </Text>

                {demoOtp ? (
                  <View style={[DS.infoCard, { backgroundColor: C.greenBg, marginBottom: S.lg }]}>
                    <AppIcon name="info" size={18} color={C.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.green, fontSize: T.xs, fontWeight: T.bold }}>SANDBOX OTP (DEMO KEY):</Text>
                      <Text style={{ color: C.textPrimary, fontSize: T.xl, fontWeight: T.black, letterSpacing: 4 }}>{demoOtp}</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={DS.inputLabel}>OTP Verification Code</Text>
                <TextInput
                  style={[DS.inputStandalone, styles.otpInput]}
                  placeholder="123456"
                  placeholderTextColor={C.textTertiary}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCorrect={false}
                />

                <View style={styles.timerContainer}>
                  <Text style={{ fontSize: T.sm, color: C.textSecondary }}>
                    Expires in: <Text style={{ fontWeight: T.bold, color: C.red }}>{formatTimer()}</Text>
                  </Text>
                  {timer === 0 && (
                    <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                      <Text style={DS.seeAll}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[DS.btn, DS.btnPrimary, loading && DS.btnDisabled]}
                  onPress={handleVerifyAndRegister}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color={C.textInverse} />
                  ) : (
                    <>
                      <AppIcon name="shieldCheck" size={18} color={C.textInverse} />
                      <Text style={DS.btnText}>Verify & Complete Setup</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[DS.btn, DS.btnOutline, { marginTop: S.md }]}
                  onPress={() => setStage(1)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
                  <Text style={DS.btnTextDark}>Edit Details</Text>
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
  tipText: {
    fontSize: T.xs,
    color: C.textSecondary,
    marginTop: -S.xs,
    marginBottom: S.md,
  },
  otpInput: {
    fontSize: T.xxl,
    letterSpacing: 8,
    textAlign: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
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
