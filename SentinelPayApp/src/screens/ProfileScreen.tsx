import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { getUser, resetWallet } from '../utils/walletDb';
import { WalletUser } from '../types';

export default function ProfileScreen() {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [secureMode, setSecureMode] = useState(false);
  const [familyGuard, setFamilyGuard] = useState(true);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

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
      <View style={styles.profileHeader}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userVpa}>{user.vpa}</Text>
        <View style={styles.simulatedPill}>
          <Text style={styles.simulatedText}>🧪 SIMULATED SPC ACCOUNT</Text>
        </View>
      </View>

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Wallet Tools & Reset</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>🔄 Reset Demo Wallet to ₹1,00,000 SPC</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  profileHeader: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16, elevation: 2 },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32 },
  userName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  userVpa: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  simulatedPill: { marginTop: 10, backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  simulatedText: { fontSize: 11, fontWeight: '800', color: '#92400e' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  bankName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  primaryBadge: { fontSize: 10, fontWeight: '800', color: '#16a34a', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  toggleDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  resetBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  resetBtnText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
});
