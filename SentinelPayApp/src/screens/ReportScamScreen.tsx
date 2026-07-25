import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
        'Report Filed',
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
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={DS.pageTitle}>Report Fraudster</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={DS.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={DS.cardLg}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
            <View style={[DS.iconMd, { backgroundColor: C.redBg }]}>
              <AppIcon name="report" size={22} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.cardTitle}>Community Report</Text>
              <Text style={DS.cardSub}>Reports instantly update AI Trust Scores network-wide</Text>
            </View>
          </View>

          <Text style={DS.inputLabel}>TARGET UPI ID / PHONE / ENTITY</Text>
          <TextInput
            style={DS.inputStandalone}
            placeholder="e.g. scammer@okhdfc or 9876543210"
            placeholderTextColor={C.textTertiary}
            value={entityId}
            onChangeText={setEntityId}
            autoCapitalize="none"
          />

          <Text style={DS.inputLabel}>SCAM CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: S.md }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[DS.chip, category === cat && { backgroundColor: C.red }]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}>
                <Text style={[DS.chipText, category === cat && { color: C.textInverse }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={DS.inputLabel}>DESCRIPTION & EVIDENCE NOTES</Text>
          <TextInput
            style={[DS.inputStandalone, { height: 100, textAlignVertical: 'top', paddingTop: S.md }]}
            placeholder="Describe how the scam occurred, promises made, or suspicious calls..."
            placeholderTextColor={C.textTertiary}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity style={[DS.btn, DS.btnDanger, { marginTop: S.lg }]} onPress={handleSubmit} disabled={loading} activeOpacity={0.7}>
            {loading ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <Text style={DS.btnText}>Submit Community Report →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
