import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import AppIcon, { IconName } from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

export const ONBOARDING_KEY = 'sentinelpay_onboarded';

interface Slide {
  icon: IconName;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'coin',
    title: 'Welcome to SentinelPay',
    subtitle: 'SentinelPay Credits (SPC)',
    body: 'This is a simulation app. All transactions use SentinelPay Credits (SPC) — not real Indian Rupees. No real money is transferred at any point.',
    accent: C.blue,
  },
  {
    icon: 'shield',
    title: 'AI Fraud Shield',
    subtitle: 'Real-time, sub-200ms decisions',
    body: 'Every payment is scored by FraudShield AI before execution:\n\n• Machine Learning risk scoring\n• Rule engine & graph analysis\n• Behavioural anomaly detection\n• Live SMS & Call threat flags',
    accent: C.green,
  },
  {
    icon: 'lock',
    title: 'Your Privacy is Protected',
    subtitle: '100% on-device processing',
    body: 'SMS messages are read locally for OTP detection only — no message content is ever uploaded to any server.\n\nCall state detection is used solely to flag potential scam calls.',
    accent: C.violet,
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
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={styles.container}>
        {/* Top bar */}
        <View style={DS.headerBar}>
          <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Step {current + 1} of {SLIDES.length}
          </Text>
          <TouchableOpacity onPress={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            navigation.replace('Home');
          }}>
            <Text style={DS.seeAll}>Skip</Text>
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
        <Animated.View style={[DS.cardLg, styles.card, { opacity: fadeAnim }]}>
          <View style={[DS.iconXl, { backgroundColor: C.surfaceAlt, marginBottom: S.base }]}>
            <AppIcon name={slide.icon} size={36} color={slide.accent} />
          </View>
          <Text style={[DS.pageTitle, { fontSize: T.xl, color: slide.accent, textAlign: 'center', marginBottom: S.xs }]}>
            {slide.title}
          </Text>
          <Text style={[DS.cardSub, { textAlign: 'center', marginBottom: S.base }]}>
            {slide.subtitle}
          </Text>
          <View style={DS.divider} />
          <Text style={[DS.pageSub, { textAlign: 'center', lineHeight: 22 }]}>
            {slide.body}
          </Text>
        </Animated.View>

        {/* Navigation */}
        <View style={styles.navRow}>
          {current > 0 ? (
            <TouchableOpacity style={[DS.btn, DS.btnOutline, { flex: 1, marginRight: S.sm }]} onPress={() => goToSlide(current - 1)}>
              <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
              <Text style={DS.btnTextDark}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1, marginRight: S.sm }} />
          )}

          <TouchableOpacity
            style={[DS.btn, { flex: 1, backgroundColor: slide.accent }]}
            onPress={handleNext}
            activeOpacity={0.7}>
            <Text style={DS.btnText}>
              {isLast ? 'Get Started' : 'Next →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Simulation Warning */}
        <View style={{ alignItems: 'center', marginTop: S.base }}>
          <Text style={{ fontSize: T.xs, color: C.textTertiary, fontWeight: T.medium }}>
            SentinelPay AI — Simulation Mode • No Real Currency
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: S.base,
    paddingBottom: S.base,
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S.sm,
    marginVertical: S.md,
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
    backgroundColor: C.border,
  },
  card: {
    alignItems: 'center',
    paddingVertical: S.xxl,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
