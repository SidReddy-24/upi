/**
 * PinLoginScreen.tsx - Login with PIN
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'PinLogin'>;

export default function PinLoginScreen({ navigation }: Props): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  /**
   * Check if biometric is available and enabled
   */
  const checkBiometric = async () => {
    const available = await unifiedAuthService.isBiometricAvailable();
    setBiometricAvailable(available);

    if (available) {
      const user = await unifiedAuthService.getCurrentUser();
      setBiometricEnabled(user?.biometricEnabled || false);

      // Auto-trigger biometric if enabled
      if (user?.biometricEnabled) {
        handleBiometricLogin();
      }
    }
  };

  /**
   * Handle biometric login
   */
  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await unifiedAuthService.authenticateWithBiometric();
      
      if (result.success) {
        navigation.replace('Home');
      } else {
        // Failed, let user enter PIN
        console.log('[PinLogin] Biometric failed, use PIN');
      }
    } catch (error) {
      console.error('[PinLogin] Biometric error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle PIN login
   */
  const handlePinLogin = async () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Invalid PIN', 'Please enter your PIN');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.verifyPin(pin);
      
      if (result.success) {
        navigation.replace('Home');
      } else {
        Alert.alert('Incorrect PIN', result.error || 'Please try again');
        setPin('');
      }
    } catch (error) {
      console.error('[PinLogin] Error:', error);
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🔐</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Enter your PIN to continue</Text>
        </View>

        {/* PIN Entry */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.pinInput}
              placeholder="••••"
              keyboardType="number-pad"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              maxLength={6}
              autoFocus={!biometricEnabled}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, (!pin || loading) && styles.buttonDisabled]}
            onPress={handlePinLogin}
            disabled={!pin || loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Unlock</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Option */}
          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}>
              <Text style={styles.biometricIcon}>👆</Text>
              <Text style={styles.biometricText}>Use Fingerprint/Face ID</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Back to Mode Selector */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('AuthModeSelector')}>
          <Text style={styles.backButtonText}>← Use Different Login Method</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  pinInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    color: '#1f2937',
    letterSpacing: 12,
    textAlign: 'center',
    width: 200,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: '#fff',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 12,
    marginTop: 12,
  },
  biometricIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  biometricText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
