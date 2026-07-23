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
      setMessages(msgs);
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
            return '🚨 FRAUD';
          case 'suspicious':
            return '⚠️ SUSPICIOUS';
          case 'genuine':
            return '✓ GENUINE';
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
          <Text style={styles.actionButtonText}>🔄 Re-scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={handleClearData}>
          <Text style={styles.actionButtonText}>🗑️ Clear Data</Text>
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
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statsHeader: {
    backgroundColor: '#6366f1',
    padding: 16,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeFraud: {
    backgroundColor: '#fee2e2',
  },
  badgeSuspicious: {
    backgroundColor: '#fef3c7',
  },
  badgeGenuine: {
    backgroundColor: '#d1fae5',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  body: {
    fontSize: 14,
    color: '#4b5563',
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
    color: '#9ca3af',
  },
  score: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  scanningText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    margin: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
});
