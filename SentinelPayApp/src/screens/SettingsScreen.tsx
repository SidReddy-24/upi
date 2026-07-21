/**
 * SettingsScreen — User preferences and security settings
 * 
 * Features:
 * - Transaction Hold Period configuration
 * - Guardian/Family Guard settings
 * - Notification preferences
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [holdDurationStr, setHoldDurationStr] = useState('15');
  const [holdThresholdStr, setHoldThresholdStr] = useState('5000');
  const [guardianThresholdStr, setGuardianThresholdStr] = useState('10000');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setHoldDurationStr(String(s.holdDuration));
    setHoldThresholdStr(String(s.holdThresholdAmount));
    setGuardianThresholdStr(String(s.guardianThresholdAmount));
  };

  const handleSave = async () => {
    if (!settings) return;

    const holdDuration = parseInt(holdDurationStr) || 15;
    const holdThreshold = parseInt(holdThresholdStr) || 5000;
    const guardianThreshold = parseInt(guardianThresholdStr) || 10000;

    // Validation
    if (holdDuration < 10 || holdDuration > 30) {
      Alert.alert('Invalid Duration', 'Hold duration must be between 10 and 30 seconds');
      return;
    }

    await updateSettings({
      ...settings,
      holdDuration,
      holdThresholdAmount: holdThreshold,
      guardianThresholdAmount: guardianThreshold,
    });

    Alert.alert('Settings Saved', 'Your preferences have been updated successfully.');
  };

  const toggleHoldEnabled = async (value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, holdEnabled: value };
    setSettings(updated);
    await updateSettings(updated);
  };

  const toggleGuardianEnabled = async (value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, guardianEnabled: value };
    setSettings(updated);
    await updateSettings(updated);
  };

  const toggleSmsNotifications = async (value: boolean) => {
    if (!settings) return;
    const updated = { ...settings, smsNotificationsEnabled: value };
    setSettings(updated);
    await updateSettings(updated);
  };

  if (!settings) return null;

  return (
    <ScrollView style={styles.container}>
      
      {/* Transaction Hold Period */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏱️ Transaction Hold Period</Text>
        <Text style={styles.sectionDesc}>
          Pause transactions for review after entering UPI PIN. You can confirm or cancel during the hold period.
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Enable Transaction Hold</Text>
            <Text style={styles.toggleDesc}>
              {settings.holdEnabled ? 'Active' : 'Disabled'}
            </Text>
          </View>
          <Switch
            value={settings.holdEnabled}
            onValueChange={toggleHoldEnabled}
            trackColor={{ true: '#6366f1' }}
          />
        </View>

        {settings.holdEnabled && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hold Duration (seconds)</Text>
              <TextInput
                style={styles.input}
                value={holdDurationStr}
                onChangeText={setHoldDurationStr}
                keyboardType="numeric"
                placeholder="10-30"
              />
              <Text style={styles.inputHint}>Enter value between 10 and 30 seconds</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hold Threshold Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={holdThresholdStr}
                onChangeText={setHoldThresholdStr}
                keyboardType="numeric"
                placeholder="5000"
              />
              <Text style={styles.inputHint}>
                Transactions above this amount will be held for review
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Guardian Protection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛡️ Guardian Protection</Text>
        <Text style={styles.sectionDesc}>
          Require approval from trusted guardians for high-risk transactions.
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Enable Guardian Protection</Text>
            <Text style={styles.toggleDesc}>
              {settings.guardianEnabled ? 'Active' : 'Disabled'}
            </Text>
          </View>
          <Switch
            value={settings.guardianEnabled}
            onValueChange={toggleGuardianEnabled}
            trackColor={{ true: '#6366f1' }}
          />
        </View>

        {settings.guardianEnabled && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Guardian Approval Threshold (₹)</Text>
              <TextInput
                style={styles.input}
                value={guardianThresholdStr}
                onChangeText={setGuardianThresholdStr}
                keyboardType="numeric"
                placeholder="10000"
              />
              <Text style={styles.inputHint}>
                Transactions above this amount require guardian approval
              </Text>
            </View>

            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => navigation.navigate('GuardianManagement')}>
              <Text style={styles.manageBtnText}>👥 Manage Guardians</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>SMS Notifications</Text>
            <Text style={styles.toggleDesc}>Receive SMS after transactions</Text>
          </View>
          <Switch
            value={settings.smsNotificationsEnabled}
            onValueChange={toggleSmsNotifications}
            trackColor={{ true: '#6366f1' }}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Push Notifications</Text>
            <Text style={styles.toggleDesc}>In-app notifications</Text>
          </View>
          <Switch
            value={settings.pushNotificationsEnabled}
            onValueChange={(v) => {
              const updated = { ...settings, pushNotificationsEnabled: v };
              setSettings(updated);
              updateSettings(updated);
            }}
            trackColor={{ true: '#6366f1' }}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>💾 Save All Settings</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 18,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 19 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  toggleDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  inputGroup: { marginTop: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  inputHint: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  manageBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  manageBtnText: { fontSize: 14, fontWeight: '700', color: '#4338ca' },
  saveBtn: {
    backgroundColor: '#6366f1',
    margin: 16,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 3,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
