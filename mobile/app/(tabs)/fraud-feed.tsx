import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl
} from "react-native";
import { router } from "expo-router";
import { Colors, riskColor, decisionColor, decisionBg, RiskDecision } from "../../constants/Colors";

interface FraudAlert {
  transaction_id: string;
  sender_vpa: string;
  receiver_vpa: string;
  amount: number;
  risk_score: number;
  decision: RiskDecision;
  reasons: string[];
  time_ago: string;
}

const MOCK_ALERTS: FraudAlert[] = [
  {
    transaction_id: "TXN_RING_015",
    sender_vpa: "ring_sender_15@upi",
    receiver_vpa: "mule_account@upi",
    amount: 12500,
    risk_score: 0.96,
    decision: "REJECT",
    reasons: ["BLACKLISTED_RECEIVER", "FRAUD_NETWORK_PROXIMITY"],
    time_ago: "2 min ago"
  },
  {
    transaction_id: "TXN_ATO_992",
    sender_vpa: "rahul.sharma@upi",
    receiver_vpa: "unknown_merchant@paytm",
    amount: 49500,
    risk_score: 0.92,
    decision: "REJECT",
    reasons: ["NEW_DEVICE", "IMPOSSIBLE_TRAVEL", "EXTREME_AMOUNT"],
    time_ago: "14 min ago"
  },
  {
    transaction_id: "TXN_VEL_551",
    sender_vpa: "amit.patel@upi",
    receiver_vpa: "mom@upi",
    amount: 9800,
    risk_score: 0.81,
    decision: "REJECT",
    reasons: ["HIGH_VELOCITY", "AMOUNT_JUST_BELOW_LIMIT"],
    time_ago: "45 min ago"
  },
  {
    transaction_id: "TXN_REV_112",
    sender_vpa: "priya.nair@upi",
    receiver_vpa: "suspicious_store@upi",
    amount: 32000,
    risk_score: 0.65,
    decision: "REVIEW",
    reasons: ["UNUSUAL_AMOUNT", "NEW_RECEIVER"],
    time_ago: "1 hour ago"
  }
];

export default function FraudFeedScreen() {
  const [alerts, setAlerts] = useState<FraudAlert[]>(MOCK_ALERTS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate reloading
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleAlertPress = (id: string) => {
    router.push(`/investigation/${id}` as any);
  };

  const renderItem = ({ item }: { item: FraudAlert }) => {
    const scoreColor = riskColor(item.risk_score);
    return (
      <Pressable style={styles.alertCard} onPress={() => handleAlertPress(item.transaction_id)}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.txnId}>{item.transaction_id}</Text>
            <Text style={styles.timeAgo}>{item.time_ago}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: scoreColor + "22", borderColor: scoreColor }]}>
            <Text style={[styles.badgeText, { color: scoreColor }]}>{(item.risk_score * 100).toFixed(0)}% RISK</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.pathText}><Text style={styles.bold}>From:</Text> {item.sender_vpa}</Text>
          <Text style={styles.pathText}><Text style={styles.bold}>To:</Text> {item.receiver_vpa}</Text>
          <Text style={styles.amountText}>Amount: ₹{item.amount.toLocaleString("en-IN")}</Text>

          <View style={styles.reasonsContainer}>
            {item.reasons.map((r, index) => (
              <View key={index} style={styles.reasonTag}>
                <Text style={styles.reasonText}>⚠ {r.replace(/_/g, " ")}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => {}}>
            <Text style={styles.approveBtnText}>Clear</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => {}}>
            <Text style={styles.rejectBtnText}>Confirm Fraud</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.transaction_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.primary} />}
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>High-Risk Decisions Requiring Review</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  listContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
  
  alertCard: { backgroundColor: Colors.bg.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.bg.border, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerLeft: { gap: 2 },
  txnId: { fontSize: 13, fontWeight: "700", color: Colors.text.primary },
  timeAgo: { fontSize: 11, color: Colors.text.tertiary },
  
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  
  cardBody: { gap: 6, borderBottomWidth: 1, borderBottomColor: Colors.bg.border, paddingBottom: 14, marginBottom: 12 },
  pathText: { fontSize: 13, color: Colors.text.secondary },
  bold: { fontWeight: "700", color: Colors.text.primary },
  amountText: { fontSize: 14, fontWeight: "800", color: Colors.text.primary, marginTop: 4 },
  
  reasonsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  reasonTag: { backgroundColor: Colors.risk.rejectBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.risk.reject + "22" },
  reasonText: { fontSize: 10, color: Colors.risk.reject, fontWeight: "700", textTransform: "uppercase" },
  
  cardFooter: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  approveBtn: { backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.bg.border },
  approveBtnText: { fontSize: 13, fontWeight: "700", color: Colors.text.secondary },
  rejectBtn: { backgroundColor: Colors.risk.reject },
  rejectBtnText: { fontSize: 13, fontWeight: "700", color: Colors.text.primary },
});
