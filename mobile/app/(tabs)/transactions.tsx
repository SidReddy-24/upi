import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Colors, riskColor, decisionColor, decisionBg, RiskDecision } from "../../constants/Colors";
import { fetchAnalytics, scoreTransaction } from "../../services/api";

// ── Generate live mock scored txns for demo ───────────────────────
const SENDERS = [
  "rahul.sharma@upi", "amit.patel@upi", "priya.nair@upi",
  "vikram.singh@upi", "deepa.rao@upi", "ankit.gupta@upi",
];
const RECEIVERS = [
  "grocerymart@paytm", "mom@upi", "landlord@ybl",
  "mule_account@upi", "recharge@jio", "netflix@hdfc",
];

function generateMockTransaction(id: number) {
  const rnd = Math.random();
  const amount = Math.round(rnd * 45000 + 100);
  const isFraud = rnd < 0.04;
  const isReview = !isFraud && rnd < 0.10;
  const risk = isFraud ? 0.75 + rnd * 0.24 : isReview ? 0.35 + rnd * 0.4 : rnd * 0.3;
  const decision: RiskDecision = isFraud ? "REJECT" : isReview ? "REVIEW" : "APPROVE";

  return {
    transaction_id: `TXN_DEMO_${Date.now()}_${id}`,
    sender_vpa: SENDERS[id % SENDERS.length],
    receiver_vpa: isFraud ? "mule_account@upi" : RECEIVERS[id % RECEIVERS.length],
    amount,
    risk_score: parseFloat(risk.toFixed(4)),
    decision,
    latency_ms: Math.floor(60 + rnd * 120),
    created_at: new Date().toISOString(),
    reasons: isFraud ? ["BLACKLISTED_RECEIVER", "HIGH_VELOCITY"] : [],
  };
}

// ── Decision chip ─────────────────────────────────────────────────
function DecisionChip({ decision }: { decision: RiskDecision }) {
  return (
    <View style={[styles.chip, { backgroundColor: decisionBg(decision), borderColor: decisionColor(decision) }]}>
      <Text style={[styles.chipText, { color: decisionColor(decision) }]}>{decision}</Text>
    </View>
  );
}

// ── Risk Score Badge ──────────────────────────────────────────────
function RiskBadge({ score }: { score: number }) {
  const color = riskColor(score);
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{(score * 100).toFixed(0)}%</Text>
    </View>
  );
}

// ── Transaction Row ───────────────────────────────────────────────
function TxnRow({ item }: { item: any }) {
  const handlePress = () => {
    router.push(`/investigation/${item.transaction_id}` as any);
  };

  return (
    <Pressable style={styles.txnRow} onPress={handlePress}>
      <View style={styles.txnLeft}>
        <Text style={styles.txnSender} numberOfLines={1}>{item.sender_vpa}</Text>
        <Text style={styles.txnReceiver} numberOfLines={1}>→ {item.receiver_vpa}</Text>
        {item.reasons?.length > 0 && (
          <Text style={styles.txnReason} numberOfLines={1}>⚠ {item.reasons[0].replace(/_/g, " ")}</Text>
        )}
      </View>
      <View style={styles.txnRight}>
        <Text style={styles.txnAmount}>₹{item.amount?.toLocaleString("en-IN")}</Text>
        <RiskBadge score={item.risk_score} />
        <DecisionChip decision={item.decision} />
        <Text style={styles.txnLatency}>{item.latency_ms}ms</Text>
      </View>
    </Pressable>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────
type Filter = "ALL" | "APPROVE" | "REVIEW" | "REJECT";
const FILTERS: Filter[] = ["ALL", "APPROVE", "REVIEW", "REJECT"];

export default function TransactionsScreen() {
  const [txns, setTxns]         = useState<any[]>([]);
  const [filter, setFilter]     = useState<Filter>("ALL");
  const [minRisk, setMinRisk]   = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [counter, setCounter]   = useState(0);

  // Simulate live feed by generating new transactions every 2s
  useEffect(() => {
    const interval = setInterval(() => {
      const newTxn = generateMockTransaction(Math.floor(Math.random() * 1000));
      setTxns(prev => [newTxn, ...prev].slice(0, 100));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Seed initial batch
  useEffect(() => {
    const initial = Array.from({ length: 20 }, (_, i) => generateMockTransaction(i));
    setTxns(initial);
  }, []);

  const filtered = txns.filter(t => {
    if (filter !== "ALL" && t.decision !== filter) return false;
    if (minRisk && t.risk_score < parseFloat(minRisk)) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: Colors.accent.primary }]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Min risk score (0–1)"
          placeholderTextColor={Colors.text.tertiary}
          value={minRisk}
          onChangeText={setMinRisk}
          keyboardType="decimal-pad"
        />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.transaction_id}
        renderItem={({ item }) => <TxnRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Colors.accent.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Waiting for transactions...</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg.app },
  filterBar:   { flexDirection: "row", backgroundColor: Colors.bg.surface, borderBottomWidth: 1, borderBottomColor: Colors.bg.border },
  filterBtn:   { flex: 1, paddingVertical: 12, alignItems: "center" },
  filterBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.accent.primary },
  filterText:  { fontSize: 12, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase" },

  searchRow:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: Colors.bg.surface, borderBottomWidth: 1, borderBottomColor: Colors.bg.border },
  searchInput: { flex: 1, backgroundColor: Colors.bg.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: Colors.text.primary, fontSize: 13 },
  livePill:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.risk.approveBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.risk.approve },
  liveText:    { fontSize: 10, fontWeight: "800", color: Colors.risk.approve, letterSpacing: 1.5 },

  txnRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bg.app },
  txnLeft:     { flex: 1, gap: 2 },
  txnSender:   { fontSize: 14, fontWeight: "700", color: Colors.text.primary },
  txnReceiver: { fontSize: 12, color: Colors.text.secondary },
  txnReason:   { fontSize: 11, color: Colors.risk.review, marginTop: 2 },
  txnRight:    { alignItems: "flex-end", gap: 4 },
  txnAmount:   { fontSize: 15, fontWeight: "800", color: Colors.text.primary },
  txnLatency:  { fontSize: 10, color: Colors.text.tertiary },

  badge:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:   { fontSize: 12, fontWeight: "800" },
  chip:        { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  chipText:    { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  separator:   { height: 1, backgroundColor: Colors.bg.border, marginLeft: 16 },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText:   { color: Colors.text.tertiary, fontSize: 14 },
});
