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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'PinLogin'>;

export default function PinLoginScreen({ navigation }: Props): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const available = await unifiedAuthService.isBiometricAvailable();
    setBiometricAvailable(available);

    if (available) {
      const user = await unifiedAuthService.getCurrentUser();
      setBiometricEnabled(user?.biometricEnabled || false);

      if (user?.biometricEnabled) {
        handleBiometricLogin();
      }
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await unifiedAuthService.authenticateWithBiometric();
      
      if (result.success) {
        navigation.replace('Home');
      } else {
        console.log('[PinLogin] Biometric failed, use PIN');
      }
    } catch (error) {
      console.error('[PinLogin] Biometric error:', error);
    } finally {
      setLoading(false);
    }
  };

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
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={DS.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={DS.authBrand}>
            <View style={DS.authBrandIcon}>
              <AppIcon name="lock" size={28} color="#FFFFFF" />
            </View>
            <Text style={DS.authBrandTitle}>Welcome Back</Text>
            <Text style={DS.authBrandSub}>ENTER PIN TO UNLOCK WALLET</Text>
          </View>

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
                autoFocus={!biometricEnabled}
              />
            </View>

            <TouchableOpacity
              style={[DS.btn, DS.btnPrimary, (!pin || loading) && DS.btnDisabled]}
              onPress={handlePinLogin}
              disabled={!pin || loading}
              activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator color={C.textInverse} />
              ) : (
                <>
                  <AppIcon name="lock" size={18} color={C.textInverse} />
                  <Text style={DS.btnText}>Unlock Wallet</Text>
                </>
              )}
            </TouchableOpacity>

            {biometricAvailable && (
              <TouchableOpacity
                style={[DS.btn, DS.btnOutline, { marginTop: S.md }]}
                onPress={handleBiometricLogin}
                activeOpacity={0.7}>
                <AppIcon name="fingerprint" size={20} color={C.green} />
                <Text style={DS.btnTextDark}>Use Fingerprint / Face ID</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={{ marginTop: S.lg, alignItems: 'center' }}
            onPress={() => navigation.navigate('AuthModeSelector')}>
            <Text style={DS.seeAll}>← Use Different Login Method</Text>
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
