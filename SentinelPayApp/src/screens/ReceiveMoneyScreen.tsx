/**
 * ReceiveMoneyScreen — shows user's VPA and a QR code to receive money.
 * Uses react-native-qrcode-svg to render the UPI QR.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getUser } from '../utils/walletDb';
import { WalletUser } from '../types';

export default function ReceiveMoneyScreen() {
  const [user, setUser] = useState<WalletUser | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const upiString = user
    ? `upi://pay?pa=${user.vpa}&pn=${encodeURIComponent(user.name)}&cu=INR`
    : '';

  const handleShare = async () => {
    if (!user) return;
    await Share.share({
      message: `Pay me via UPI: ${user.vpa}\n(SentinelPay — Demo Wallet)`,
    });
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.simulatedBanner}>
        <Text style={styles.simulatedText}>🧪 SIMULATED — Not real money</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Receive SPC</Text>
        <Text style={styles.subtitle}>Share your VPA or QR code</Text>

        {/* QR Code */}
        <View style={styles.qrBox}>
          <QRCode
            value={upiString}
            size={200}
            color="#111827"
            backgroundColor="#fff"
            logo={undefined}
          />
        </View>

        {/* VPA display */}
        <View style={styles.vpaBox}>
          <Text style={styles.vpaLabel}>Your UPI ID</Text>
          <Text style={styles.vpa} selectable>{user.vpa}</Text>
        </View>

        <View style={styles.vpaBox}>
          <Text style={styles.vpaLabel}>Balance</Text>
          <Text style={styles.balance}>₹{user.balance.toLocaleString('en-IN')} SPC</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share VPA</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          This QR follows UPI format but uses simulated SentinelPay Credits (SPC).
          No real money is transferred.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: '#f8fafc', alignItems: 'center', paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  simulatedBanner: {
    width: '100%', backgroundColor: '#fef3c7', paddingVertical: 8,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  simulatedText: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    margin: 16, alignItems: 'center', width: '92%',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20 },

  qrBox: {
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 16,
    padding: 16, marginBottom: 20,
  },

  vpaBox: {
    width: '100%', backgroundColor: '#f8fafc', borderRadius: 10,
    padding: 14, marginBottom: 10, alignItems: 'center',
  },
  vpaLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  vpa: { fontSize: 18, fontWeight: '700', color: '#6366f1' },
  balance: { fontSize: 20, fontWeight: '800', color: '#111827' },

  shareBtn: {
    backgroundColor: '#6366f1', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, marginTop: 8,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  note: {
    fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
});
