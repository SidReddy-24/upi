/**
 * TransactionHistoryScreen — full list of all wallet transactions.
 * Shows amount, VPA, timestamp, risk score badge.
 * Tapping a row navigates to TransactionDetail.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, WalletTransaction } from '../types';
import { getTransactions, getUser, syncCloudTransactions } from '../utils/walletDb';
import { parseSafeDate } from '../utils/parsers';
import RiskBadge from '../components/RiskBadge';

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
    case 'APPROVED': return '#2D6A4F';
    case 'REJECTED': return '#E63946';
    case 'REVIEW':   return '#F4A261';
    default:         return '#64748b';
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
      style={styles.row}
      onPress={() => navigation.navigate('TransactionDetail', { txnId: item.id })}>
      {/* left icon */}
      <View style={[styles.icon, { backgroundColor: item.type === 'DEBIT' ? '#FEE2E2' : '#D1FAE5' }]}>
        <Text style={[styles.iconText, { color: item.type === 'DEBIT' ? '#E63946' : '#2D6A4F' }]}>
          {item.type === 'DEBIT' ? '↑' : '↓'}
        </Text>
      </View>

      {/* middle info */}
      <View style={styles.info}>
        <Text style={styles.vpa} numberOfLines={1}>
          {item.type === 'DEBIT' ? `To: ${item.receiver_vpa}` : `From: ${item.sender_vpa}`}
        </Text>
        <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        <Text style={[styles.statusLabel, { color: statusColor(item.status) }]}>
          {item.status}
        </Text>
      </View>

      {/* right amount + badge */}
      <View style={styles.right}>
        <Text style={[styles.amount, { color: item.type === 'DEBIT' ? '#E63946' : '#2D6A4F' }]}>
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
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySub}>Your payment history will appear here</Text>
    </View>
  );

  const ListHeader = () =>
    txns.length > 0 ? (
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{txns.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {txns.filter(t => t.decision === 'APPROVE').length}
          </Text>
          <Text style={[styles.statLabel, { color: '#2D6A4F' }]}>Approved</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {txns.filter(t => t.decision === 'REVIEW').length}
          </Text>
          <Text style={[styles.statLabel, { color: '#F4A261' }]}>Reviewed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {txns.filter(t => t.decision === 'REJECT').length}
          </Text>
          <Text style={[styles.statLabel, { color: '#E63946' }]}>Blocked</Text>
        </View>
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F0" />
      <FlatList
        data={txns}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF7F0' },
  list: { padding: 16, paddingBottom: 32 },

  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    marginBottom: 16, shadowColor: '#1A1A2E', shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#E8C4B8',
  },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    marginBottom: 10, shadowColor: '#1A1A2E', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: '#E8C4B8',
  },
  icon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  iconText: { fontSize: 20, fontWeight: '700' },
  info: { flex: 1, paddingRight: 8 },
  vpa: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  emptySub: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
});

