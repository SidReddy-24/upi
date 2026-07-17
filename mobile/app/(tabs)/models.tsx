import React from "react";
import {
  View, Text, ScrollView, StyleSheet
} from "react-native";
import { Colors } from "../../constants/Colors";

interface FeatureImportance {
  feature: string;
  importance: number;
}

const IMPORTANCES: FeatureImportance[] = [
  { feature: "receiver_is_blacklisted", importance: 0.94 },
  { feature: "device_is_new", importance: 0.81 },
  { feature: "vel_txn_count_1m", importance: 0.76 },
  { feature: "amount_vs_user_max_ratio", importance: 0.72 },
  { feature: "geo_is_impossible_travel", importance: 0.68 },
  { feature: "device_is_rooted", importance: 0.54 },
  { feature: "txn_hour", importance: 0.35 },
  { feature: "txn_amount_log", importance: 0.28 },
];

export default function ModelMetricsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Model Version: lgbm_v1.0.0_20260713</Text>
      
      {/* Model Performance Stats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ensemble Evaluation Metrics</Text>
        <View style={styles.metricsGrid}>
          {[
            { label: "ROC-AUC", val: "0.9812", desc: "Area under curve" },
            { label: "PR-AUC",  val: "0.8940", desc: "Avg precision" },
            { label: "F1 Score", val: "0.9270", desc: "Optimal balance" },
            { label: "Accuracy", val: "99.85%", desc: "Overall classification" },
          ].map(m => (
            <View key={m.label} style={styles.metricItem}>
              <Text style={styles.metricVal}>{m.val}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricDesc}>{m.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Feature Importance SVG Bar Chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gini Feature Importance (Top 8)</Text>
        <View style={styles.chartContainer}>
          {IMPORTANCES.map((imp, idx) => {
            const barWidth = `${imp.importance * 100}%`;
            return (
              <View key={imp.feature} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>{imp.feature.replace(/_/g, " ")}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: barWidth as any }]} />
                  <Text style={styles.barValue}>{imp.importance.toFixed(2)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Confusion Matrix */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Confusion Matrix (Test Split)</Text>
        <View style={styles.matrixContainer}>
          <View style={styles.matrixRow}>
            <View style={styles.matrixCellHeader}><Text style={styles.matrixHeaderText}>Actual \ Pred</Text></View>
            <View style={styles.matrixCellHeader}><Text style={styles.matrixHeaderText}>Legitimate</Text></View>
            <View style={styles.matrixCellHeader}><Text style={styles.matrixHeaderText}>Fraud</Text></View>
          </View>
          <View style={styles.matrixRow}>
            <View style={styles.matrixCellHeader}><Text style={styles.matrixHeaderText}>Legitimate</Text></View>
            <View style={[styles.matrixCell, { backgroundColor: Colors.risk.approve + "22" }]}>
              <Text style={[styles.matrixValText, { color: Colors.risk.approve }]}>19,560</Text>
              <Text style={styles.matrixSubText}>True Neg</Text>
            </View>
            <View style={[styles.matrixCell, { backgroundColor: Colors.risk.reject + "11" }]}>
              <Text style={styles.matrixValText}>40</Text>
              <Text style={styles.matrixSubText}>False Pos</Text>
            </View>
          </View>
          <View style={styles.matrixRow}>
            <View style={styles.matrixCellHeader}><Text style={styles.matrixHeaderText}>Fraud</Text></View>
            <View style={[styles.matrixCell, { backgroundColor: Colors.risk.reject + "11" }]}>
              <Text style={styles.matrixValText}>35</Text>
              <Text style={styles.matrixSubText}>False Neg</Text>
            </View>
            <View style={[styles.matrixCell, { backgroundColor: Colors.risk.approve + "22" }]}>
              <Text style={[styles.matrixValText, { color: Colors.risk.approve }]}>365</Text>
              <Text style={styles.matrixSubText}>True Pos</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
  
  card: { backgroundColor: Colors.bg.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.bg.border, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase", letterSpacing: 1.0, marginBottom: 16 },
  
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricItem: { flex: 1, minWidth: "45%", backgroundColor: Colors.bg.elevated, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.bg.border },
  metricVal: { fontSize: 22, fontWeight: "900", color: Colors.accent.primary },
  metricLabel: { fontSize: 12, fontWeight: "700", color: Colors.text.primary, marginTop: 4 },
  metricDesc: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2 },
  
  chartContainer: { gap: 12 },
  barRow: { gap: 4 },
  barLabel: { fontSize: 11, fontWeight: "600", color: Colors.text.secondary, textTransform: "capitalize" },
  barContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { height: 12, backgroundColor: Colors.accent.primary, borderRadius: 6 },
  barValue: { fontSize: 11, fontWeight: "700", color: Colors.text.primary },
  
  matrixContainer: { gap: 1 },
  matrixRow: { flexDirection: "row", gap: 1 },
  matrixCellHeader: { flex: 1, height: 50, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg.elevated, padding: 4 },
  matrixHeaderText: { fontSize: 11, fontWeight: "700", color: Colors.text.secondary, textAlign: "center" },
  matrixCell: { flex: 1, height: 60, justifyContent: "center", alignItems: "center", padding: 4 },
  matrixValText: { fontSize: 14, fontWeight: "800", color: Colors.text.primary },
  matrixSubText: { fontSize: 9, color: Colors.text.tertiary, marginTop: 2 },
});
