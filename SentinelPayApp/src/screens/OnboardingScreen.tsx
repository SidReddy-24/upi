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
    accent: '#2D6A4F',
    bg: '#FAF7F0',
  },
  {
    emoji: '🛡️',
    title: 'AI Fraud Shield',
    subtitle: 'Real-time, 6ms decisions',
    body: 'Every payment is scored by FraudShield AI before it executes.\n\n✅ Machine Learning model\n✅ 10 rule engine checks\n✅ Behavioural anomaly detection\n✅ Transaction graph analysis\n✅ Device & call-state signals',
    accent: '#E8C4B8',
    bg: '#FAF7F0',
  },
  {
    emoji: '🔒',
    title: 'Your Privacy is Protected',
    subtitle: '100% on-device processing',
    body: 'SMS messages are read locally for OTP detection only — no message content is ever uploaded to any server.\n\nCall state detection is used solely to flag potential social engineering attacks.',
    accent: '#2D6A4F',
    bg: '#FAF7F0',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const goToSlide = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0.95, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(next);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]).start();
    });
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
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      console.warn('Failed setting onboarding key:', e);
    } finally {
      navigation.replace('PhoneAuth', { useMock: true });
    }
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
    backgroundColor: '#FAF7F0',
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
    backgroundColor: '#2D6A4F',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#E8C4B8',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  emoji: {
    fontSize: 60,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D6A4F',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8C4B8',
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    color: '#1A1A2E',
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
    color: '#64748b',
    fontWeight: '600',
  },
  nextBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 32,
    backgroundColor: '#2D6A4F',
    shadowColor: '#2D6A4F',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  nextBtnText: {
    color: '#FAF7F0',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  skipBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
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

