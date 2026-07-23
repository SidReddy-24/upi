/**
 * PinSetupScreen.tsx - Set up 4-6 digit PIN
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'PinSetup'>;

export default function PinSetupScreen({ navigation }: Props): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);

  /**
   * Validate PIN format
   */
  const validatePin = (pinValue: string): { valid: boolean; error?: string } => {
    if (pinValue.length < 4 || pinValue.length > 6) {
      return { valid: false, error: 'PIN must be 4-6 digits' };
    }
    if (!/^\d+$/.test(pinValue)) {
      return { valid: false, error: 'PIN must contain only numbers' };
    }
    return { valid: true };
  };

  /**
   * Handle PIN entry
   */
  const handlePinEnter = () => {
    const validation = validatePin(pin);
    if (!validation.valid) {
      Alert.alert('Invalid PIN', validation.error);
      return;
    }

    setStep('confirm');
  };

  /**
   * Handle PIN confirmation and save
   */
  const handlePinConfirm = async () => {
    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      const result = await unifiedAuthService.setupPin(pin);
      
      if (result.success) {
        // Check if biometric is available and ask user
        const biometricAvailable = await unifiedAuthService.isBiometricAvailable();
        
        if (biometricAvailable) {
          Alert.alert(
            'Enable Biometric?',
            'Would you like to enable fingerprint/face unlock for faster login?',
            [
              {
                text: 'Skip',
                style: 'cancel',
                onPress: () => navigation.replace('Home'),
              },
              {
                text: 'Enable',
                onPress: () => navigation.replace('BiometricSetup'),
              },
            ]
          );
        } else {
          // No biometric available, go to home
          Alert.alert('PIN Setup Complete', 'Your PIN has been set successfully!', [
            { text: 'Continue', onPress: () => navigation.replace('Home') },
          ]);
        }
      } else {
        Alert.alert('Setup Failed', result.error || 'Failed to setup PIN');
      }
    } catch (error) {
      console.error('[PinSetup] Error:', error);
      Alert.alert('Error', 'Failed to setup PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Go back to PIN entry
   */
  const handleBack = () => {
    setStep('enter');
    setConfirmPin('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🔐</Text>
          <Text style={styles.title}>
            {step === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'enter'
              ? 'Enter a 4-6 digit PIN for secure access'
              : 'Re-enter your PIN to confirm'}
          </Text>
        </View>

        {/* PIN Entry */}
        {step === 'enter' && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Enter PIN</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="••••"
                keyboardType="number-pad"
                secureTextEntry
                value={pin}
                onChangeText={setPin}
                maxLength={6}
                autoFocus
              />
              <Text style={styles.hint}>4-6 digits</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, (!pin || loading) && styles.buttonDisabled]}
              onPress={handlePinEnter}
              disabled={!pin || loading}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PIN Confirmation */}
        {step === 'confirm' && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm PIN</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="••••"
                keyboardType="number-pad"
                secureTextEntry
                value={confirmPin}
                onChangeText={setConfirmPin}
                maxLength={6}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (!confirmPin || loading) && styles.buttonDisabled]}
              onPress={handlePinConfirm}
              disabled={!confirmPin || loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirm PIN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
              <Text style={styles.secondaryButtonText}>← Change PIN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Your PIN is stored securely and never leaves your device
          </Text>
        </View>

        {/* Back to Mode Selector */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('AuthModeSelector')}>
          <Text style={styles.backButtonText}>← Back to Login Options</Text>
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
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
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
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
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
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  securityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#065f46',
    lineHeight: 18,
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
