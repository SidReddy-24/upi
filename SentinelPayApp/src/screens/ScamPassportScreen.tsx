import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScamPassport'>;
  route: RouteProp<RootStackParamList, 'ScamPassport'>;
};

export default function ScamPassportScreen({ route }: Props) {
  const entityId = route.params?.entityId ?? 'mule@okhdfc';
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fraudShieldApi.getScamPassport(entityId).then(data => {
      setPassport(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [entityId]);

  if (loading || !passport) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const isHighRisk = passport.trust_score < 40;

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.passportCard, isHighRisk ? styles.passportDanger : styles.passportSafe]}>
        <Text style={styles.badgeLabel}>🛂 SENTINELPAY SCAM PASSPORT</Text>
        <Text style={styles.entityId}>{passport.entity_id}</Text>
        <Text style={styles.entityType}>Entity Type: {passport.entity_type}</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreVal}>{passport.trust_score}</Text>
            <Text style={styles.scoreTag}>Trust Score (0-100)</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreVal}>{passport.credibility_score}</Text>
            <Text style={styles.scoreTag}>Credibility</Text>
          </View>
        </View>

        <View style={styles.levelPill}>
          <Text style={styles.levelText}>Status: {passport.trust_level}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Community Intelligence Summary</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{passport.complaint_count}</Text>
            <Text style={styles.gridLabel}>Total Reports</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{passport.verified_complaints}</Text>
            <Text style={styles.gridLabel}>Verified Fraud</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridVal}>{passport.platform_age_days}d</Text>
            <Text style={styles.gridLabel}>Network Age</Text>
          </View>
        </View>

        {passport.categories.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.subTitle}>Flagged Categories:</Text>
            <View style={styles.tagsRow}>
              {passport.categories.map((c: string) => (
                <View key={c} style={styles.tag}><Text style={styles.tagText}>⚠️ {c}</Text></View>
              ))}
            </View>
          </View>
        )}

        {passport.linked_entities.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.subTitle}>Reputation Graph Linked Entities:</Text>
            {passport.linked_entities.map((l: string) => (
              <Text key={l} style={styles.linkText}>🔗 {l}</Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  passportCard: { borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center' },
  passportDanger: { backgroundColor: '#7f1d1d' },
  passportSafe: { backgroundColor: '#1e1b4b' },
  badgeLabel: { fontSize: 11, fontWeight: '800', color: '#818cf8', letterSpacing: 1, marginBottom: 8 },
  entityId: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 2 },
  entityType: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  scoreRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  scoreBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  scoreVal: { fontSize: 28, fontWeight: '800', color: '#fff' },
  scoreTag: { fontSize: 11, color: '#cbd5e1' },
  levelPill: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  levelText: { fontSize: 13, fontWeight: '700', color: '#78350f' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { alignItems: 'center', flex: 1 },
  gridVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  gridLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  subTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, color: '#991b1b', fontWeight: '600' },
  linkText: { fontSize: 13, color: '#475569', marginTop: 4 },
});
