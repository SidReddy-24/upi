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
import AppIcon from '../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthModeSelector'>;

export default function AuthModeSelector({ navigation }: Props): React.JSX.Element {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <AppIcon name="shield" size={54} color="#2D6A4F" />
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
            <AppIcon name="phone" size={24} color="#2D6A4F" />
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
          <AppIcon name="chevronRight" size={18} color="#7A8B7B" />
        </TouchableOpacity>

        {/* PIN + Biometric */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('PinSetup')}>
          <View style={styles.optionIcon}>
            <AppIcon name="lock" size={24} color="#2D6A4F" />
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
          <AppIcon name="chevronRight" size={18} color="#7A8B7B" />
        </TouchableOpacity>

        {/* Google Sign-In (Coming Soon) */}
        <TouchableOpacity
          style={[styles.optionCard, styles.optionDisabled]}
          disabled>
          <View style={[styles.optionIcon, styles.disabledIcon]}>
            <AppIcon name="profile" size={24} color="#94A3B8" />
          </View>
          <View style={styles.optionContent}>
            <Text style={[styles.optionTitle, styles.disabledText]}>Google Sign-In</Text>
            <Text style={styles.optionDescription}>
              Sign in with your Google account
            </Text>
            <View style={[styles.badge, styles.badgeDisabled]}>
              <Text style={styles.badgeText}>COMING SOON</Text>
            </View>
          </View>
          <AppIcon name="chevronRight" size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      {/* Existing Account */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have a backend account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Sign in with Password →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  options: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  optionDisabled: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  disabledIcon: {
    backgroundColor: '#F1F5F9',
  },
  disabledText: {
    color: '#94A3B8',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  badgeRecommended: {
    backgroundColor: '#D1FAE5',
  },
  badgeRecommendedText: {
    color: '#2D6A4F',
  },
  badgeDisabled: {
    backgroundColor: '#E2E8F0',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D6A4F',
  },
});

