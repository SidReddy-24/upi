/**
 * HeadsUpNotificationBanner — Native Android 14 OS Style Pop-Up Banner.
 * Displays floating notification card with avatar, app header, bold title, body message, and quick action chips.
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
import { C, S, T, R, DS } from '../theme/ds';

const { width } = Dimensions.get('window');

interface Props {
  onPressNotification?: (item: NotificationItem) => void;
}

export default function HeadsUpNotificationBanner({ onPressNotification }: Props) {
  const [activeItem, setActiveItem] = useState<NotificationItem | null>(null);
  const slideAnim = useRef(new Animated.Value(-160)).current;
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((list) => {
      if (list.length > 0) {
        const latest = list[0];
        if (lastSeenIdRef.current === null) {
          lastSeenIdRef.current = latest.id;
          return;
        }

        if (latest.id !== lastSeenIdRef.current) {
          lastSeenIdRef.current = latest.id;
          showBanner(latest);
        }
      }
    });

    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const showBanner = (item: NotificationItem) => {
    setActiveItem(item);

    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 120, 80, 180]);
      } else {
        Vibration.vibrate(200);
      }
    } catch {
      // Ignore vibration error
    }

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 45,
    }).start();

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      hideBanner();
    }, 6000);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -180,
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
    ? C.green
    : isSecurityAlert
    ? C.red
    : isGuardian
    ? C.amber
    : C.blue;

  const iconEmoji = isPaymentReceived
    ? '💰'
    : isSecurityAlert
    ? '🚨'
    : isGuardian
    ? '🛡️'
    : '🔔';

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Header Row: App name & timestamp */}
      <View style={styles.headerRow}>
        <View style={styles.appTitleContainer}>
          <AppIcon name="shield" size={14} color={C.green} />
          <Text style={styles.appNameText}>SentinelPay</Text>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.timeText}>now</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={hideBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main Body Row: Large Avatar + Title & Subtitle */}
      <TouchableOpacity
        style={styles.contentRow}
        activeOpacity={0.9}
        onPress={() => {
          hideBanner();
          if (onPressNotification && activeItem) {
            onPressNotification(activeItem);
          }
        }}
      >
        <View style={[styles.avatarCircle, { backgroundColor: `${accentColor}18`, borderColor: accentColor }]}>
          <Text style={styles.avatarEmoji}>{iconEmoji}</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {activeItem.title}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {activeItem.body}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Quick Action Chips Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: C.dark }]}
          onPress={() => {
            hideBanner();
            if (onPressNotification && activeItem) {
              onPressNotification(activeItem);
            }
          }}
        >
          <Text style={styles.actionChipPrimaryText}>View Wallet</Text>
        </TouchableOpacity>

        {isPaymentReceived && (
          <TouchableOpacity
            style={[styles.actionChip, styles.actionChipSecondary]}
            onPress={() => {
              hideBanner();
              if (onPressNotification && activeItem) {
                onPressNotification({ ...activeItem, type: 'PAYMENT_SENT' });
              }
            }}
          >
            <Text style={styles.actionChipSecondaryText}>Send Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionChip, styles.actionChipGhost]}
          onPress={() => {
            notificationService.markAllAsRead();
            hideBanner();
          }}
        >
          <Text style={styles.actionChipGhostText}>Mark as read</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 32,
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999,
    backgroundColor: C.surface,
    borderRadius: R.xl,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.xs,
  },
  appTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNameText: {
    fontSize: T.xs,
    fontWeight: T.bold,
    color: C.textPrimary,
    marginLeft: 6,
  },
  bulletDot: {
    fontSize: T.xs,
    color: C.textTertiary,
    marginHorizontal: 6,
  },
  timeText: {
    fontSize: T.caption,
    fontWeight: T.semibold,
    color: C.textSecondary,
  },
  closeBtn: {
    padding: 2,
  },
  closeBtnText: {
    fontSize: T.sm,
    fontWeight: T.bold,
    color: C.textTertiary,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: S.md,
    borderWidth: 1.5,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: T.body,
    fontWeight: T.extrabold,
    color: C.textPrimary,
    marginBottom: 3,
  },
  bodyText: {
    fontSize: T.sm,
    color: C.textSecondary,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: R.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipPrimaryText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  actionChipSecondary: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionChipSecondaryText: {
    color: C.textPrimary,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  actionChipGhost: {
    backgroundColor: 'transparent',
  },
  actionChipGhostText: {
    color: C.textSecondary,
    fontSize: T.xs,
    fontWeight: T.semibold,
  },
});
