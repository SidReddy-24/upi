import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScamPassport'>;
  route: RouteProp<RootStackParamList, 'ScamPassport'>;
};

export default function ScamPassportScreen({ route, navigation }: Props) {
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
      <SafeAreaView style={DS.safeArea}>
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      </SafeAreaView>
    );
  }

  const isHighRisk = passport.trust_score < 40;

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Scam Passport</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent}>
        {/* Passport Hero Card */}
        <View style={[DS.cardLg, { backgroundColor: C.dark, borderColor: isHighRisk ? C.red : C.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: C.blue, letterSpacing: 1 }}>🛂 SENTINELPAY PASSPORT</Text>
            <View style={[DS.pillBadge, { backgroundColor: isHighRisk ? C.redBg : C.greenBg }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: isHighRisk ? C.red : C.green }}>{passport.trust_level}</Text>
            </View>
          </View>

          <Text style={{ fontSize: T.xl, fontWeight: T.black, color: C.textInverse, marginBottom: 2 }}>{passport.entity_id}</Text>
          <Text style={{ fontSize: T.xs, color: C.textSecondary, marginBottom: S.lg }}>Type: {passport.entity_type}</Text>

          <View style={DS.statsRow}>
            <View style={[DS.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[DS.statNum, { color: isHighRisk ? C.red : C.green }]}>{passport.trust_score}</Text>
              <Text style={[DS.statLabel, { color: C.textSecondary }]}>Trust Score</Text>
            </View>
            <View style={[DS.statCard, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[DS.statNum, { color: C.blue }]}>{passport.credibility_score}</Text>
              <Text style={[DS.statLabel, { color: C.textSecondary }]}>Credibility</Text>
            </View>
          </View>
        </View>

        {/* Intelligence Details */}
        <View style={DS.card}>
          <Text style={DS.sectionTitle}>Intelligence Summary</Text>
          
          <View style={DS.statsRow}>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.red }]}>{passport.complaint_count}</Text>
              <Text style={DS.statLabel}>Reports</Text>
            </View>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.amber }]}>{passport.verified_complaints}</Text>
              <Text style={DS.statLabel}>Verified</Text>
            </View>
            <View style={DS.statCard}>
              <Text style={[DS.statNum, { color: C.textPrimary }]}>{passport.platform_age_days}d</Text>
              <Text style={DS.statLabel}>Network Age</Text>
            </View>
          </View>

          {passport.categories.length > 0 && (
            <View style={{ marginTop: S.md }}>
              <Text style={DS.label}>FLAGGED CATEGORIES</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: 4 }}>
                {passport.categories.map((c: string) => (
                  <View key={c} style={[DS.pillBadge, { backgroundColor: C.redBg }]}>
                    <Text style={{ fontSize: T.xs, color: C.red, fontWeight: T.bold }}>⚠️ {c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {passport.linked_entities.length > 0 && (
            <View style={{ marginTop: S.md }}>
              <Text style={DS.label}>LINKED GRAPH ENTITIES</Text>
              {passport.linked_entities.map((l: string) => (
                <View key={l} style={[DS.rowCard, { marginTop: S.xs }]}>
                  <AppIcon name="link" size={16} color={C.blue} />
                  <Text style={[DS.cardSub, { color: C.textPrimary, flex: 1 }]}>{l}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
