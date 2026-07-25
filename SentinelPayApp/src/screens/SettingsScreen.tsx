/**
 * SettingsScreen — User preferences and security settings
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>System Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Transaction Hold Period */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
            <AppIcon name="history" size={18} color={C.dark} />
            <Text style={DS.cardTitle}>Transaction Hold Period</Text>
          </View>
          <Text style={[DS.cardSub, { marginBottom: S.md }]}>
            Pause transactions for review after entering payment details. You can confirm or cancel during the hold period.
          </Text>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Enable Transaction Hold</Text>
              <Text style={DS.cardSub}>
                {settings.holdEnabled ? 'Active' : 'Disabled'}
              </Text>
            </View>
            <Switch
              value={settings.holdEnabled}
              onValueChange={toggleHoldEnabled}
              trackColor={{ false: C.border, true: C.green }}
            />
          </View>

          {settings.holdEnabled && (
            <View style={{ gap: S.sm, marginTop: S.xs }}>
              <View>
                <Text style={DS.inputLabel}>HOLD DURATION (10 - 30 SECONDS)</Text>
                <TextInput
                  style={DS.inputStandalone}
                  keyboardType="numeric"
                  value={holdDurationStr}
                  onChangeText={setHoldDurationStr}
                  maxLength={2}
                />
              </View>

              <View>
                <Text style={DS.inputLabel}>APPLY HOLD FOR PAYMENTS ABOVE (₹)</Text>
                <TextInput
                  style={DS.inputStandalone}
                  keyboardType="numeric"
                  value={holdThresholdStr}
                  onChangeText={setHoldThresholdStr}
                />
              </View>
            </View>
          )}
        </View>

        {/* Guardian & Safety Net */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
            <AppIcon name="guardian" size={18} color={C.green} />
            <Text style={DS.cardTitle}>Guardian Safety Net</Text>
          </View>
          <Text style={[DS.cardSub, { marginBottom: S.md }]}>
            Require trusted guardian verification for transactions exceeding your specified safety limit.
          </Text>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Enable Guardian Protection</Text>
              <Text style={DS.cardSub}>
                {settings.guardianEnabled ? 'Active' : 'Disabled'}
              </Text>
            </View>
            <Switch
              value={settings.guardianEnabled}
              onValueChange={toggleGuardianEnabled}
              trackColor={{ false: C.border, true: C.green }}
            />
          </View>

          <TouchableOpacity
            style={DS.rowCard}
            onPress={() => navigation.navigate('GuardianManagement')}
            activeOpacity={0.7}
          >
            <AppIcon name="guardian" size={18} color={C.green} />
            <Text style={[DS.cardTitle, { flex: 1 }]}>Manage Linked Guardians</Text>
            <AppIcon name="chevronRight" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
            <AppIcon name="sms" size={18} color={C.blue} />
            <Text style={DS.cardTitle}>Fraud Notifications</Text>
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Real-time SMS Scam Alerts</Text>
              <Text style={DS.cardSub}>
                Get immediate alerts when high-risk SMS messages are detected
              </Text>
            </View>
            <Switch
              value={settings.smsNotificationsEnabled}
              onValueChange={toggleSmsNotifications}
              trackColor={{ false: C.border, true: C.green }}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[DS.btn, DS.btnPrimary, { marginTop: S.sm }]} onPress={handleSave} activeOpacity={0.7}>
          <Text style={DS.btnText}>Save Preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
