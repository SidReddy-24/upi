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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import unifiedAuthService from '../services/unifiedAuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

export default function BiometricSetupScreen({ navigation }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    checkBiometric();
  }, []);

  /**
   * Check biometric availability
   */
  const checkBiometric = async () => {
    const available = await unifiedAuthService.isBiometricAvailable();
    setBiometricAvailable(available);
    
    // Get biometric type (Fingerprint/Face ID)
    if (available) {
      // Note: In production, you'd get the actual type from the biometrics API
      setBiometricType('Fingerprint/Face ID');
    }
  };

  /**
   * Enable biometric authentication
   */
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

  /**
   * Skip biometric setup
   */
  const handleSkip = () => {
    navigation.replace('Home');
  };

  if (!biometricAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.logo}>⚠️</Text>
          <Text style={styles.title}>Biometric Not Available</Text>
          <Text style={styles.subtitle}>
            Your device doesn't support biometric authentication or it hasn't been set up yet.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleSkip}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>👆</Text>
          <Text style={styles.title}>Enable Biometric Login</Text>
          <Text style={styles.subtitle}>
            Use your {biometricType} for quick and secure access
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureText}>Instant unlock</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔒</Text>
            <Text style={styles.featureText}>Secure authentication</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📱</Text>
            <Text style={styles.featureText}>Device-based security</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleEnableBiometric}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Enable Biometric</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.infoText}>
            💡 You can enable or disable biometric login anytime from Settings
          </Text>
        </View>
      </View>
    </View>
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
  features: {
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  actions: {
    marginBottom: 24,
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
  info: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
