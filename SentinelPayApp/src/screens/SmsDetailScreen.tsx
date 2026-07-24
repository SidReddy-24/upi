/**
 * SmsDetailScreen.tsx - Detailed SMS view with fraud analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { SmsMessage, getMessageById, updateMessage } from '../utils/smsDb';

type Props = NativeStackScreenProps<RootStackParamList, 'SmsDetail'>;

export default function SmsDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { messageId } = route.params;
  const [message, setMessage] = useState<SmsMessage | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load message
   */
  useEffect(() => {
    const loadMessage = async () => {
      try {
        const msg = await getMessageById(messageId);
        setMessage(msg);
      } catch (error) {
        console.error('[SmsDetailScreen] Error loading message:', error);
        Alert.alert('Error', 'Failed to load message details');
      } finally {
        setLoading(false);
      }
    };

    loadMessage();
  }, [messageId]);

  /**
   * Mark as safe
   */
  const handleMarkAsSafe = useCallback(async () => {
    if (!message) return;

    Alert.alert(
      'Mark as Safe',
      'Override fraud detection and mark this message as safe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Safe',
          onPress: async () => {
            try {
              await updateMessage(message.id, {
                userOverride: 'safe',
                classification: 'genuine',
              });
              const updated = await getMessageById(message.id);
              setMessage(updated);
              Alert.alert('Success', 'Message marked as safe');
            } catch (error) {
              Alert.alert('Error', 'Failed to update message');
            }
          },
        },
      ]
    );
  }, [message]);

  /**
   * Report as fraud
   */
  const handleReportFraud = useCallback(() => {
    if (!message) return;
    
    navigation.navigate('ReportScam', {
      entityType: 'phone',
      entityValue: message.sender,
      evidence: message.body,
    });
  }, [message, navigation]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Message not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getBadgeStyle = () => {
    switch (message.classification) {
      case 'fraud':
        return styles.badgeFraud;
      case 'suspicious':
        return styles.badgeSuspicious;
      case 'genuine':
        return styles.badgeGenuine;
    }
  };

  const getBadgeText = () => {
    switch (message.classification) {
      case 'fraud':
        return 'FRAUD DETECTED';
      case 'suspicious':
        return 'SUSPICIOUS';
      case 'genuine':
        return 'GENUINE';
    }
  };

  const getExplanation = () => {
    if (message.fraudScore >= 0.85) {
      return 'This message shows very high indicators of fraud. The content, sender, and patterns match known scam messages. Avoid clicking links or sharing personal information.';
    } else if (message.fraudScore >= 0.7) {
      return 'This message shows strong indicators of fraud. Exercise extreme caution and verify the sender through official channels before taking any action.';
    } else if (message.fraudScore >= 0.4) {
      return 'This message shows some suspicious characteristics. Verify the sender and be cautious about any requests for personal information or financial actions.';
    } else {
      return 'This message appears to be genuine based on content analysis. However, always verify important requests through official channels.';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Classification Badge */}
      <View style={[styles.classificationBanner, getBadgeStyle()]}>
        <Text style={styles.classificationText}>{getBadgeText()}</Text>
        {message.userOverride && (
          <Text style={styles.overrideText}>
            (User Override: {message.userOverride === 'safe' ? 'Marked Safe' : 'Marked Fraud'})
          </Text>
        )}
      </View>

      {/* Fraud Score Meter */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>Fraud Risk Score</Text>
        <View style={styles.meterContainer}>
          <View style={styles.meterBackground}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${message.fraudScore * 100}%`,
                  backgroundColor:
                    message.fraudScore >= 0.7
                      ? '#ef4444'
                      : message.fraudScore >= 0.4
                      ? '#f59e0b'
                      : '#10b981',
                },
              ]}
            />
          </View>
          <Text style={styles.scoreValue}>{(message.fraudScore * 100).toFixed(1)}%</Text>
        </View>
      </View>

      {/* Message Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>From:</Text>
          <Text style={styles.detailValue}>{message.sender}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Received:</Text>
          <Text style={styles.detailValue}>
            {new Date(message.timestamp).toLocaleString()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Scanned:</Text>
          <Text style={styles.detailValue}>
            {new Date(message.scannedAt).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Message Body */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message Content</Text>
        <View style={styles.bodyContainer}>
          <Text style={styles.bodyText}>{message.body}</Text>
        </View>
      </View>

      {/* Fraud Analysis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fraud Analysis</Text>
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisText}>{getExplanation()}</Text>
        </View>

        {message.classification === 'fraud' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Security Recommendations</Text>
            <Text style={styles.warningText}>• Do not click any links in this message</Text>
            <Text style={styles.warningText}>• Do not share personal or financial information</Text>
            <Text style={styles.warningText}>• Verify sender through official channels</Text>
            <Text style={styles.warningText}>• Report this message if it's a scam</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.reportButton]}
          onPress={handleReportFraud}>
          <Text style={styles.actionButtonText}>📢 Report as Fraud</Text>
        </TouchableOpacity>

        {message.classification !== 'genuine' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.safeButton]}
            onPress={handleMarkAsSafe}>
            <Text style={styles.actionButtonText}>✓ Mark as Safe</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  classificationBanner: {
    padding: 20,
    alignItems: 'center',
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
  classificationText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  overrideText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  scoreContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  meterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meterBackground: {
    flex: 1,
    height: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  meterFill: {
    height: '100%',
    borderRadius: 12,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    minWidth: 60,
    textAlign: 'right',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  bodyContainer: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  bodyText: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  analysisContainer: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  analysisText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#78350f',
    marginBottom: 4,
  },
  actionContainer: {
    padding: 12,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  reportButton: {
    backgroundColor: '#ef4444',
  },
  safeButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
