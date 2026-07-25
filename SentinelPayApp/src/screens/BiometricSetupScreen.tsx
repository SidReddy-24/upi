/**
 * BiometricSetupScreen.tsx - Enable biometric authentication
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

export default function BiometricSetupScreen({ navigation }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const available = await unifiedAuthService.isBiometricAvailable();
    setBiometricAvailable(available);
    
    if (available) {
      setBiometricType('Fingerprint / Face ID');
    }
  };

  const handleEnableBiometric = async () => {
    setLoading(true);
    try {
      const result = await unifiedAuthService.enableBiometric();
      
      if (result.success) {
        Alert.alert(
          'Biometric Enabled!',
          'You can now use fingerprint/face ID to unlock SentinelPay',
          [
            {
              text: 'Continue',
              onPress: () => navigation.replace('Home'),
            },
          ]
        );
      } else {
        Alert.alert('Setup Failed', result.error || 'Failed to enable biometric');
      }
    } catch (error) {
      console.error('[BiometricSetup] Error:', error);
      Alert.alert('Error', 'Failed to enable biometric. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('Home');
  };

  if (!biometricAvailable) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.content}>
          <View style={DS.authBrand}>
            <View style={[DS.authBrandIcon, { backgroundColor: C.amberBg }]}>
              <AppIcon name="alertTriangle" size={28} color={C.amber} />
            </View>
            <Text style={DS.authBrandTitle}>Biometric Not Available</Text>
            <Text style={DS.authBrandSub}>HARDWARE NOT DETECTED OR CONFIGURED</Text>
          </View>

          <View style={DS.cardLg}>
            <Text style={[DS.cardSub, { textAlign: 'center', marginBottom: S.lg }]}>
              Your device does not report biometric capability, or it has not been configured in system settings.
            </Text>
            <TouchableOpacity style={[DS.btn, DS.btnPrimary]} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={DS.btnText}>Continue to Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={styles.content}>
        <View style={DS.authBrand}>
          <View style={DS.authBrandIcon}>
            <AppIcon name="fingerprint" size={28} color="#FFFFFF" />
          </View>
          <Text style={DS.authBrandTitle}>Enable Biometrics</Text>
          <Text style={DS.authBrandSub}>FAST & HARDWARE-ENCRYPTED AUTH</Text>
        </View>

        <View style={styles.features}>
          <View style={DS.rowCard}>
            <View style={[DS.iconMd, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shieldCheck" size={20} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Instant Unlock</Text>
              <Text style={DS.cardSub}>Sub-100ms hardware authentication</Text>
            </View>
          </View>

          <View style={DS.rowCard}>
            <View style={[DS.iconMd, { backgroundColor: C.blueBg }]}>
              <AppIcon name="lock" size={20} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Device Key Vault</Text>
              <Text style={DS.cardSub}>Keys never leave secure enclave</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: S.md }}>
          <TouchableOpacity
            style={[DS.btn, DS.btnPrimary, loading && DS.btnDisabled]}
            onPress={handleEnableBiometric}
            disabled={loading}
            activeOpacity={0.7}>
            {loading ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <>
                <AppIcon name="fingerprint" size={18} color={C.textInverse} />
                <Text style={DS.btnText}>Enable Biometrics</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[DS.btn, DS.btnOutline]} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={DS.btnTextDark}>Skip for Now</Text>
          </TouchableOpacity>
        </View>

        <View style={[DS.infoCard, { backgroundColor: C.blueBg, marginTop: S.xl }]}>
          <AppIcon name="info" size={18} color={C.blue} />
          <Text style={{ flex: 1, fontSize: T.xs, color: C.blue, fontWeight: T.semibold }}>
            You can configure biometric preferences anytime from Profile & Settings.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: S.base,
    justifyContent: 'center',
  },
  features: {
    marginBottom: S.lg,
  },
});
