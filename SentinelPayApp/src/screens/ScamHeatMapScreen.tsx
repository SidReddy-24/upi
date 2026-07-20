import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import fraudShieldApi from '../services/fraudShieldApi';

export default function ScamHeatMapScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fraudShieldApi.getScamHeatmap().then(res => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ National Scam Heat Map</Text>
        <Text style={styles.subtitle}>Real-time cyber fraud hotspot intelligence network</Text>
      </View>

      {data.national_fraud_wave_alert && (
        <View style={styles.waveBanner}>
          <Text style={styles.waveTitle}>⚡ ACTIVE FRAUD WAVE ALERT</Text>
          <Text style={styles.waveDesc}>
            Spike detected in "Digital Arrest" & "Telegram Investment" scams originating from major hotspots.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>🔥 Active Fraud Hotspots ({data.total_active_hotspots})</Text>

      {data.hotspots.map((item: any) => (
        <View key={item.city} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cityName}>{item.city}</Text>
              <Text style={styles.stateName}>{item.state}</Text>
            </View>
            <View style={[styles.badge, item.risk_level === 'CRITICAL' ? styles.badgeCrit : styles.badgeHigh]}>
              <Text style={styles.badgeText}>{item.risk_level}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Top Scam Type:</Text>
            <Text style={styles.val}>{item.top_scam_type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Active Reports:</Text>
            <Text style={styles.val}>{item.active_cases} cases</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Weekly Trend:</Text>
            <Text style={[styles.val, item.fraud_trend_pct > 0 ? styles.textDanger : styles.textSafe]}>
              {item.fraud_trend_pct > 0 ? `+${item.fraud_trend_pct}%` : `${item.fraud_trend_pct}%`}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280' },
  waveBanner: { backgroundColor: '#fef2f2', borderLeftWidth: 4, borderLeftColor: '#ef4444', padding: 14, borderRadius: 10, marginBottom: 20 },
  waveTitle: { fontSize: 13, fontWeight: '800', color: '#991b1b', marginBottom: 4 },
  waveDesc: { fontSize: 12, color: '#7f1d1d', lineHeight: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cityName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  stateName: { fontSize: 12, color: '#64748b' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeCrit: { backgroundColor: '#7f1d1d' },
  badgeHigh: { backgroundColor: '#dc2626' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 13, color: '#64748b' },
  val: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  textDanger: { color: '#dc2626' },
  textSafe: { color: '#16a34a' },
});
