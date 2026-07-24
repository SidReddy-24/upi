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
        <AppIcon name="shield" size={54} color="#10B981" />
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
            <AppIcon name="phone" size={24} color="#10B981" />
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
          <AppIcon name="chevronRight" size={18} color="#64748B" />
        </TouchableOpacity>

        {/* PIN + Biometric */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('PinSetup')}>
          <View style={styles.optionIcon}>
            <AppIcon name="lock" size={24} color="#10B981" />
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
          <AppIcon name="chevronRight" size={18} color="#64748B" />
        </TouchableOpacity>

        {/* Google Sign-In (Coming Soon) */}
        <TouchableOpacity
          style={[styles.optionCard, styles.optionDisabled]}
          disabled>
          <View style={styles.optionIcon}>
            <AppIcon name="profile" size={24} color="#64748B" />
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
          <AppIcon name="chevronRight" size={18} color="#475569" />
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
    backgroundColor: '#0F172A',
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
    color: '#F8FAFC',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
  },
  options: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
    color: '#F8FAFC',
  },
  optionDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
  },
  badgeRecommended: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  badgeRecommendedText: {
    color: '#34D399',
  },
  badgeDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
});
