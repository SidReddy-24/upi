import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUser, resetWallet } from '../utils/walletDb';
import { WalletUser, RootStackParamList } from '../types';
import { authService } from '../services/authService';
import unifiedAuthService from '../services/unifiedAuthService';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';


import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export default function ProfileScreen({ navigation }: Props) {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [secureMode, setSecureMode] = useState(false);
  const [familyGuard, setFamilyGuard] = useState(true);

  // Phase 9: Settings state for Safety Hold Timer
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    getUser().then(setUser);
    getSettings().then(setSettings);
  }, []);

  const handleToggleHold = async (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, holdEnabled: val };
    setSettings(updated);
    await updateSettings({ holdEnabled: val });
  };

  const handleSelectDuration = async (seconds: number) => {
    if (!settings) return;
    const updated = { ...settings, holdDuration: seconds };
    setSettings(updated);
    await updateSettings({ holdDuration: seconds });
  };

  const handleSelectThreshold = async (amount: number) => {
    if (!settings) return;
    const updated = { ...settings, holdThresholdAmount: amount };
    setSettings(updated);
    await updateSettings({ holdThresholdAmount: amount });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your SentinelPay account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await unifiedAuthService.logout();
            await authService.logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'PhoneAuth' }],
            });
          },
        },
      ]
    );
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Demo Wallet',
      'Are you sure you want to reset balance to ₹1,00,000 SPC and clear history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Wallet',
          style: 'destructive',
          onPress: async () => {
            await resetWallet();
            const refreshed = await getUser();
            setUser(refreshed);
            Alert.alert('Reset Complete', 'Wallet balance restored to ₹1,00,000 SPC.');
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      {/* 1. USER PROFILE HEADER */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarBox}>
          <AppIcon name="profile" size={36} color="#FAF7F0" />
        </View>
        <Text style={styles.userName}>{user.name}</Text>

        <View style={styles.idPillContainer}>
          <View style={styles.idPill}>
            <Text style={styles.idPillTag}>PRIMARY KEY (PHONE)</Text>
            <Text style={styles.idPillValue}>{user.phone || user.id}</Text>
          </View>
          {user.dob ? (
            <View style={styles.idPill}>
              <Text style={styles.idPillTag}>DATE OF BIRTH</Text>
              <Text style={styles.idPillValue}>{user.dob}</Text>
            </View>
          ) : null}
          <View style={styles.idPill}>
            <Text style={styles.idPillTag}>UPI VPA ID</Text>
            <Text style={styles.idPillValue}>{user.vpa}</Text>
          </View>
        </View>

        <View style={styles.simulatedPill}>
          <Text style={styles.simulatedText}>SIMULATED SPC ACCOUNT</Text>
        </View>
      </View>

      {/* 2. PAYMENT SAFETY DELAY & COOLDOWN TIMER */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>⏱️ Payment Delay & Safety Hold Timer</Text>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>FEATURED</Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>
          After entering your UPI PIN, a safety delay countdown runs before money leaves your account. This gives you time to cancel if you are being coerced or scammed.
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Enable Safety Delay Timer</Text>
            <Text style={styles.toggleDesc}>
              {settings?.holdEnabled ? 'Active — Payment will hold before finalizing' : 'Disabled — Instant payment execution'}
            </Text>
          </View>
          <Switch
            value={settings?.holdEnabled ?? false}
            onValueChange={handleToggleHold}
            trackColor={{ true: '#6366f1', false: '#cbd5e1' }}
          />
        </View>

        {settings?.holdEnabled && (
          <View style={styles.subSettingsContainer}>
            <Text style={styles.subSettingsLabel}>Timer Duration (Seconds):</Text>
            <View style={styles.chipRow}>
              {[10, 15, 30, 60].map(dur => {
                const isActive = settings.holdDuration === dur;
                return (
                  <TouchableOpacity
                    key={dur}
                    style={[styles.chipBtn, isActive && styles.chipBtnActive]}
                    onPress={() => handleSelectDuration(dur)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {dur}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.subSettingsLabel, { marginTop: 14 }]}>Trigger Delay For Payments:</Text>
            <View style={styles.chipRow}>
              {[
                { label: 'All (₹0+)', val: 0 },
                { label: '> ₹1,000', val: 1000 },
                { label: '> ₹5,000', val: 5000 },
                { label: '> ₹10,000', val: 10000 },
              ].map(item => {
                const isActive = settings.holdThresholdAmount === item.val;
                return (
                  <TouchableOpacity
                    key={item.val}
                    style={[styles.chipBtn, isActive && styles.chipBtnActive]}
                    onPress={() => handleSelectThreshold(item.val)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* 3. GUARDIAN & BIOMETRIC PROTECTION */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AppIcon name="shield" size={18} color="#10B981" />
          <Text style={styles.sectionTitle}>Security & Family Protection</Text>
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Secure Mode</Text>
            <Text style={styles.toggleDesc}>Mandatory biometrics & block transfer to new VPAs</Text>
          </View>
          <Switch value={secureMode} onValueChange={setSecureMode} trackColor={{ true: '#6366f1' }} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Family Guard Protection</Text>
            <Text style={styles.toggleDesc}>Require Guardian approval for transfers over ₹10,000</Text>
          </View>
          <Switch value={familyGuard} onValueChange={setFamilyGuard} trackColor={{ true: '#6366f1' }} />
        </View>
      </View>

      {/* 4. LINKED BANK ACCOUNTS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏦 Linked Bank Accounts (Mock)</Text>
        <View style={styles.bankRow}>
          <Text style={styles.bankName}>🏦 HDFC Bank •••• 4821</Text>
          <Text style={styles.primaryBadge}>PRIMARY</Text>
        </View>
        <View style={styles.bankRow}>
          <Text style={styles.bankName}>🏦 ICICI Bank •••• 9102</Text>
        </View>
      </View>

      {/* 5. WALLET & SESSION ACTIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Account & Session Management</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>🔄 Reset Demo Wallet to ₹1,00,000 SPC</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.resetBtn, styles.logoutBtn]} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Sign Out / Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F3EA', padding: 16 },
  profileHeader: { alignItems: 'center', backgroundColor: '#EFE7DA', borderRadius: 22, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#DCD1BF' },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(46, 139, 87, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#2E8B57' },
  avatarText: { fontSize: 32 },
  userName: { fontSize: 20, fontWeight: '900', color: '#181818', marginBottom: 6 },
  userVpa: { fontSize: 14, color: '#666666', marginTop: 2 },
  idPillContainer: { width: '100%', marginTop: 10, gap: 8 },
  idPill: { backgroundColor: '#F7F3EA', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#DCD1BF' },
  idPillTag: { fontSize: 10, fontWeight: '800', color: '#666666', letterSpacing: 0.5, marginBottom: 2 },
  idPillValue: { fontSize: 14, fontWeight: '900', color: '#181818' },
  simulatedPill: { marginTop: 12, backgroundColor: '#E5DCCB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#DCD1BF' },
  simulatedText: { fontSize: 11, fontWeight: '800', color: '#236847' },
  section: { backgroundColor: '#EFE7DA', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#DCD1BF' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#181818' },
  featuredBadge: { backgroundColor: 'rgba(46, 139, 87, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  featuredBadgeText: { fontSize: 9, fontWeight: '900', color: '#236847' },
  sectionSubtitle: { fontSize: 12, color: '#666666', lineHeight: 17, marginBottom: 12 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DCD1BF' },
  bankName: { fontSize: 14, fontWeight: '700', color: '#181818' },
  primaryBadge: { fontSize: 10, fontWeight: '800', color: '#2E8B57', backgroundColor: 'rgba(46, 139, 87, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DCD1BF' },
  toggleTitle: { fontSize: 14, fontWeight: '800', color: '#181818' },
  toggleDesc: { fontSize: 12, color: '#666666', marginTop: 2 },
  subSettingsContainer: { marginTop: 12, backgroundColor: '#F7F3EA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DCD1BF' },
  subSettingsLabel: { fontSize: 12, fontWeight: '800', color: '#181818', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E5DCCB', borderWidth: 1, borderColor: '#DCD1BF' },
  chipBtnActive: { backgroundColor: '#2E8B57', borderColor: '#2E8B57' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#181818' },
  chipTextActive: { color: '#FFFFFF' },
  resetBtn: { backgroundColor: 'rgba(192, 57, 43, 0.1)', borderWidth: 1, borderColor: '#C0392B', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  resetBtnText: { color: '#C0392B', fontSize: 14, fontWeight: '800' },
  logoutBtn: { backgroundColor: '#E5DCCB', borderColor: '#DCD1BF', marginTop: 12 },
  logoutBtnText: { color: '#181818', fontSize: 14, fontWeight: '800' },
});

