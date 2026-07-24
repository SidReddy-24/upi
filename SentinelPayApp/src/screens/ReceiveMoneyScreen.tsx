/**
 * ReceiveMoneyScreen — Receive Money QR screen with Set Amount & WhatsApp sharing.
 * Renders standard UPI QR code with pre-filled VPA, name, and optional custom amount.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Share, TextInput, Linking, Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getUser } from '../utils/walletDb';
import { WalletUser } from '../types';
import AppIcon from '../components/AppIcon';

export default function ReceiveMoneyScreen() {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showAmountInput, setShowAmountInput] = useState<boolean>(true);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const parsedAmount = parseFloat(customAmount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;

  const upiString = user
    ? validAmount
      ? `upi://pay?pa=${user.vpa}&pn=${encodeURIComponent(user.name)}&am=${validAmount}&cu=INR`
      : `upi://pay?pa=${user.vpa}&pn=${encodeURIComponent(user.name)}&cu=INR`
    : '';

  const shareText = user
    ? validAmount
      ? `👇 Pay ₹${validAmount.toLocaleString('en-IN')} to ${user.name} (${user.vpa}) via SentinelPay / UPI:\n\n` +
        `UPI ID: ${user.vpa}\n` +
        `Amount: ₹${validAmount.toLocaleString('en-IN')}\n\n` +
        `Click link to pay directly:\n${upiString}`
      : `👇 Pay ${user.name} (${user.vpa}) via SentinelPay / UPI:\n\n` +
        `UPI ID: ${user.vpa}\n\n` +
        `Click link to pay:\n${upiString}`
    : '';

  const handleShareWhatsApp = async () => {
    if (!user) return;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to system share
        await Share.share({ message: shareText });
      }
    } catch (error) {
      console.warn('[ReceiveMoney] WhatsApp launch failed, falling back to Share:', error);
      await Share.share({ message: shareText });
    }
  };

  const handleSystemShare = async () => {
    if (!user) return;
    try {
      await Share.share({
        title: `Pay ${user.name} via UPI`,
        message: shareText,
      });
    } catch (error) {
      console.error('[ReceiveMoney] Share error:', error);
    }
  };

  const addPresetAmount = (preset: number) => {
    const current = validAmount || 0;
    setCustomAmount(String(current + preset));
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Receive Payments</Text>
        <Text style={styles.subtitle}>Scan or Share QR code to request SPC</Text>

        {/* QR Code display */}
        <View style={styles.qrBox}>
          <QRCode
            value={upiString || 'upi://pay?pa=sentinelpay@spc'}
            size={210}
            color="#1A1A2E"
            backgroundColor="#ffffff"
          />
        </View>

        {/* Dynamic Amount Badge */}
        {validAmount ? (
          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>
              Requesting ₹{validAmount.toLocaleString('en-IN')}
            </Text>
            <TouchableOpacity onPress={() => setCustomAmount('')}>
              <Text style={styles.amountClear}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Set Amount Toggle / Section */}
        <View style={styles.setAmountCard}>
          <View style={styles.setAmountHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="coin" size={18} color="#2D6A4F" />
              <Text style={styles.setAmountTitle}>Set Payment Amount (Optional)</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAmountInput(!showAmountInput)}>
              <Text style={styles.toggleText}>{showAmountInput ? 'Hide' : 'Set Amount'}</Text>
            </TouchableOpacity>
          </View>

          {showAmountInput ? (
            <View style={styles.amountInputBox}>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount (e.g. 500)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                />
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                <TouchableOpacity style={styles.presetBtn} onPress={() => addPresetAmount(100)}>
                  <Text style={styles.presetBtnText}>+₹100</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => addPresetAmount(500)}>
                  <Text style={styles.presetBtnText}>+₹500</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => addPresetAmount(1000)}>
                  <Text style={styles.presetBtnText}>+₹1,000</Text>
                </TouchableOpacity>
                {customAmount ? (
                  <TouchableOpacity style={[styles.presetBtn, styles.clearPresetBtn]} onPress={() => setCustomAmount('')}>
                    <Text style={styles.clearPresetBtnText}>Reset</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* VPA and User Details */}
        <View style={styles.vpaBox}>
          <Text style={styles.vpaLabel}>Your UPI VPA</Text>
          <Text style={styles.vpa} selectable>{user.vpa}</Text>
        </View>

        <View style={styles.vpaBox}>
          <Text style={styles.vpaLabel}>Available Balance</Text>
          <Text style={styles.balance}>₹{user.balance.toLocaleString('en-IN')} SPC</Text>
        </View>

        {/* Sharing Options */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp}>
            <Text style={styles.whatsappBtnText}>🟢 WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareBtn} onPress={handleSystemShare}>
            <Text style={styles.shareBtnText}>🔗 Share Details</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          This QR follows standard UPI format (`upi://pay`). Scanners automatically pre-fill VPA
          {validAmount ? ` and amount ₹${validAmount}` : ''} for instant payment.
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
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    margin: 16, alignItems: 'center', width: '92%',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1e1b4b', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 18 },

  qrBox: {
    borderWidth: 3, borderColor: '#e0e7ff', borderRadius: 20,
    padding: 16, marginBottom: 14, backgroundColor: '#fff',
    shadowColor: '#6366f1', shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
  },

  amountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#e0e7ff', paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 20, marginBottom: 16,
  },
  amountBadgeText: { fontSize: 14, fontWeight: '800', color: '#4338ca' },
  amountClear: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  setAmountCard: {
    width: '100%', backgroundColor: '#f1f5f9', borderRadius: 14,
    padding: 14, marginBottom: 14,
  },
  setAmountHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  setAmountTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  toggleText: { fontSize: 13, fontWeight: '800', color: '#4f46e5' },

  amountInputBox: { marginTop: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12,
  },
  currencySymbol: { fontSize: 18, fontWeight: '800', color: '#4338ca', marginRight: 6 },
  amountInput: { flex: 1, height: 44, fontSize: 16, fontWeight: '700', color: '#0f172a' },

  presetsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  presetBtn: {
    backgroundColor: '#e2e8f0', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
  },
  presetBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  clearPresetBtn: { backgroundColor: '#fee2e2' },
  clearPresetBtnText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },

  vpaBox: {
    width: '100%', backgroundColor: '#f8fafc', borderRadius: 12,
    padding: 12, marginBottom: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  vpaLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  vpa: { fontSize: 17, fontWeight: '800', color: '#4f46e5' },
  balance: { fontSize: 18, fontWeight: '800', color: '#0f172a' },

  shareRow: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  whatsappBtn: {
    flex: 1, backgroundColor: '#25D366', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  whatsappBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  shareBtn: {
    flex: 1, backgroundColor: '#4f46e5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  note: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16, lineHeight: 16,
  },
});
