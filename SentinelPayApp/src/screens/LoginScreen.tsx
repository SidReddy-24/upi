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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { authService } from '../services/authService';

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
          <Text style={styles.logoEmoji}>🛡️</Text>
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
