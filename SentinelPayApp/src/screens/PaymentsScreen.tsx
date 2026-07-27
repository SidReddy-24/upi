/**
 * PaymentsScreen — Payment hub for the 💸 Payments bottom tab.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, RefreshControl, StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletUser, WalletTransaction } from '../types';
import { getUser, getTransactions, subscribeWallet } from '../utils/walletDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Payments'> };

function formatAmount(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

export default function PaymentsScreen({ navigation }: Props) {
  const [user, setUser] = useState<WalletUser | null>(null);
  const [recentTxns, setRecentTxns] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [u, txns] = await Promise.all([getUser(), getTransactions()]);
    setUser(u);
    setRecentTxns(txns.slice(0, 5));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const unsub = subscribeWallet(() => load());
    return () => unsub();
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const quickActions = [
    { label: 'Send', icon: 'send' as const, color: '#EF4444', bg: '#FEF2F2', onPress: () => navigation.navigate('SendMoney', {}) },
    { label: 'Receive', icon: 'receive' as const, color: '#10B981', bg: '#ECFDF5', onPress: () => navigation.navigate('ReceiveMoney') },
    { label: 'Scan QR', icon: 'qr' as const, color: '#7C3AED', bg: '#F5F3FF', onPress: () => navigation.navigate('ScanQR') },
    { label: 'History', icon: 'history' as const, color: '#2563EB', bg: '#EFF6FF', onPress: () => navigation.navigate('TransactionHistory') },
  ];

  const paymentLinks = [
    { label: 'Transaction History', sub: 'View all past payments', icon: 'history' as const, iconColor: '#2563EB', iconBg: '#EFF6FF', onPress: () => navigation.navigate('TransactionHistory') },
    { label: 'Send Money', sub: 'Transfer to any UPI ID', icon: 'send' as const, iconColor: '#EF4444', iconBg: '#FEF2F2', onPress: () => navigation.navigate('SendMoney', {}) },
    { label: 'Receive Money', sub: 'Share your QR or UPI ID', icon: 'receive' as const, iconColor: '#10B981', iconBg: '#ECFDF5', onPress: () => navigation.navigate('ReceiveMoney') },
    { label: 'Scan & Pay', sub: 'Scan merchant or contact QR', icon: 'qr' as const, iconColor: '#7C3AED', iconBg: '#F5F3FF', onPress: () => navigation.navigate('ScanQR') },
  ];

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <View>
          <Text style={[DS.label, { color: C.green }]}>SENTINELPAY</Text>
          <Text style={DS.pageTitle}>Payments</Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: C.greenBg }]}>
          <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: C.green }}>
            {user ? '₹' + user.balance.toLocaleString('en-IN') : '—'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[DS.scrollContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
      >
        <View style={[DS.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          {quickActions.map(action => (
            <TouchableOpacity key={action.label} style={styles.quickAction} onPress={action.onPress} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                <AppIcon name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={DS.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={DS.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')} activeOpacity={0.7}>
              <Text style={{ fontSize: T.sm, fontWeight: T.bold, color: C.blue }}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentTxns.length === 0 ? (
            <View style={{ paddingVertical: S.lg, alignItems: 'center' }}>
              <AppIcon name="history" size={32} color={C.textTertiary} />
              <Text style={[DS.emptyTitle, { marginTop: S.sm }]}>No Transactions Yet</Text>
              <Text style={DS.emptySub}>Your recent payments will appear here.</Text>
            </View>
          ) : (
            recentTxns.map(txn => (
              <TouchableOpacity key={txn.id} style={styles.txnRow} onPress={() => navigation.navigate('TransactionDetail', { txnId: txn.id })} activeOpacity={0.7}>
                <View style={[styles.txnIcon, { backgroundColor: txn.type === 'DEBIT' ? '#FEF2F2' : '#ECFDF5' }]}>
                  <AppIcon name={txn.type === 'DEBIT' ? 'send' : 'receive'} size={18} color={txn.type === 'DEBIT' ? '#EF4444' : '#10B981'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnVpa} numberOfLines={1}>{txn.type === 'DEBIT' ? `To: ${txn.receiver_vpa}` : `From: ${txn.sender_vpa}`}</Text>
                  <Text style={styles.txnTime}>{formatTime(txn.created_at)}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'DEBIT' ? '#EF4444' : '#10B981' }]}>
                  {txn.type === 'DEBIT' ? '-' : '+'}{'₹' + txn.amount.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={[DS.sectionTitle, { marginTop: S.sm }]}>Payment Options</Text>
        {paymentLinks.map(item => (
          <TouchableOpacity key={item.label} style={DS.rowCard} onPress={item.onPress} activeOpacity={0.7}>
            <View style={[DS.iconMd, { backgroundColor: item.iconBg, marginRight: S.sm }]}>
              <AppIcon name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>{item.label}</Text>
              <Text style={DS.cardSub}>{item.sub}</Text>
            </View>
            <AppIcon name="chevronRight" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: T.xs, fontWeight: T.bold, color: C.textSecondary, textAlign: 'center' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.border, gap: S.sm },
  txnIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnVpa: { fontSize: T.sm, fontWeight: T.semibold, color: C.textPrimary },
  txnTime: { fontSize: T.xs, color: C.textTertiary, marginTop: 2 },
  txnAmount: { fontSize: T.sm, fontWeight: T.bold },
});
