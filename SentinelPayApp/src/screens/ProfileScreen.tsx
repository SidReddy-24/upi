import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUser, resetWallet } from '../utils/walletDb';
import { WalletUser, RootStackParamList } from '../types';
import { authService } from '../services/authService';
import unifiedAuthService from '../services/unifiedAuthService';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';


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
              routes: [{ name: 'AuthModeSelector' }],
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
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>

        <View style={styles.idPillContainer}>
          <View style={styles.idPill}>
            <Text style={styles.idPillTag}>🆔 UNIQUE USER ID</Text>
            <Text style={styles.idPillValue}>USR_{user.vpa.split('@')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.idPill}>
            <Text style={styles.idPillTag}>💳 UNIQUE UPI ID</Text>
            <Text style={styles.idPillValue}>{user.vpa}</Text>
          </View>
        </View>

        <View style={styles.simulatedPill}>
          <Text style={styles.simulatedText}>🧪 SIMULATED SPC ACCOUNT</Text>
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
        <Text style={styles.sectionTitle}>🛡️ Security & Family Protection</Text>
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
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  profileHeader: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16, elevation: 2 },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32 },
  userName: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  userVpa: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  idPillContainer: { width: '100%', marginTop: 10, gap: 8 },
  idPill: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  idPillTag: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, marginBottom: 2 },
  idPillValue: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  simulatedPill: { marginTop: 12, backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  simulatedText: { fontSize: 11, fontWeight: '800', color: '#92400e' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  featuredBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  featuredBadgeText: { fontSize: 9, fontWeight: '900', color: '#4f46e5' },
  sectionSubtitle: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 12 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  bankName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  primaryBadge: { fontSize: 10, fontWeight: '800', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  toggleDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  subSettingsContainer: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  subSettingsLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e2e8f0' },
  chipBtnActive: { backgroundColor: '#6366f1' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#ffffff' },
  resetBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  resetBtnText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
  logoutBtn: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', marginTop: 12 },
  logoutBtnText: { color: '#475569', fontSize: 14, fontWeight: '700' },
});

