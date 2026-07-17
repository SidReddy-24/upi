import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, Dimensions,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { fetchAnalytics, fetchHealth, fetchModelStatus } from "../../services/api";

const { width } = Dimensions.get("window");

// ── KPI Card ──────────────────────────────────────────────────────
function KPICard({
  label, value, subtext, accent = Colors.accent.primary, glow = false,
}: { label: string; value: string; subtext?: string; accent?: string; glow?: boolean }) {
  return (
    <View style={[styles.kpiCard, glow && { borderColor: accent, shadowColor: accent, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }]}>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {subtext ? <Text style={styles.kpiSub}>{subtext}</Text> : null}
    </View>
  );
}

// ── Decision Bar ──────────────────────────────────────────────────
function DecisionBar({ approved, reviewed, rejected }: { approved: number; reviewed: number; rejected: number }) {
  const total = approved + reviewed + rejected || 1;
  const pctA = (approved / total) * 100;
  const pctR = (reviewed / total) * 100;
  const pctX = (rejected / total) * 100;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Decision Distribution</Text>
      <View style={styles.decisionBar}>
        <View style={[styles.barSegment, { flex: pctA, backgroundColor: Colors.risk.approve }]} />
        <View style={[styles.barSegment, { flex: pctR, backgroundColor: Colors.risk.review }]} />
        <View style={[styles.barSegment, { flex: pctX, backgroundColor: Colors.risk.reject }]} />
      </View>
      <View style={styles.legend}>
        {[
          { label: "Approve", color: Colors.risk.approve, pct: pctA },
          { label: "Review",  color: Colors.risk.review,  pct: pctR },
          { label: "Reject",  color: Colors.risk.reject,  pct: pctX },
        ].map((d) => (
          <View key={d.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendText}>{d.label}: {d.pct.toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Alert Row ─────────────────────────────────────────────────────
function AlertRow({ type, count, pct }: { type: string; count: number; pct: number }) {
  const color = type.includes("TAKEOVER") ? Colors.risk.critical :
                type.includes("VELOCITY") ? Colors.risk.review : Colors.risk.reject;
  return (
    <View style={styles.alertRow}>
      <View style={[styles.alertDot, { backgroundColor: color }]} />
      <Text style={styles.alertType}>{type.replace(/_/g, " ")}</Text>
      <View style={styles.alertRight}>
        <Text style={[styles.alertCount, { color }]}>{count}</Text>
        <Text style={styles.alertPct}>{(pct * 100).toFixed(0)}%</Text>
      </View>
    </View>
  );
}

// ── Component Health Row ──────────────────────────────────────────
function ComponentRow({ name, status, latencyMs }: { name: string; status: string; latencyMs?: number }) {
  const color = status === "UP" ? Colors.status.up : status === "DEGRADED" ? Colors.status.degraded : Colors.status.down;
  return (
    <View style={styles.compRow}>
      <View style={[styles.compDot, { backgroundColor: color }]} />
      <Text style={styles.compName}>{name.replace(/_/g, " ").toUpperCase()}</Text>
      <Text style={[styles.compStatus, { color }]}>{status}</Text>
      {latencyMs !== undefined && <Text style={styles.compLatency}>{latencyMs}ms</Text>}
    </View>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function DashboardScreen() {
  const [analytics, setAnalytics]   = useState<any>(null);
  const [health, setHealth]         = useState<any>(null);
  const [model, setModel]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadAll = useCallback(async () => {
    try {
      const [a, h, m] = await Promise.all([
        fetchAnalytics(),
        fetchHealth().catch(() => null),
        fetchModelStatus().catch(() => null),
      ]);
      setAnalytics(a);
      setHealth(h);
      setModel(m);
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [loadAll]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent.primary} />
        <Text style={styles.loadingText}>Connecting to FraudShield AI...</Text>
      </View>
    );
  }

  const summary = analytics?.summary || {};
  const components = health?.components || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={Colors.accent.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>FraudShield AI</Text>
          <Text style={styles.headerSub}>Real-Time Fraud Scoring Engine</Text>
        </View>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* System Status Banner */}
      <View style={[
        styles.statusBanner,
        { borderColor: health?.status === "HEALTHY" ? Colors.risk.approve : Colors.risk.review }
      ]}>
        <Text style={styles.statusIcon}>{health?.status === "HEALTHY" ? "✓" : "⚠"}</Text>
        <Text style={[
          styles.statusText,
          { color: health?.status === "HEALTHY" ? Colors.risk.approve : Colors.risk.review }
        ]}>
          System {health?.status ?? "CONNECTING"} · {Object.keys(components).length} services monitored
        </Text>
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KPICard
          label="Scored (24h)"
          value={summary.total_scored?.toLocaleString() ?? "—"}
          subtext="transactions"
          accent={Colors.accent.primary}
          glow
        />
        <KPICard
          label="Fraud Rate"
          value={summary.fraud_rate != null ? `${(summary.fraud_rate * 100).toFixed(2)}%` : "—"}
          subtext="of all txns"
          accent={Colors.risk.reject}
        />
        <KPICard
          label="p99 Latency"
          value={summary.p99_latency_ms != null ? `${summary.p99_latency_ms.toFixed(0)}ms` : "—"}
          subtext={summary.p99_latency_ms < 200 ? "✓ within SLA" : "⚠ SLA breach"}
          accent={summary.p99_latency_ms < 200 ? Colors.risk.approve : Colors.risk.review}
        />
        <KPICard
          label="Avg Latency"
          value={summary.avg_latency_ms != null ? `${summary.avg_latency_ms.toFixed(0)}ms` : "—"}
          subtext="p50"
          accent={Colors.accent.teal}
        />
      </View>

      {/* Decision Bar */}
      <DecisionBar
        approved={summary.approved ?? 0}
        reviewed={summary.reviewed ?? 0}
        rejected={summary.rejected ?? 0}
      />

      {/* Model Health */}
      {model && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Health</Text>
          <View style={styles.modelCard}>
            <View style={styles.modelRow}>
              <Text style={styles.modelLabel}>Model</Text>
              <Text style={styles.modelValue}>{model.production_model?.model_id ?? "—"}</Text>
            </View>
            <View style={styles.modelRow}>
              <Text style={styles.modelLabel}>AUC</Text>
              <Text style={[styles.modelValue, { color: Colors.accent.teal }]}>
                {model.production_model?.metrics?.auc?.toFixed(4) ?? "—"}
              </Text>
            </View>
            <View style={styles.modelRow}>
              <Text style={styles.modelLabel}>Drift Status</Text>
              <Text style={[
                styles.modelValue,
                { color: model.production_model?.drift_status === "STABLE" ? Colors.risk.approve : Colors.risk.review }
              ]}>
                {model.production_model?.drift_status ?? "—"}
              </Text>
            </View>
            <View style={styles.modelRow}>
              <Text style={styles.modelLabel}>PSI</Text>
              <Text style={styles.modelValue}>{model.production_model?.psi ?? "—"}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Top Fraud Types */}
      {analytics?.top_fraud_types?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Fraud Categories (24h)</Text>
          {analytics.top_fraud_types.map((t: any) => (
            <AlertRow key={t.type} type={t.type} count={t.count} pct={t.pct} />
          ))}
        </View>
      )}

      {/* System Components */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Component Health</Text>
        {Object.entries(components).map(([name, c]: [string, any]) => (
          <ComponentRow key={name} name={name} status={c.status} latencyMs={c.latency_ms} />
        ))}
      </View>

      <Text style={styles.updated}>
        Last updated: {lastUpdated.toLocaleTimeString()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg.app },
  content:      { padding: 16, paddingBottom: 40 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg.app },
  loadingText:  { marginTop: 12, color: Colors.text.secondary, fontSize: 14 },

  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerTitle:  { fontSize: 26, fontWeight: "800", color: Colors.text.primary },
  headerSub:    { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  liveTag:      { flexDirection: "row", alignItems: "center", backgroundColor: Colors.risk.approveBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.risk.approve },
  liveText:     { fontSize: 11, fontWeight: "800", color: Colors.risk.approve, letterSpacing: 1.5 },

  statusBanner: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, backgroundColor: Colors.bg.surface, gap: 8 },
  statusIcon:   { fontSize: 16, color: Colors.risk.approve },
  statusText:   { fontSize: 13, fontWeight: "600" },

  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  kpiCard:      { flex: 1, minWidth: (width - 52) / 2, backgroundColor: Colors.bg.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.bg.border },
  kpiValue:     { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  kpiLabel:     { fontSize: 11, color: Colors.text.secondary, marginTop: 4, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  kpiSub:       { fontSize: 11, color: Colors.text.tertiary, marginTop: 3 },

  section:        { marginTop: 20, backgroundColor: Colors.bg.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.bg.border },
  sectionTitle:   { fontSize: 13, fontWeight: "700", color: Colors.text.secondary, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 },

  decisionBar:    { height: 10, borderRadius: 6, flexDirection: "row", overflow: "hidden", marginBottom: 12 },
  barSegment:     { height: 10 },
  legend:         { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 8, height: 8, borderRadius: 4 },
  legendText:     { fontSize: 12, color: Colors.text.secondary },

  alertRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bg.border, gap: 10 },
  alertDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  alertType:      { flex: 1, fontSize: 13, color: Colors.text.primary, fontWeight: "600" },
  alertRight:     { alignItems: "flex-end" },
  alertCount:     { fontSize: 15, fontWeight: "800" },
  alertPct:       { fontSize: 11, color: Colors.text.tertiary },

  modelCard:      { gap: 10 },
  modelRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modelLabel:     { fontSize: 13, color: Colors.text.secondary },
  modelValue:     { fontSize: 13, fontWeight: "700", color: Colors.text.primary },

  compRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.bg.border, gap: 8 },
  compDot:        { width: 8, height: 8, borderRadius: 4 },
  compName:       { flex: 1, fontSize: 12, color: Colors.text.secondary },
  compStatus:     { fontSize: 12, fontWeight: "700", marginRight: 8 },
  compLatency:    { fontSize: 11, color: Colors.text.tertiary, width: 40, textAlign: "right" },

  updated:        { marginTop: 20, textAlign: "center", fontSize: 11, color: Colors.text.tertiary },
});
