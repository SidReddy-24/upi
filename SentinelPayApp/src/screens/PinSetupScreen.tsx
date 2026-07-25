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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'PinSetup'>;

export default function PinSetupScreen({ navigation }: Props): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);

  const validatePin = (pinValue: string): { valid: boolean; error?: string } => {
    if (pinValue.length < 4 || pinValue.length > 6) {
      return { valid: false, error: 'PIN must be 4-6 digits' };
    }
    if (!/^\d+$/.test(pinValue)) {
      return { valid: false, error: 'PIN must contain only numbers' };
    }
    return { valid: true };
  };

  const handlePinEnter = () => {
    const validation = validatePin(pin);
    if (!validation.valid) {
      Alert.alert('Invalid PIN', validation.error);
      return;
    }

    setStep('confirm');
  };

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

  const handleBack = () => {
    setStep('enter');
    setConfirmPin('');
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={DS.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={DS.authBrand}>
            <View style={DS.authBrandIcon}>
              <AppIcon name="key" size={28} color="#FFFFFF" />
            </View>
            <Text style={DS.authBrandTitle}>
              {step === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
            </Text>
            <Text style={DS.authBrandSub}>
              {step === 'enter' ? 'ENTER 4-6 DIGITS FOR SECURE ACCESS' : 'RE-ENTER PIN TO VERIFY'}
            </Text>
          </View>

          {step === 'enter' && (
            <View style={DS.cardLg}>
              <View style={{ alignItems: 'center', marginBottom: S.lg }}>
                <TextInput
                  style={[DS.inputStandalone, styles.pinInput]}
                  placeholder="••••"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="number-pad"
                  secureTextEntry
                  value={pin}
                  onChangeText={setPin}
                  maxLength={6}
                  autoFocus
                />
                <Text style={{ fontSize: T.xs, color: C.textTertiary, marginTop: S.xs }}>4-6 numeric digits</Text>
              </View>

              <TouchableOpacity
                style={[DS.btn, DS.btnPrimary, (!pin || loading) && DS.btnDisabled]}
                onPress={handlePinEnter}
                disabled={!pin || loading}
                activeOpacity={0.7}>
                <Text style={DS.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'confirm' && (
            <View style={DS.cardLg}>
              <View style={{ alignItems: 'center', marginBottom: S.lg }}>
                <TextInput
                  style={[DS.inputStandalone, styles.pinInput]}
                  placeholder="••••"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="number-pad"
                  secureTextEntry
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[DS.btn, DS.btnPrimary, (!confirmPin || loading) && DS.btnDisabled]}
                onPress={handlePinConfirm}
                disabled={!confirmPin || loading}
                activeOpacity={0.7}>
                {loading ? (
                  <ActivityIndicator color={C.textInverse} />
                ) : (
                  <Text style={DS.btnText}>Confirm PIN</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[DS.btn, DS.btnOutline, { marginTop: S.md }]} onPress={handleBack}>
                <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
                <Text style={DS.btnTextDark}>Change PIN</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[DS.infoCard, { backgroundColor: C.greenBg, marginTop: S.base }]}>
            <AppIcon name="lock" size={20} color={C.green} />
            <Text style={{ flex: 1, fontSize: T.xs, color: C.green, fontWeight: T.semibold }}>
              Your PIN is encrypted and stored locally in device hardware vault.
            </Text>
          </View>

          <TouchableOpacity
            style={{ marginTop: S.lg, alignItems: 'center' }}
            onPress={() => navigation.navigate('AuthModeSelector')}>
            <Text style={DS.seeAll}>← Back to Login Options</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: S.base,
    justifyContent: 'center',
  },
  pinInput: {
    fontSize: T.xxl,
    letterSpacing: 12,
    textAlign: 'center',
    width: 200,
  },
});
