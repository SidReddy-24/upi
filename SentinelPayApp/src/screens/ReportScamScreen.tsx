/**
 * ReportScamScreen — Premium Community Report UI
 * Single header. No duplicate titles. Full DS compliance.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, SafeAreaView, StatusBar,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import fraudShieldApi from '../services/fraudShieldApi';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ReportScam'> };

const CATEGORIES = [
  { label: 'Investment Scam',  icon: 'trendingUp' },
  { label: 'OTP / Banking',   icon: 'lock'       },
  { label: 'Digital Arrest',  icon: 'siren'      },
  { label: 'Remote Access',   icon: 'wifi'       },
  { label: 'Lottery / Prize', icon: 'award'      },
  { label: 'Job / Task Scam', icon: 'briefcase'  },
  { label: 'Marketplace',     icon: 'creditCard' },
  { label: 'Fake KYC',        icon: 'userCheck'  },
  { label: 'UPI Fraud',       icon: 'send'       },
  { label: 'Other Fraud',     icon: 'alertTriangle' },
] as const;

const MAX_DESC = 500;

/* ─── Chip with animated selection ─────────────────────────────────── */
function CategoryChip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipActive]}
        onPress={press}
        activeOpacity={1}
      >
        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── Attachment card ───────────────────────────────────────────────── */
function AttachCard({ label, icon }: { label: string; icon: string }) {
  return (
    <TouchableOpacity style={styles.attachCard} activeOpacity={0.7}>
      <AppIcon name={icon as any} size={18} color={C.textTertiary} />
      <Text style={styles.attachLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Success overlay ───────────────────────────────────────────────── */
function SuccessView({ entityId, onScamPassport, onClose }: {
  entityId: string;
  onScamPassport: () => void;
  onClose: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12 }).start();
  }, [scaleAnim]);
  return (
    <View style={styles.successOverlay}>
      <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.successCheck}>
          <AppIcon name="checkCircle" size={40} color={C.green} />
        </View>
        <Text style={styles.successTitle}>Report Filed</Text>
        <Text style={styles.successSub}>
          Thank you for helping protect the SentinelPay community. FraudShield AI has updated the trust score for{'\n'}
          <Text style={{ fontWeight: T.bold, color: C.textPrimary }}>{entityId}</Text>
        </Text>
        <TouchableOpacity style={[DS.btn, DS.btnPrimary, { marginTop: S.lg }]} onPress={onScamPassport} activeOpacity={0.8}>
          <AppIcon name="shield" size={18} color={C.textInverse} />
          <Text style={DS.btnText}>View Scam Passport</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[DS.btn, DS.btnOutline, { marginTop: S.sm }]} onPress={onClose} activeOpacity={0.8}>
          <Text style={DS.btnTextDark}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────── */
export default function ReportScamScreen({ navigation }: Props) {
  const [entityId,    setEntityId]    = useState('');
  const [category,   setCategory]    = useState<string>(CATEGORIES[0].label);
  const [description, setDescription] = useState('');
  const [loading,    setLoading]      = useState(false);
  const [success,    setSuccess]      = useState(false);
  const [focused,    setFocused]      = useState<'entity' | 'desc' | null>(null);

  const handleSubmit = async () => {
    if (!entityId.trim()) {
      Alert.alert('Required Field', 'Please enter a UPI ID, phone number, or QR ID to report.');
      return;
    }
    try {
      setLoading(true);
      await fraudShieldApi.submitCommunityReport({
        entity_id: entityId.trim(),
        entity_type: entityId.includes('@') ? 'VPA' : 'PHONE',
        category,
        description: description.trim(),
      });
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to file report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[DS.safeArea, { backgroundColor: 'rgba(15,23,42,0.5)' }]}>
        <SuccessView
          entityId={entityId}
          onScamPassport={() => navigation.navigate('ScamPassport', { entityId: entityId.trim() })}
          onClose={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ─── Single Header ─── */}
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={DS.pageTitle}>Report Fraud</Text>
          <Text style={[DS.cardSub, { marginTop: 0 }]}>Protect the community · AI trust scoring</Text>
        </View>
        <View style={[DS.pillBadge, { backgroundColor: C.redBg }]}>
          <View style={[DS.statusDot, { backgroundColor: C.red }]} />
          <Text style={{ fontSize: T.caption, fontWeight: T.extrabold, color: C.red }}>LIVE</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[DS.scrollContent, { paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Community Banner ─── */}
          <View style={styles.communityBanner}>
            <View style={[DS.iconLg, { backgroundColor: C.redBg }]}>
              <AppIcon name="report" size={28} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[DS.cardTitle, { fontSize: T.md }]}>Community Report</Text>
              <Text style={[DS.cardSub, { marginTop: S.xs, lineHeight: 17 }]}>
                Community reports improve FraudShield AI and help protect other users across the SentinelPay network.
              </Text>
            </View>
          </View>

          {/* ─── UPI ID / Phone field ─── */}
          <Text style={DS.inputLabel}>TARGET UPI ID / PHONE</Text>
          <View style={[focused === 'entity' ? DS.inputWrapperFocused : DS.inputWrapper, { marginBottom: S.md }]}>
            <AppIcon name="search" size={16} color={C.textTertiary} />
            <TextInput
              style={[DS.input, { marginLeft: S.sm }]}
              placeholder="e.g. scammer@okhdfc or 9876543210"
              placeholderTextColor={C.textTertiary}
              value={entityId}
              onChangeText={setEntityId}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused('entity')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* ─── Scam Category ─── */}
          <Text style={[DS.inputLabel, { marginBottom: S.sm }]}>SCAM CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -S.xl, marginBottom: S.md }}
            contentContainerStyle={{ paddingHorizontal: S.xl, gap: S.sm, paddingRight: S.xl + S.md }}
          >
            {CATEGORIES.map(cat => (
              <CategoryChip
                key={cat.label}
                label={cat.label}
                selected={category === cat.label}
                onPress={() => setCategory(cat.label)}
              />
            ))}
          </ScrollView>

          {/* ─── Description ─── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
            <Text style={DS.inputLabel}>DESCRIPTION & EVIDENCE</Text>
            <Text style={{ fontSize: T.caption, color: description.length > MAX_DESC * 0.9 ? C.red : C.textTertiary, fontWeight: T.bold }}>
              {description.length}/{MAX_DESC}
            </Text>
          </View>
          <View style={[
            focused === 'desc' ? DS.inputWrapperFocused : DS.inputWrapper,
            { height: 120, alignItems: 'flex-start', paddingTop: S.md, marginBottom: S.md },
          ]}>
            <TextInput
              style={[DS.input, { textAlignVertical: 'top', height: '100%' }]}
              placeholder="Describe how the scam occurred, promises made, or suspicious activity..."
              placeholderTextColor={C.textTertiary}
              multiline
              maxLength={MAX_DESC}
              value={description}
              onChangeText={setDescription}
              onFocus={() => setFocused('desc')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* ─── Attachments ─── */}
          <Text style={[DS.inputLabel, { marginBottom: S.sm }]}>ATTACH EVIDENCE (DEMO)</Text>
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
            <AttachCard label="Screenshot" icon="eye" />
            <AttachCard label="Chat Log"   icon="messageSquare" />
            <AttachCard label="Call Log"   icon="phone" />
          </View>

          {/* ─── AI Info Banner ─── */}
          <View style={[DS.infoCard, { backgroundColor: C.blueBg, borderRadius: R.lg, marginBottom: S.lg }]}>
            <AppIcon name="cpu" size={18} color={C.blue} />
            <View style={{ flex: 1, marginLeft: S.sm }}>
              <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.blue, marginBottom: 2 }}>FraudShield AI</Text>
              <Text style={{ fontSize: T.xs, color: C.blue, lineHeight: 16 }}>
                Reports help improve community scam detection and AI trust scores across the entire payment network.
              </Text>
            </View>
          </View>

          {/* ─── Submit ─── */}
          <TouchableOpacity
            style={[DS.btn, DS.btnDanger, loading && DS.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={C.textInverse} />
            ) : (
              <>
                <AppIcon name="report" size={18} color={C.textInverse} />
                <Text style={DS.btnText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  communityBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.md,
    backgroundColor: C.redBg, borderRadius: R.xl, padding: S.lg,
    marginBottom: S.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  chip: {
    paddingHorizontal: S.md, paddingVertical: S.xs + 2,
    backgroundColor: C.surface, borderRadius: R.full,
    borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: T.xs, fontWeight: T.bold, color: C.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  attachCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: S.xs, borderRadius: R.lg, borderWidth: 1.5,
    borderColor: C.border, borderStyle: 'dashed',
    paddingVertical: S.md, backgroundColor: C.surface,
  },
  attachLabel: { fontSize: T.caption, fontWeight: T.bold, color: C.textTertiary },
  successOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: S.xl, backgroundColor: C.bg,
  },
  successCard: {
    backgroundColor: C.surface, borderRadius: R.card, padding: S.xl,
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.dark, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  successCheck: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: S.md, borderWidth: 2, borderColor: 'rgba(16,185,129,0.3)',
  },
  successTitle: { fontSize: T.xl, fontWeight: T.black, color: C.textPrimary, marginBottom: S.sm },
  successSub: { fontSize: T.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: S.xs },
});
