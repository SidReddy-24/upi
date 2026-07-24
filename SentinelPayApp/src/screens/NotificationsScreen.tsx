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
    const list = await notificationService.getNotifications();
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
        return <AppIcon name="arrowDownLeft" size={20} color="#10B981" />;
      case 'PAYMENT_SENT':
        return <AppIcon name="arrowUpRight" size={20} color="#3B82F6" />;
      case 'GUARDIAN_APPROVED':
        return <AppIcon name="checkCircle" size={20} color="#10B981" />;
      case 'GUARDIAN_REJECTED':
      case 'AI_RISK_BLOCK':
        return <AppIcon name="shieldAlert" size={20} color="#EF4444" />;
      case 'DEVICE_TRUST':
        return <AppIcon name="shieldCheck" size={20} color="#6366F1" />;
      default:
        return <AppIcon name="bell" size={20} color="#F59E0B" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Notification Center</Text>
        <TouchableOpacity style={styles.readAllBtn} onPress={handleMarkAllRead}>
          <Text style={styles.readAllText}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadNotifications} tintColor="#3B82F6" />}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppIcon name="bell" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>Real-time payment updates, AI security alerts, and guardian requests will appear here.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notifCard, !item.read && styles.unreadCard]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>{getIconForType(item.type)}</View>
              <View style={styles.notifBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
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
    backgroundColor: '#0F172A',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  readAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  readAllText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unreadCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E293B',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: 6,
  },
  notifText: {
    color: '#CBD5E1',
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
    color: '#64748B',
    fontSize: 11,
  },
  refText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
  },
});
