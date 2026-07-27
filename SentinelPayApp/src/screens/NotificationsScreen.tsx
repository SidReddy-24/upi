/**
 * NotificationsScreen — SentinelPay Design System v2
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { notificationService, NotificationItem } from '../services/notificationService';
import AppIcon, { IconName } from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Notifications'> };

type CategoryFilter = 'ALL' | 'PAYMENTS' | 'GUARDIAN' | 'FRAUD' | 'SECURITY';

function getIconConfig(type: NotificationItem['type']): { name: IconName; color: string; bg: string } {
  switch (type) {
    case 'PAYMENT_RECEIVED':    return { name: 'receive',     color: C.green,  bg: C.greenBg };
    case 'PAYMENT_SENT':        return { name: 'send',        color: C.blue,   bg: C.blueBg };
    case 'GUARDIAN_INVITATION': return { name: 'shield',      color: C.violet, bg: C.violetBg };
    case 'GUARDIAN_APPROVED':   return { name: 'shieldCheck', color: C.green,  bg: C.greenBg };
    case 'GUARDIAN_CODE_READY': return { name: 'key',         color: C.blue,   bg: C.blueBg };
    case 'GUARDIAN_LINKED':     return { name: 'shieldCheck', color: C.green,  bg: C.greenBg };
    case 'GUARDIAN_REJECTED':
    case 'GUARDIAN_EXPIRED':
    case 'GUARDIAN_CANCELLED':  return { name: 'shieldAlert', color: C.amber,  bg: C.amberBg };
    case 'AI_RISK_BLOCK':
    case 'SCAM_DETECTED':       return { name: 'alert',       color: C.red,    bg: C.redBg };
    case 'DEVICE_TRUST':        return { name: 'cpu',         color: C.violet, bg: C.violetBg };
    default:                    return { name: 'bell',        color: C.amber,  bg: C.amberBg };
  }
}

function formatTs(ts: string) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationsScreen({ navigation }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
    const unsub = notificationService.subscribe(setNotifications);
    return () => unsub();
  }, []);

  const load = async () => {
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

  const handleItemPress = async (item: NotificationItem) => {
    if (!item.read) {
      await notificationService.markAsRead(item.id);
    }

    if (item.type.startsWith('GUARDIAN_')) {
      if (item.type === 'GUARDIAN_INVITATION' || item.type === 'GUARDIAN_CODE_READY') {
        navigation.navigate('GuardianVerification', { relationshipId: item.relationship_id });
      } else {
        navigation.navigate('GuardianManagement');
      }
    } else if (item.transaction_id) {
      navigation.navigate('TransactionDetail', { txnId: item.transaction_id });
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PAYMENTS') return n.type === 'PAYMENT_RECEIVED' || n.type === 'PAYMENT_SENT';
    if (activeFilter === 'GUARDIAN') return n.type.startsWith('GUARDIAN_');
    if (activeFilter === 'FRAUD') return n.type === 'AI_RISK_BLOCK' || n.type === 'SCAM_DETECTED';
    if (activeFilter === 'SECURITY') return n.type === 'DEVICE_TRUST' || n.type.startsWith('GUARDIAN_');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const { name, color, bg } = getIconConfig(item.type);
    return (
      <TouchableOpacity
        style={[DS.rowCard, !item.read && styles.unread]}
        activeOpacity={0.7}
        onPress={() => handleItemPress(item)}>
        <View style={[DS.iconMd, { backgroundColor: bg }]}>
          <AppIcon name={name} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[DS.cardTitle, { flex: 1, marginRight: S.sm }]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={[DS.cardSub, { marginTop: 2, lineHeight: 16 }]} numberOfLines={2}>{item.body}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: S.xs }}>
            <Text style={styles.ts}>{formatTs(item.timestamp)}</Text>
            {item.relationship_id ? (
              <Text style={styles.ref}>Tap to View Request →</Text>
            ) : item.transaction_id ? (
              <Text style={styles.ref}>Ref: {item.transaction_id.slice(-8)}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={{ marginBottom: S.md }}>
      <View style={[DS.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <View style={[DS.iconSm, { backgroundColor: C.greenBg }]}>
            <AppIcon name="bell" size={16} color={C.green} />
          </View>
          <Text style={DS.cardTitle}>
            {unreadCount > 0 ? `${unreadCount} Unread Alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Category Filter Pills Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs, paddingVertical: 4 }}>
        {(['ALL', 'PAYMENTS', 'GUARDIAN', 'FRAUD', 'SECURITY'] as CategoryFilter[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
              {filter === 'ALL' ? 'All' : filter === 'PAYMENTS' ? 'Payments' : filter === 'GUARDIAN' ? '🛡️ Guardian' : filter === 'FRAUD' ? 'Fraud' : 'Security'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const ListEmpty = () => (
    <View style={DS.emptyCard}>
      <View style={[DS.iconXl, { backgroundColor: C.surfaceAlt }]}>
        <AppIcon name="bell" size={32} color={C.textTertiary} />
      </View>
      <Text style={DS.emptyTitle}>No Notifications Found</Text>
      <Text style={DS.emptySub}>No alerts match the selected filter category.</Text>
    </View>
  );

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()}>
          <AppIcon name="chevronLeft" size={20} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[DS.label, { color: C.green }]}>SENTINELPAY</Text>
          <Text style={DS.cardTitle}>Notifications</Text>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity style={styles.markReadBtn} onPress={handleMarkAllRead}>
            <Text style={styles.markReadText}>Mark Read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={DS.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={C.green} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  unread: { borderLeftWidth: 3, borderLeftColor: C.green },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  ts: { fontSize: T.xs, color: C.textTertiary, fontWeight: T.medium },
  ref: { fontSize: T.xs, color: C.blue, fontWeight: T.semibold },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  liveText: { fontSize: T.caption, fontWeight: T.extrabold, color: C.green },
  markReadBtn: { backgroundColor: C.greenBg, paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.xs },
  markReadText: { fontSize: T.sm, fontWeight: T.bold, color: C.green },
  filterChip: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.full,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.dark,
    borderColor: C.dark,
  },
  filterChipText: {
    fontSize: T.xs,
    fontWeight: T.semibold,
    color: C.textSecondary,
  },
  filterChipTextActive: {
    color: C.textInverse,
    fontWeight: T.bold,
  },
});
