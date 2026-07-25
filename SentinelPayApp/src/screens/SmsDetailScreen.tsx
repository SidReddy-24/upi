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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { SmsMessage, getMessageById, updateMessage } from '../utils/smsDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = NativeStackScreenProps<RootStackParamList, 'SmsDetail'>;

export default function SmsDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { messageId } = route.params;
  const [message, setMessage] = useState<SmsMessage | null>(null);
  const [loading, setLoading] = useState(true);

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
      <SafeAreaView style={DS.safeArea}>
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (!message) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <View style={DS.emptyCard}>
          <AppIcon name="alert" size={40} color={C.red} />
          <Text style={DS.emptyTitle}>Message Not Found</Text>
          <TouchableOpacity style={[DS.btn, DS.btnPrimary, { marginTop: S.md }]} onPress={() => navigation.goBack()}>
            <Text style={DS.btnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const getBadgeStyle = () => {
    switch (message.classification) {
      case 'fraud':
        return { bg: C.redBg, color: C.red, label: 'FRAUD DETECTED' };
      case 'suspicious':
        return { bg: C.amberBg, color: C.amber, label: 'SUSPICIOUS' };
      case 'genuine':
        return { bg: C.greenBg, color: C.green, label: 'GENUINE' };
    }
  };

  const badge = getBadgeStyle();

  const getExplanation = () => {
    if (message.fraudScore >= 0.85) {
      return 'This message shows very high indicators of fraud. Content matches known phishing campaigns.';
    } else if (message.fraudScore >= 0.7) {
      return 'This message shows strong indicators of fraud. Exercise extreme caution.';
    } else if (message.fraudScore >= 0.4) {
      return 'This message shows some suspicious characteristics. Verify sender authenticity.';
    } else {
      return 'This message appears to be genuine based on content analysis.';
    }
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>SMS Analysis</Text>
        <View style={[DS.pillBadge, { backgroundColor: badge.bg }]}>
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: badge.color }}>{badge.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent}>
        {/* Fraud Risk Score */}
        <View style={DS.cardLg}>
          <Text style={DS.cardTitle}>Fraud Risk Score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.sm }}>
            <View style={{ flex: 1, height: 8, backgroundColor: C.surfaceAlt, borderRadius: 4, overflow: 'hidden', marginRight: S.md }}>
              <View
                style={{
                  height: '100%',
                  width: `${message.fraudScore * 100}%`,
                  backgroundColor: badge.color,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={{ fontSize: T.xl, fontWeight: T.black, color: badge.color }}>
              {(message.fraudScore * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Message Details */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Message Details</Text>
          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
            <Text style={DS.cardSub}>Sender:</Text>
            <Text style={[DS.cardTitle, { flex: 1, textAlign: 'right' }]}>{message.sender}</Text>
          </View>
          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
            <Text style={DS.cardSub}>Received:</Text>
            <Text style={[DS.cardTitle, { flex: 1, textAlign: 'right' }]}>{new Date(message.timestamp).toLocaleString()}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Message Body</Text>
          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, borderLeftWidth: 4, borderLeftColor: C.dark }]}>
            <Text style={{ fontSize: T.body, color: C.textPrimary, lineHeight: 20 }}>{message.body}</Text>
          </View>
        </View>

        {/* Analysis */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>FraudShield AI Explanation</Text>
          <Text style={[DS.cardSub, { fontSize: T.body, color: C.textPrimary, marginBottom: S.md }]}>{getExplanation()}</Text>

          {message.classification === 'fraud' && (
            <View style={[DS.infoCard, { backgroundColor: C.redBg }]}>
              <AppIcon name="alert" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.red }}>Security Advice:</Text>
                <Text style={{ fontSize: T.xs, color: C.red }}>• Do not click any links in this SMS</Text>
                <Text style={{ fontSize: T.xs, color: C.red }}>• Never share OTPs or UPI PINs</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ gap: S.md }}>
          <TouchableOpacity style={[DS.btn, DS.btnDanger]} onPress={handleReportFraud} activeOpacity={0.7}>
            <AppIcon name="report" size={18} color={C.textInverse} />
            <Text style={DS.btnText}>Report as Fraud</Text>
          </TouchableOpacity>

          {message.classification !== 'genuine' && (
            <TouchableOpacity style={[DS.btn, DS.btnOutline]} onPress={handleMarkAsSafe} activeOpacity={0.7}>
              <AppIcon name="check" size={18} color={C.green} />
              <Text style={DS.btnTextDark}>Mark as Safe</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
