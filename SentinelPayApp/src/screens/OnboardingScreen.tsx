/**
 * OnboardingScreen — Phase 8.1.5
 *
 * 3-card first-launch disclosure screen:
 *  1. Welcome — "SentinelPay Credits (SPC) — Not real money"
 *  2. AI Shield — What FraudShield checks
 *  3. Privacy — "SMS classification 100% on-device"
 *
 * On completion: sets `sentinelpay_onboarded = true` in AsyncStorage
 * and navigates to HomeScreen. Never shown again after first completion.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';

export const ONBOARDING_KEY = 'sentinelpay_onboarded';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const SLIDES = [
  {
    emoji: '🪙',
    title: 'Welcome to SentinelPay',
    subtitle: 'SentinelPay Credits (SPC)',
    body: 'This is a simulation app. All transactions use SentinelPay Credits (SPC) — not real Indian Rupees. No real money is transferred at any point.',
    accent: '#6366f1',
    bg: '#eef2ff',
  },
  {
    emoji: '🛡️',
    title: 'AI Fraud Shield',
    subtitle: 'Real-time, 6ms decisions',
    body: 'Every payment is scored by FraudShield AI before it executes.\n\n✅ Machine Learning model\n✅ 10 rule engine checks\n✅ Behavioural anomaly detection\n✅ Transaction graph analysis\n✅ Device & call-state signals',
    accent: '#0284c7',
    bg: '#e0f2fe',
  },
  {
    emoji: '🔒',
    title: 'Your Privacy is Protected',
    subtitle: '100% on-device processing',
    body: 'SMS messages are read locally for OTP detection only — no message content is ever uploaded to any server.\n\nCall state detection is used solely to flag potential social engineering attacks.',
    accent: '#16a34a',
    bg: '#dcfce7',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToSlide = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCurrent(next), 150);
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      goToSlide(current + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      const deviceIdKey = 'sentinelpay_device_id';
      let deviceId = await AsyncStorage.getItem(deviceIdKey);
      if (!deviceId) {
        deviceId = `SP_DEV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await AsyncStorage.setItem(deviceIdKey, deviceId);
      }

      // Register unique user profile in central database
      const profile = await fraudShieldApi.registerUser(deviceId, 'Sentinel User');
      await AsyncStorage.setItem('sentinelpay_user', JSON.stringify({
        id: 1,
        name: profile.name,
        vpa: profile.vpa,
        balance: profile.balance,
        created_at: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('Backend user registration fallback to local:', e);
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Home');
  };

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: slide.bg }]}>
      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === current
                ? [styles.dotActive, { backgroundColor: slide.accent }]
                : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Card */}
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={[styles.title, { color: slide.accent }]}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>

      {/* Navigation */}
      <View style={styles.navRow}>
        {current > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => goToSlide(current - 1)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
          onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {isLast ? '🚀 Get Started' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skip (not on last slide) */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleComplete}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
      )}

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          🧪 SIMULATION ONLY — Not affiliated with NPCI or any bank
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#d1d5db',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 32,
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    textAlign: 'left',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 80,
  },
  backBtnText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '600',
  },
  nextBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  skipBtnText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  disclaimer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
