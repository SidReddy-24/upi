/**
 * SmsTrackerScreen.tsx - Main SMS Tracker UI
 * 
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  SmsMessage,
  getAllMessages,
  getMessagesByClassification,
  clearAllMessages,
  getScannerState,
  resetScannerState,
} from '../utils/smsDb';
import { useSmsTracker } from '../hooks/useSmsTracker';
import AppIcon from '../components/AppIcon';

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

  /**
   * Load messages based on filter
   */
  const loadMessages = useCallback(async (filter: FilterTab = 'all') => {
    try {
      setLoading(true);
      const msgs = await getMessagesByClassification(filter);
      // Strictly sort by timestamp descending (newest messages first)
      const sorted = [...msgs].sort((a, b) => b.timestamp - a.timestamp);
      setMessages(sorted);
    } catch (error) {
      console.error('[SmsTrackerScreen] Error loading messages:', error);
      Alert.alert('Error', 'Failed to load SMS messages');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh messages
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(activeFilter), refreshStats()]);
    setRefreshing(false);
  }, [activeFilter, loadMessages, refreshStats]);

  /**
   * Filter change handler
   */
  const handleFilterChange = useCallback(
    (filter: FilterTab) => {
      setActiveFilter(filter);
      loadMessages(filter);
    },
    [loadMessages]
  );

  /**
   * Initialize permissions and scanning
   */
  useEffect(() => {
    const initialize = async () => {
      // Check if already scanned
      const scannerState = await getScannerState();

      if (!scannerState.hasScannedHistorical) {
        // Request permissions
        const granted = await requestAllPermissions();

        if (granted) {
          // Start historical scan
          Alert.alert(
            'SMS Scanner',
            'SentinelPay will now scan your SMS messages to detect fraud. This may take a moment.',
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
            'SMS Tracker requires READ_SMS and RECEIVE_SMS permissions to function. Please grant permissions in Settings.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Already scanned, just load messages
        await loadMessages();
        startMonitoring();
      }
    };

    initialize();
  }, [requestAllPermissions, scanHistoricalSms, loadMessages, startMonitoring]);

  /**
   * Re-scan all messages
   */
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

  /**
   * Clear all data
   */
  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all stored SMS records. This action cannot be undone. Continue?',
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

  /**
   * Render SMS item
   */
  const renderMessage = useCallback(
    ({ item }: { item: SmsMessage }) => {
      const getBadgeStyle = () => {
        switch (item.classification) {
          case 'fraud':
            return styles.badgeFraud;
          case 'suspicious':
            return styles.badgeSuspicious;
          case 'genuine':
            return styles.badgeGenuine;
        }
      };

      const getBadgeText = () => {
        switch (item.classification) {
          case 'fraud':
            return 'FRAUD';
          case 'suspicious':
            return 'SUSPICIOUS';
          case 'genuine':
            return 'GENUINE';
        }
      };

      return (
        <TouchableOpacity
          style={styles.messageCard}
          onPress={() => navigation.navigate('SmsDetail', { messageId: item.id })}>
          <View style={styles.messageHeader}>
            <Text style={styles.sender}>{item.sender}</Text>
            <View style={[styles.badge, getBadgeStyle()]}>
              <Text style={styles.badgeText}>{getBadgeText()}</Text>
            </View>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.score}>Score: {(item.fraudScore * 100).toFixed(0)}%</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  /**
   * Render filter tabs
   */
  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
        onPress={() => handleFilterChange('all')}>
        <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
          All ({trackerState.totalMessages})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'fraud' && styles.filterTabActive]}
        onPress={() => handleFilterChange('fraud')}>
        <Text style={[styles.filterText, activeFilter === 'fraud' && styles.filterTextActive]}>
          Fraud ({trackerState.fraudCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'suspicious' && styles.filterTabActive]}
        onPress={() => handleFilterChange('suspicious')}>
        <Text
          style={[styles.filterText, activeFilter === 'suspicious' && styles.filterTextActive]}>
          Suspicious ({trackerState.suspiciousCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterTab, activeFilter === 'genuine' && styles.filterTabActive]}
        onPress={() => handleFilterChange('genuine')}>
        <Text style={[styles.filterText, activeFilter === 'genuine' && styles.filterTextActive]}>
          Genuine ({trackerState.genuineCount})
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render scanning progress
   */
  if (trackerState.isScanning) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.scanningText}>Scanning SMS Messages...</Text>
        <Text style={styles.progressText}>
          {trackerState.scanProgress}% ({trackerState.totalScanned} messages)
        </Text>
      </View>
    );
  }

  /**
   * Render main UI
   */
  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <Text style={styles.statsTitle}>SMS Fraud Tracker</Text>
        <Text style={styles.statsSubtitle}>
          {trackerState.isMonitoring ? '🟢 Monitoring Active' : '🔴 Monitoring Inactive'}
        </Text>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Messages List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No messages found</Text>
          <Text style={styles.emptySubtext}>
            {activeFilter !== 'all'
              ? `No ${activeFilter} messages`
              : 'Pull down to refresh or check permissions'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={handleRescan}>
          <AppIcon name="sms" size={16} color="#FAF7F0" />
          <Text style={styles.actionButtonText}>Re-scan SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={handleClearData}>
          <AppIcon name="report" size={16} color="#FAF7F0" />
          <Text style={styles.actionButtonText}>Clear Data</Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {trackerState.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{trackerState.error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3EA',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F7F3EA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statsHeader: {
    backgroundColor: '#2E8B57',
    padding: 18,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statsSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFE7DA',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCD1BF',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 3,
    borderRadius: 12,
    backgroundColor: '#F7F3EA',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  filterTabActive: {
    backgroundColor: '#2E8B57',
    borderColor: '#2E8B57',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 14,
  },
  messageCard: {
    backgroundColor: '#EFE7DA',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCD1BF',
    shadowColor: '#181818',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sender: {
    fontSize: 16,
    fontWeight: '800',
    color: '#181818',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeFraud: {
    backgroundColor: 'rgba(192, 57, 43, 0.15)',
  },
  badgeSuspicious: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeGenuine: {
    backgroundColor: 'rgba(46, 139, 87, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#181818',
  },
  body: {
    fontSize: 14,
    color: '#181818',
    marginBottom: 8,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#666666',
  },
  score: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E8B57',
  },
  scanningText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#181818',
    marginTop: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#666666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#EFE7DA',
    borderTopWidth: 1,
    borderTopColor: '#DCD1BF',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2E8B57',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#C0392B',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: 'rgba(192, 57, 43, 0.1)',
    padding: 12,
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C0392B',
  },
  errorText: {
    fontSize: 14,
    color: '#C0392B',
    textAlign: 'center',
    fontWeight: '600',
  },
});
