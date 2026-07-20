import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReportScam'>;
};

const CATEGORIES = [
  'Investment Scam',
  'Digital Arrest Scam',
  'OTP / Banking Scam',
  'Fake Refund / Utility',
  'Courier / Parcel Scam',
  'Fake Merchant / QR',
  'Job / Task Scam',
  'Other Fraud',
];

export default function ReportScamScreen({ navigation }: Props) {
  const [entityId, setEntityId] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!entityId.trim()) {
      Alert.alert('Required Field', 'Please enter a UPI ID, Phone Number, or QR ID to report.');
      return;
    }

    try {
      setLoading(true);
      const res = await fraudShieldApi.submitCommunityReport({
        entity_id: entityId.trim(),
        entity_type: entityId.includes('@') ? 'VPA' : 'PHONE',
        category,
        description: description.trim(),
      });

      Alert.alert(
        '🛡️ Report Filed',
        `Thank you for contributing to community safety!\n\nEntity Trust Score penalized to ${res.updated_trust_score}/100.`,
        [{ text: 'View Scam Passport', onPress: () => navigation.navigate('ScamPassport', { entityId: entityId.trim() }) }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to file report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.headerTitle}>🚨 Report a Fraudster / Scam</Text>
        <Text style={styles.headerSubtitle}>
          Community reports immediately update AI Trust Scores across the SentinelPay network.
        </Text>

        <Text style={styles.label}>Target UPI ID / Phone Number / Entity ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. scammer@okhdfc or 9876543210"
          placeholderTextColor="#9ca3af"
          value={entityId}
          onChangeText={setEntityId}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Scam Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}>
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Description & Evidence Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe how the scam occurred, promises made, or suspicious calls..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Community Report →</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#f9fafb',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  catRow: { flexDirection: 'row', marginBottom: 8 },
  catChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  catChipActive: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
  catText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  catTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
