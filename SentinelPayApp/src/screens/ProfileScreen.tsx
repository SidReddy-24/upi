import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUser, resetWallet } from '../utils/walletDb';
import { WalletUser, RootStackParamList } from '../types';
import { authService } from '../services/authService';
import unifiedAuthService from '../services/unifiedAuthService';
import { getSettings, updateSettings, UserSettings } from '../utils/settingsDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'>;
};

export default function ProfileScreen({ navigation }: Props) {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [secureMode, setSecureMode] = useState(false);
  const [familyGuard, setFamilyGuard] = useState(true);

  // Settings state for Safety Hold Timer
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

  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (isResetting) return;

    Alert.alert(
      'Reset Demo Wallet?',
      'This will reset your demo wallet balance, transactions, and related demo data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Wallet',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetWallet();
              const refreshed = await getUser();
              setUser(refreshed);
              Alert.alert(
                '✓ Wallet Reset Successfully',
                'Your demo wallet has been restored.'
              );
            } catch (e: any) {
              console.error('Reset Wallet Error:', e);
              Alert.alert(
                'Reset Failed',
                'Failed to reset demo wallet. Please try again.'
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <Text style={DS.pageTitle}>Profile & Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. USER PROFILE HERO CARD */}
        <View style={DS.cardLg}>
          <View style={{ alignItems: 'center', marginBottom: S.md }}>
            <View style={[DS.iconLg, { backgroundColor: C.dark, marginBottom: S.xs }]}>
              <AppIcon name="profile" size={32} color={C.textInverse} />
            </View>
            <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textPrimary }}>{user.name}</Text>
            <View style={[DS.pillBadge, { backgroundColor: C.greenBg, marginTop: S.xs }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>VERIFIED SENTINEL ACCOUNT</Text>
            </View>
          </View>

          <View style={{ gap: S.xs }}>
            <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
              <Text style={DS.label}>PHONE NUMBER</Text>
              <Text style={DS.cardTitle}>{user.phone || user.id}</Text>
            </View>

            {user.dob ? (
              <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
                <Text style={DS.label}>DATE OF BIRTH</Text>
                <Text style={DS.cardTitle}>{user.dob}</Text>
              </View>
            ) : null}

            <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
              <Text style={DS.label}>UPI VPA ADDRESS</Text>
              <Text style={DS.cardTitle}>{user.vpa}</Text>
            </View>
          </View>
        </View>

        {/* 2. PAYMENT SAFETY DELAY & COOLDOWN TIMER */}
        <View style={DS.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
            <Text style={DS.cardTitle}>⏱️ Payment Delay & Safety Hold</Text>
            <View style={[DS.pillBadge, { backgroundColor: C.blueBg }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.blue }}>FEATURED</Text>
            </View>
          </View>

          <Text style={[DS.cardSub, { marginBottom: S.md }]}>
            After entering your UPI PIN, a safety delay countdown runs before money leaves your account. This gives you time to cancel if you are being coerced or scammed.
          </Text>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Enable Safety Delay Timer</Text>
              <Text style={DS.cardSub}>
                {settings?.holdEnabled ? 'Active — Payment will hold before finalizing' : 'Disabled — Instant payment execution'}
              </Text>
            </View>
            <Switch
              value={settings?.holdEnabled ?? false}
              onValueChange={handleToggleHold}
              trackColor={{ true: C.green, false: C.border }}
            />
          </View>

          {settings?.holdEnabled && (
            <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, flexDirection: 'column', alignItems: 'stretch', gap: S.sm }]}>
              <Text style={DS.label}>TIMER DURATION (SECONDS)</Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {[10, 15, 30, 60].map(dur => {
                  const isActive = settings.holdDuration === dur;
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[DS.chip, isActive && { backgroundColor: C.dark }]}
                      onPress={() => handleSelectDuration(dur)}
                      activeOpacity={0.7}
                    >
                      <Text style={[DS.chipText, isActive && { color: C.textInverse }]}>
                        {dur}s
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[DS.label, { marginTop: S.xs }]}>TRIGGER DELAY FOR PAYMENTS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
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
                      style={[DS.chip, isActive && { backgroundColor: C.dark }]}
                      onPress={() => handleSelectThreshold(item.val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[DS.chipText, isActive && { color: C.textInverse }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* 3. SECURITY & FAMILY GUARD */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Security & Protection</Text>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Secure Mode</Text>
              <Text style={DS.cardSub}>Mandatory biometrics & block transfer to new VPAs</Text>
            </View>
            <Switch value={secureMode} onValueChange={setSecureMode} trackColor={{ true: C.green }} />
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Family Guard Protection</Text>
              <Text style={DS.cardSub}>Require Guardian approval for transfers over ₹10,000</Text>
            </View>
            <Switch value={familyGuard} onValueChange={setFamilyGuard} trackColor={{ true: C.green }} />
          </View>
        </View>

        {/* 4. LINKED BANK ACCOUNTS */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Linked Bank Accounts (Mock)</Text>
          <View style={[DS.rowCard, { marginBottom: S.xs }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>HDFC Bank •••• 4821</Text>
              <Text style={DS.cardSub}>Savings Account</Text>
            </View>
            <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>PRIMARY</Text>
            </View>
          </View>
          <View style={DS.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>ICICI Bank •••• 9102</Text>
              <Text style={DS.cardSub}>Secondary Account</Text>
            </View>
          </View>
        </View>

        {/* 5. ACCOUNT ACTIONS */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Account & Session</Text>
          <TouchableOpacity
            style={[DS.btn, DS.btnOutline, { marginBottom: S.sm, opacity: isResetting ? 0.6 : 1 }]}
            onPress={handleReset}
            disabled={isResetting}
            activeOpacity={0.7}
          >
            {isResetting ? (
              <ActivityIndicator color={C.dark} size="small" />
            ) : (
              <Text style={DS.btnTextDark}>Reset Demo Wallet to ₹1,00,000 SPC</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[DS.btn, DS.btnDanger]} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={DS.btnText}>Sign Out / Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
