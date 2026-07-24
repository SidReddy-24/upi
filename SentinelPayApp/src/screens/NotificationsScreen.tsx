import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { notificationService, NotificationItem } from '../services/notificationService';
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'>;
};

export default function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
    const unsubscribe = notificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  const loadNotifications = async () => {
    setRefreshing(true);
    const list = await notificationService.syncRemoteNotifications();
    setNotifications(list);
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    const list = await notificationService.getNotifications();
    setNotifications(list);
  };

  const handleItemPress = (item: NotificationItem) => {
    if (item.transaction_id) {
      navigation.navigate('TransactionDetail', { txnId: item.transaction_id });
    }
  };

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'PAYMENT_RECEIVED':
        return <AppIcon name="arrowDownLeft" size={20} color="#2E8B57" />;
      case 'PAYMENT_SENT':
        return <AppIcon name="arrowUpRight" size={20} color="#2563EB" />;
      case 'GUARDIAN_APPROVED':
        return <AppIcon name="shieldCheck" size={20} color="#2E8B57" />;
      case 'GUARDIAN_REJECTED':
      case 'AI_RISK_BLOCK':
        return <AppIcon name="shieldAlert" size={20} color="#DC2626" />;
      case 'DEVICE_TRUST':
        return <AppIcon name="cpu" size={20} color="#6366F1" />;
      default:
        return <AppIcon name="bell" size={20} color="#D97706" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Light Enterprise Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerSubtitle}>ENTERPRISE INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>Smart Notification Center</Text>
        </View>
        <TouchableOpacity style={styles.readAllBtn} onPress={handleMarkAllRead}>
          <Text style={styles.readAllText}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadNotifications} tintColor="#2E8B57" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Unread Status Bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryLeft}>
            <View style={styles.bellIconCircle}>
              <AppIcon name="bell" size={16} color="#2E8B57" />
            </View>
            <Text style={styles.summaryText}>
              {unreadCount > 0 ? `${unreadCount} Unread Alert${unreadCount > 1 ? 's' : ''}` : 'All Notifications Up to Date'}
            </Text>
          </View>
          <View style={styles.livePulseBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>SYNCED</Text>
          </View>
        </View>

        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <AppIcon name="bell" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>
              Real-time payment updates, AI security alerts, and guardian requests will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notifCard, !item.read && styles.unreadCard]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.75}
            >
              <View style={styles.iconCircle}>{getIconForType(item.type)}</View>
              <View style={styles.notifBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.notifTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifText}>{item.body}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.timestampText}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {item.transaction_id && (
                    <Text style={styles.refText}>Ref: {item.transaction_id}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#FAF7F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerSubtitle: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  readAllBtn: {
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  readAllText: {
    color: '#2E8B57',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContainer: {
    padding: 16,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '700',
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E8B57',
  },
  liveText: {
    color: '#2E8B57',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadCard: {
    borderColor: '#2E8B57',
    borderLeftWidth: 4,
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E8B57',
    marginLeft: 6,
  },
  notifText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  refText: {
    color: '#2E8B57',
    fontSize: 11,
    fontWeight: '600',
  },
});
