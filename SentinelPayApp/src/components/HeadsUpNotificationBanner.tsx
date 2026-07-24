/**
 * HeadsUpNotificationBanner — Truecaller / Modern OS Style Real-Time Banner.
 * Drops down smoothly from top of screen for incoming payments, AI security alerts, and guardian requests.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import AppIcon from './AppIcon';
import { notificationService, NotificationItem } from '../services/notificationService';

const { width } = Dimensions.get('window');

interface Props {
  onPressNotification?: (item: NotificationItem) => void;
}

export default function HeadsUpNotificationBanner({ onPressNotification }: Props) {
  const [activeItem, setActiveItem] = useState<NotificationItem | null>(null);
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((list) => {
      if (list.length > 0) {
        const latest = list[0];
        // Only trigger banner for notifications created in last 5 seconds
        const ageMs = Date.now() - new Date(latest.timestamp).getTime();
        if (ageMs < 5000 && (!activeItem || activeItem.id !== latest.id)) {
          showBanner(latest);
        }
      }
    });

    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [activeItem]);

  const showBanner = (item: NotificationItem) => {
    setActiveItem(item);

    // Haptic vibration feedback
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 150, 100, 200]);
      } else {
        Vibration.vibrate(200);
      }
    } catch (e) {
      // Ignore vibration errors
    }

    // Animate slide down
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      hideBanner();
    }, 4500);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setActiveItem(null);
    });
  };

  if (!activeItem) return null;

  const isPaymentReceived = activeItem.type === 'PAYMENT_RECEIVED';
  const isSecurityAlert = activeItem.type === 'AI_RISK_BLOCK' || activeItem.type === 'SCAM_DETECTED';
  const isGuardian = activeItem.type === 'GUARDIAN_APPROVED' || activeItem.type === 'GUARDIAN_REJECTED';

  const accentColor = isPaymentReceived
    ? '#10B981'
    : isSecurityAlert
    ? '#EF4444'
    : isGuardian
    ? '#F59E0B'
    : '#3B82F6';

  const iconName = isPaymentReceived
    ? 'arrowDownLeft'
    : isSecurityAlert
    ? 'shieldAlert'
    : isGuardian
    ? 'shieldCheck'
    : 'bell';

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
          borderLeftColor: accentColor,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerTouchable}
        activeOpacity={0.9}
        onPress={() => {
          hideBanner();
          if (onPressNotification && activeItem) {
            onPressNotification(activeItem);
          }
        }}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${accentColor}25` }]}>
          <AppIcon name={iconName} size={22} color={accentColor} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.appNameText}>SENTINELPAY REAL-TIME ALERT</Text>
            <Text style={styles.timeText}>Just now</Text>
          </View>
          <Text style={styles.titleText} numberOfLines={1}>
            {activeItem.title}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {activeItem.body}
          </Text>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={hideBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppIcon name="xCircle" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 28,
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  bannerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  appNameText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  timeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bodyText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
