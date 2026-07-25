/**
 * ReceiveMoneyScreen — Receive Money QR screen with Set Amount & WhatsApp sharing.
 * Renders standard UPI QR code with pre-filled VPA, name, and optional custom amount.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Share, TextInput, Linking, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { getUser } from '../utils/walletDb';
import { WalletUser, RootStackParamList } from '../types';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReceiveMoney'>;
};

export default function ReceiveMoneyScreen({ navigation }: Props) {
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
      <SafeAreaView style={DS.safeArea}>
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Standard Child Screen Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Receive Money</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={DS.cardLg}>
          <Text style={[DS.cardTitle, { textAlign: 'center', fontSize: T.xl }]}>Receive Payments</Text>
          <Text style={[DS.cardSub, { textAlign: 'center', marginBottom: S.lg }]}>Scan or share QR code to request credits</Text>

          {/* QR Code display */}
          <View style={styles.qrBox}>
            <QRCode
              value={upiString || 'upi://pay?pa=sentinelpay@spc'}
              size={200}
              color={C.dark}
              backgroundColor="#FFFFFF"
            />
          </View>

          {/* Dynamic Amount Badge */}
          {validAmount ? (
            <View style={[DS.pillBadge, { backgroundColor: C.blueBg, marginBottom: S.base }]}>
              <Text style={{ fontSize: T.sm, fontWeight: T.bold, color: C.blue }}>
                Requesting ₹{validAmount.toLocaleString('en-IN')}
              </Text>
              <TouchableOpacity onPress={() => setCustomAmount('')}>
                <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: C.red, marginLeft: S.xs }}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Set Amount Toggle / Section */}
          <View style={[DS.infoCard, { flexDirection: 'column', width: '100%', marginBottom: S.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <AppIcon name="coin" size={18} color={C.green} />
                <Text style={DS.cardTitle}>Set Amount (Optional)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAmountInput(!showAmountInput)}>
                <Text style={DS.seeAll}>{showAmountInput ? 'Hide' : 'Set Amount'}</Text>
              </TouchableOpacity>
            </View>

            {showAmountInput ? (
              <View style={{ width: '100%', marginTop: S.md }}>
                <View style={DS.inputWrapper}>
                  <Text style={{ fontSize: T.lg, fontWeight: T.bold, color: C.green, marginRight: S.xs }}>₹</Text>
                  <TextInput
                    style={DS.input}
                    placeholder="Enter amount (e.g. 500)"
                    placeholderTextColor={C.textTertiary}
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                  />
                </View>

                {/* Quick Presets */}
                <View style={{ flexDirection: 'row', gap: S.xs, marginTop: S.xs }}>
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
                    <TouchableOpacity style={[styles.presetBtn, { backgroundColor: C.redBg }]} onPress={() => setCustomAmount('')}>
                      <Text style={[styles.presetBtnText, { color: C.red }]}>Reset</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          {/* VPA and User Details */}
          <View style={[DS.rowCard, { width: '100%', marginBottom: S.xs }]}>
            <View style={[DS.iconSm, { backgroundColor: C.surfaceAlt }]}>
              <AppIcon name="profile" size={18} color={C.dark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardSub}>Your UPI VPA</Text>
              <Text style={[DS.cardTitle, { color: C.blue }]} selectable>{user.vpa}</Text>
            </View>
          </View>

          <View style={[DS.rowCard, { width: '100%', marginBottom: S.lg }]}>
            <View style={[DS.iconSm, { backgroundColor: C.greenBg }]}>
              <AppIcon name="shieldCheck" size={18} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardSub}>Available Balance</Text>
              <Text style={DS.cardTitle}>₹{user.balance.toLocaleString('en-IN')} SPC</Text>
            </View>
          </View>

          {/* Sharing Options */}
          <View style={{ flexDirection: 'row', gap: S.md, width: '100%' }}>
            <TouchableOpacity style={[DS.btn, { flex: 1, backgroundColor: '#25D366' }]} onPress={handleShareWhatsApp} activeOpacity={0.7}>
              <Text style={DS.btnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[DS.btn, DS.btnPrimary, { flex: 1 }]} onPress={handleSystemShare} activeOpacity={0.7}>
              <AppIcon name="externalLink" size={18} color={C.textInverse} />
              <Text style={DS.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[DS.pageSub, { textAlign: 'center', marginTop: S.sm }]}>
          Supports all standard UPI applications (`upi://pay` protocol).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  qrBox: {
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: R.card,
    padding: S.base,
    marginBottom: S.base,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  presetBtn: {
    backgroundColor: C.surface,
    borderRadius: R.xs,
    paddingVertical: S.xs,
    paddingHorizontal: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  presetBtnText: {
    fontSize: T.xs,
    fontWeight: T.bold,
    color: C.textPrimary,
  },
});
