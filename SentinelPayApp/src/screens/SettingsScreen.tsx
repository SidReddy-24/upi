/**
 * SettingsScreen — User preferences and security settings
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';
import AppIcon from '../components/AppIcon';

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
        <View style={styles.sectionHeaderRow}>
          <AppIcon name="history" size={20} color="#2D6A4F" />
          <Text style={styles.sectionTitle}>Transaction Hold Period</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Pause transactions for review after entering payment details. You can confirm or cancel during the hold period.
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
            trackColor={{ false: '#E8C4B8', true: '#2D6A4F' }}
            thumbColor="#FAF7F0"
          />
        </View>

        {settings.holdEnabled && (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Hold Duration (10 - 30 seconds):</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={holdDurationStr}
                onChangeText={setHoldDurationStr}
                maxLength={2}
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Apply Hold for Payments Above (₹):</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={holdThresholdStr}
                onChangeText={setHoldThresholdStr}
              />
            </View>
          </>
        )}
      </View>

      {/* Guardian & Safety Net */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <AppIcon name="guardian" size={20} color="#2D6A4F" />
          <Text style={styles.sectionTitle}>Guardian Safety Net</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Require trusted guardian verification for transactions exceeding your specified safety limit.
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
            trackColor={{ false: '#E8C4B8', true: '#2D6A4F' }}
            thumbColor="#FAF7F0"
          />
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('GuardianManagement')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppIcon name="guardian" size={18} color="#2D6A4F" />
            <Text style={styles.navButtonText}>Manage Linked Guardians</Text>
          </View>
          <Text style={styles.navButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <AppIcon name="sms" size={20} color="#2D6A4F" />
          <Text style={styles.sectionTitle}>Fraud Notifications</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Real-time SMS Scam Alerts</Text>
            <Text style={styles.toggleDesc}>
              Get immediate alerts when high-risk SMS messages are detected
            </Text>
          </View>
          <Switch
            value={settings.smsNotificationsEnabled}
            onValueChange={toggleSmsNotifications}
            trackColor={{ false: '#E8C4B8', true: '#2D6A4F' }}
            thumbColor="#FAF7F0"
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Preferences</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F0',
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8C4B8',
    elevation: 2,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#FAF7F0',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inputRow: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FAF7F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8C4B8',
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF7F0',
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E8C4B8',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  navButtonArrow: {
    fontSize: 16,
    color: '#2D6A4F',
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: '#2D6A4F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FAF7F0',
    fontSize: 16,
    fontWeight: '800',
  },
});
