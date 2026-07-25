/**
 * TransactionHistoryScreen — full list of all wallet transactions.
 * Shows amount, VPA, timestamp, risk score badge.
 * Tapping a row navigates to TransactionDetail.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, StatusBar, SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactions, getUser, syncCloudTransactions } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import RiskBadge from '../components/RiskBadge';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'TransactionHistory'> };

function formatTime(iso: string) {
  const d = parseSafeDate(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatAmount(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function statusColor(status: string) {
  switch (status) {
    case 'APPROVED': return C.green;
    case 'REJECTED': return C.red;
    case 'REVIEW':   return C.amber;
    default:         return C.textSecondary;
  }
}

export default function TransactionHistoryScreen({ navigation }: Props) {
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const user = await getUser();
    let data = await getTransactions();
    setTxns(data);

    if (user && user.vpa) {
      const synced = await syncCloudTransactions(user.vpa);
      setTxns(synced);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: WalletTransaction }) => (
    <TouchableOpacity
      style={DS.rowCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('TransactionDetail', { txnId: item.id })}>
      {/* left icon */}
      <View style={[DS.iconMd, { backgroundColor: item.type === 'DEBIT' ? C.redBg : C.greenBg }]}>
        <AppIcon name={item.type === 'DEBIT' ? 'send' : 'receive'} size={20} color={item.type === 'DEBIT' ? C.red : C.green} />
      </View>

      {/* middle info */}
      <View style={{ flex: 1, paddingRight: S.xs }}>
        <Text style={DS.cardTitle} numberOfLines={1}>
          {item.type === 'DEBIT' ? `To: ${item.receiver_vpa}` : `From: ${item.sender_vpa}`}
        </Text>
        <Text style={DS.cardSub}>{formatTime(item.created_at)}</Text>
        <Text style={{ fontSize: T.xs, fontWeight: T.bold, color: statusColor(item.status), marginTop: 2 }}>
          {item.status}
        </Text>
      </View>

      {/* right amount + badge */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: T.md, fontWeight: T.extrabold, color: item.type === 'DEBIT' ? C.red : C.green }}>
          {item.type === 'DEBIT' ? '-' : '+'}{formatAmount(item.amount)}
        </Text>
        {item.decision && item.risk_score != null && (
          <View style={{ marginTop: 4 }}>
            <RiskBadge decision={item.decision} riskScore={item.risk_score} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const ListEmpty = () => (
    <View style={DS.emptyCard}>
      <AppIcon name="history" size={40} color={C.textTertiary} />
      <Text style={DS.emptyTitle}>No Transactions Yet</Text>
      <Text style={DS.emptySub}>Your real-time payment history will appear here.</Text>
    </View>
  );

  const ListHeader = () =>
    txns.length > 0 ? (
      <View style={DS.statsRow}>
        <View style={DS.statCard}>
          <Text style={DS.statNum}>{txns.length}</Text>
          <Text style={DS.statLabel}>Total</Text>
        </View>
        <View style={DS.statCard}>
          <Text style={[DS.statNum, { color: C.green }]}>
            {txns.filter(t => t.decision === 'APPROVE').length}
          </Text>
          <Text style={DS.statLabel}>Approved</Text>
        </View>
        <View style={DS.statCard}>
          <Text style={[DS.statNum, { color: C.amber }]}>
            {txns.filter(t => t.decision === 'REVIEW').length}
          </Text>
          <Text style={DS.statLabel}>Reviewed</Text>
        </View>
        <View style={DS.statCard}>
          <Text style={[DS.statNum, { color: C.red }]}>
            {txns.filter(t => t.decision === 'REJECT').length}
          </Text>
          <Text style={DS.statLabel}>Blocked</Text>
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {/* Standard Child Screen Header */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Transaction History</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={txns}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={DS.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
        }
      />
    </SafeAreaView>
  );
}
