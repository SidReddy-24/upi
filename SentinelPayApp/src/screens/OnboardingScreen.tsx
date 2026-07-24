import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon, { IconName } from '../components/AppIcon';

export const ONBOARDING_KEY = 'sentinelpay_onboarded';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  icon: IconName;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  bg: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'coin',
    title: 'Welcome to SentinelPay',
    subtitle: 'SentinelPay Credits (SPC)',
    body: 'This is a simulation app. All transactions use SentinelPay Credits (SPC) — not real Indian Rupees. No real money is transferred at any point.',
    accent: '#2D6A4F',
    bg: '#FAF7F0',
  },
  {
    icon: 'shield',
    title: 'AI Fraud Shield',
    subtitle: 'Real-time, 6ms decisions',
    body: 'Every payment is scored by FraudShield AI before it executes.\n\n• Machine Learning model\n• 10 rule engine checks\n• Behavioural anomaly detection\n• Transaction graph analysis\n• Device & call-state signals',
    accent: '#2D6A4F',
    bg: '#FAF7F0',
  },
  {
    icon: 'lock',
    title: 'Your Privacy is Protected',
    subtitle: '100% on-device processing',
    body: 'SMS messages are read locally for OTP detection only — no message content is ever uploaded to any server.\n\nCall state detection is used solely to flag potential social engineering attacks.',
    accent: '#2D6A4F',
    bg: '#FAF7F0',
  },
];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

export default function OnboardingScreen({ navigation }: Props) {
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const animateToSlide = (index: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setCurrent(index);
  };

  const handleNext = async () => {
    if (isLast) {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      navigation.replace('Home');
    } else {
      animateToSlide(current + 1);
    }
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < SLIDES.length) {
      animateToSlide(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.stepText}>Step {current + 1} of {SLIDES.length}</Text>
        <TouchableOpacity onPress={async () => {
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          navigation.replace('Home');
        }}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Dots */}
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
        <View style={styles.iconWrapper}>
          <AppIcon name={slide.icon} size={48} color={slide.accent} />
        </View>
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
            {isLast ? 'Get Started' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer Simulation Warning */}
      <View style={styles.footerNote}>
        <Text style={styles.footerNoteText}>
          SentinelPay AI — Simulation Mode • No Real Currency
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A8B7B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A8B7B',
  },

  /* Dots */
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#D1D5DB',
  },

  /* Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EAF0EB',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FAF7F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A8B7B',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: '#EAF0EB',
    borderRadius: 2,
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    textAlign: 'center',
  },

  /* Navigation Row */
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 80,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7A8B7B',
  },
  nextBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Footer Note */
  footerNote: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
