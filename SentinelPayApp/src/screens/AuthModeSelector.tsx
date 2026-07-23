/**
 * AuthModeSelector.tsx - Choose authentication method
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthModeSelector'>;

export default function AuthModeSelector({ navigation }: Props): React.JSX.Element {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🛡️</Text>
        <Text style={styles.title}>SentinelPay AI</Text>
        <Text style={styles.subtitle}>Choose Your Login Method</Text>
      </View>

      {/* Authentication Options */}
      <View style={styles.options}>
        {/* Phone OTP */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('PhoneAuth', { useMock: true })}>
          <View style={styles.optionIcon}>
            <Text style={styles.optionEmoji}>📱</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Phone + OTP</Text>
            <Text style={styles.optionDescription}>
              Get a one-time password on your phone number
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MOCK MODE</Text>
            </View>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        {/* PIN + Biometric */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('PinSetup')}>
          <View style={styles.optionIcon}>
            <Text style={styles.optionEmoji}>🔐</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>PIN + Biometric</Text>
            <Text style={styles.optionDescription}>
              Set up a secure PIN with optional fingerprint/face unlock
            </Text>
            <View style={[styles.badge, styles.badgeRecommended]}>
              <Text style={[styles.badgeText, styles.badgeRecommendedText]}>RECOMMENDED</Text>
            </View>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        {/* Google Sign-In (Coming Soon) */}
        <TouchableOpacity
          style={[styles.optionCard, styles.optionDisabled]}
          disabled>
          <View style={styles.optionIcon}>
            <Text style={styles.optionEmoji}>🔵</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Google Sign-In</Text>
            <Text style={styles.optionDescription}>
              Sign in with your Google account
            </Text>
            <View style={[styles.badge, styles.badgeDisabled]}>
              <Text style={styles.badgeText}>COMING SOON</Text>
            </View>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Existing Account */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have a backend account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerLink}>Login with Password</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>💡</Text>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Mock Mode: </Text>
          Phone OTP uses a fixed code (123456) for testing without real SMS services.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  options: {
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionEmoji: {
    fontSize: 40,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRecommended: {
    backgroundColor: '#22c55e',
  },
  badgeDisabled: {
    backgroundColor: '#475569',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  badgeRecommendedText: {
    color: '#fff',
  },
  optionArrow: {
    fontSize: 24,
    color: '#6366f1',
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366f1',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '700',
    color: '#f8fafc',
  },
});
