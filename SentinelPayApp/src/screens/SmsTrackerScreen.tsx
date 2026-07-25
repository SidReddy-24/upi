/**
 * SmsTrackerScreen.tsx - Main SMS Tracker UI
 * Displays all SMS messages with fraud scores and filters
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  SmsMessage,
  getMessagesByClassification,
  clearAllMessages,
  getScannerState,
  resetScannerState,
} from '../utils/smsDb';
import { useSmsTracker } from '../hooks/useSmsTracker';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'SmsTracker'>;

type FilterTab = 'all' | 'fraud' | 'suspicious' | 'genuine';

export default function SmsTrackerScreen({ navigation }: Props): React.JSX.Element {
  const {
    state: trackerState,
    requestAllPermissions,
    scanHistoricalSms,
    startMonitoring,
    refreshStats,
  } = useSmsTracker();

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const loadMessages = useCallback(async (filter: FilterTab = 'all') => {
    try {
      setLoading(true);
      const msgs = await getMessagesByClassification(filter);
      const sorted = [...msgs].sort((a, b) => b.timestamp - a.timestamp);
      setMessages(sorted);
    } catch (error) {
      console.error('[SmsTrackerScreen] Error loading messages:', error);
      Alert.alert('Error', 'Failed to load SMS messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(activeFilter), refreshStats()]);
    setRefreshing(false);
  }, [activeFilter, loadMessages, refreshStats]);

  const handleFilterChange = useCallback(
    (filter: FilterTab) => {
      setActiveFilter(filter);
      loadMessages(filter);
    },
    [loadMessages]
  );

  useEffect(() => {
    const initialize = async () => {
      const scannerState = await getScannerState();

      if (!scannerState.hasScannedHistorical) {
        const granted = await requestAllPermissions();

        if (granted) {
          Alert.alert(
            'SMS Shield Scanner',
            'SentinelPay will now scan your SMS inbox for phishing vectors. Message content stays 100% local on-device.',
            [
              {
                text: 'Start Scan',
                onPress: async () => {
                  await scanHistoricalSms();
                  await loadMessages();
                  startMonitoring();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Permissions Required',
            'SMS Shield requires READ_SMS permission to detect phishing vectors locally.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await loadMessages();
        startMonitoring();
      }
    };

    initialize();
  }, [requestAllPermissions, scanHistoricalSms, loadMessages, startMonitoring]);

  const handleRescan = useCallback(() => {
    Alert.alert(
      'Re-scan All Messages',
      'This will clear existing classifications and re-scan all SMS messages. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-scan',
          onPress: async () => {
            await clearAllMessages();
            await resetScannerState();
            await scanHistoricalSms();
            await loadMessages();
          },
        },
      ]
    );
  }, [scanHistoricalSms, loadMessages]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all stored SMS records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllMessages();
            await resetScannerState();
            setMessages([]);
            await refreshStats();
          },
        },
      ]
    );
  }, [refreshStats]);

  const renderMessage = useCallback(
    ({ item }: { item: SmsMessage }) => {
      const getBadgeStyle = () => {
        switch (item.classification) {
          case 'fraud':
            return { backgroundColor: C.redBg, color: C.red };
          case 'suspicious':
            return { backgroundColor: C.amberBg, color: C.amber };
          case 'genuine':
            return { backgroundColor: C.greenBg, color: C.green };
        }
      };

      const bStyle = getBadgeStyle();

      return (
        <TouchableOpacity
          style={DS.rowCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('SmsDetail', { messageId: item.id })}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
              <Text style={DS.cardTitle}>{item.sender}</Text>
              <View style={[DS.pillBadge, { backgroundColor: bStyle.backgroundColor }]}>
                <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: bStyle.color }}>
                  {item.classification.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={DS.cardSub} numberOfLines={2}>
              {item.body}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.xs }}>
              <Text style={{ fontSize: T.xs, color: C.textTertiary }}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
              <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: bStyle.color }}>
                Score: {Math.round(item.fraudScore * 100)}%
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  const renderFilterTabs = () => (
    <View style={{ flexDirection: 'row', gap: S.xs, paddingHorizontal: S.base, marginBottom: S.md }}>
      <TouchableOpacity
        style={[DS.chip, activeFilter === 'all' && { backgroundColor: C.dark }]}
        onPress={() => handleFilterChange('all')}>
        <Text style={[DS.chipText, activeFilter === 'all' && { color: C.textInverse }]}>
          All ({trackerState.totalMessages})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[DS.chip, activeFilter === 'fraud' && { backgroundColor: C.red }]}
        onPress={() => handleFilterChange('fraud')}>
        <Text style={[DS.chipText, activeFilter === 'fraud' && { color: C.textInverse }]}>
          Fraud ({trackerState.fraudCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[DS.chip, activeFilter === 'suspicious' && { backgroundColor: C.amber }]}
        onPress={() => handleFilterChange('suspicious')}>
        <Text style={[DS.chipText, activeFilter === 'suspicious' && { color: C.textInverse }]}>
          Suspicious ({trackerState.suspiciousCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[DS.chip, activeFilter === 'genuine' && { backgroundColor: C.green }]}
        onPress={() => handleFilterChange('genuine')}>
        <Text style={[DS.chipText, activeFilter === 'genuine' && { color: C.textInverse }]}>
          Genuine ({trackerState.genuineCount})
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (trackerState.isScanning) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center', padding: S.xl }]}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={[DS.pageTitle, { marginTop: S.md }]}>Scanning Inbox...</Text>
          <Text style={DS.pageSub}>
            {trackerState.scanProgress}% ({trackerState.totalScanned} messages)
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>SMS Shield</Text>
        <View style={[DS.pillBadge, { backgroundColor: trackerState.isMonitoring ? C.greenBg : C.redBg }]}>
          <View style={[DS.statusDot, { backgroundColor: trackerState.isMonitoring ? C.green : C.red }]} />
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: trackerState.isMonitoring ? C.green : C.red }}>
            {trackerState.isMonitoring ? 'ACTIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListHeaderComponent={renderFilterTabs}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={C.green} style={{ marginTop: S.xl }} />
          ) : (
            <View style={DS.emptyCard}>
              <AppIcon name="sms" size={40} color={C.textTertiary} />
              <Text style={DS.emptyTitle}>No Messages Found</Text>
              <Text style={DS.emptySub}>No SMS matching filter criteria found in local database.</Text>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
        contentContainerStyle={DS.scrollContent}
      />

      <View style={{ flexDirection: 'row', gap: S.md, paddingHorizontal: S.base, paddingBottom: S.base }}>
        <TouchableOpacity style={[DS.btn, DS.btnOutline, { flex: 1 }]} onPress={handleRescan} activeOpacity={0.7}>
          <AppIcon name="refresh" size={16} color={C.textPrimary} />
          <Text style={DS.btnTextDark}>Re-scan SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[DS.btn, DS.btnDanger, { flex: 1 }]} onPress={handleClearData} activeOpacity={0.7}>
          <AppIcon name="report" size={16} color={C.textInverse} />
          <Text style={DS.btnText}>Clear Data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
