import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import guardianService, { GuardianRelationship, WardRelationship, PendingRequest } from '../services/guardianService';
import { getSettings, updateSettings } from '../utils/settingsDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GuardianManagement'>;
};

function CountdownTimer({ expiresAt }: { expiresAt?: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('5m 00s');
      return;
    }

    const target = new Date(expiresAt).getTime();

    const update = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setTimeLeft(`${m}m ${s < 10 ? '0' : ''}${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = timeLeft === 'Expired';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <AppIcon name="clock" size={12} color={isExpired ? '#EF4444' : '#F59E0B'} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: isExpired ? '#EF4444' : '#F59E0B' }}>
        {isExpired ? 'Code Expired' : `Expires in ${timeLeft}`}
      </Text>
    </View>
  );
}

export default function GuardianManagementScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'guardians' | 'wards' | 'approvals'>('guardians');

  const [guardians, setGuardians] = useState<GuardianRelationship[]>([]);
  const [wards, setWards] = useState<WardRelationship[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingRequest[]>([]);
  
  const [inviteInput, setInviteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // OTP Verification state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [verifyingRelId, setVerifyingRelId] = useState<string>('');
  const [otpInput, setOtpInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Spending Limit state
  const [spendingLimit, setSpendingLimit] = useState<string>('5000');
  const [limitLoading, setLimitLoading] = useState(false);

  // In-app notifications feed (verification codes)
  const [verificationLogs, setVerificationLogs] = useState<{ id: string; code: string; inviter: string; phone?: string }[]>([]);

  // Ward Management Modal State
  const [selectedWard, setSelectedWard] = useState<WardRelationship | null>(null);
  const [wardModalVisible, setWardModalVisible] = useState(false);
  const [wardDetailsLoading, setWardDetailsLoading] = useState(false);
  const [wardDetailsData, setWardDetailsData] = useState<any>(null);
  const [wardLimitInput, setWardLimitInput] = useState('5000');
  const [wardTimeoutInput, setWardTimeoutInput] = useState('5');
  const [wardSaving, setWardSaving] = useState(false);

  const handleOpenWardModal = async (ward: WardRelationship) => {
    setSelectedWard(ward);
    setWardLimitInput(String(ward.spending_limit || 5000));
    setWardTimeoutInput(String(ward.timeout_minutes || 5));
    setWardModalVisible(true);
    setWardDetailsLoading(true);

    try {
      const data = await guardianService.getWardDetails(ward.ward_vpa || ward.ward_phone);
      setWardDetailsData(data);
      if (data && data.config) {
        setWardLimitInput(String(data.config.limit));
        setWardTimeoutInput(String(data.config.timeout_minutes));
      }
    } catch (e) {
      console.warn('Failed to load ward details:', e);
    } finally {
      setWardDetailsLoading(false);
    }
  };

  const handleSaveWardConfig = async () => {
    if (!selectedWard) return;
    const limitNum = parseFloat(wardLimitInput);
    const timeoutNum = parseInt(wardTimeoutInput, 10);

    if (isNaN(limitNum) || limitNum <= 0) {
      Alert.alert('Invalid Limit', 'Enter a valid limit amount (e.g. 5000)');
      return;
    }
    if (isNaN(timeoutNum) || timeoutNum < 1 || timeoutNum > 60) {
      Alert.alert('Invalid Timeout', 'Timeout must be between 1 and 60 minutes.');
      return;
    }

    setWardSaving(true);
    try {
      await guardianService.setWardConfig({
        ward_vpa: selectedWard.ward_vpa,
        ward_phone: selectedWard.ward_phone,
        limit: limitNum,
        timeout_minutes: timeoutNum,
      });

      Alert.alert('Success', `Ward configuration updated: Limit ₹${limitNum.toLocaleString('en-IN')}, Timeout ${timeoutNum}m`);
      setWardModalVisible(false);
      fetchRelationships();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save ward configuration.');
    } finally {
      setWardSaving(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
    loadLimit();

    // Subscribe to real-time guardian events
    const unsubscribe = guardianService.subscribe((event) => {
      if (event.type === 'GUARDIAN_INVITATION' || event.type === 'GUARDIAN_VERIFICATION_CODE') {
        const { relationship_id, code, inviter_name, inviter_phone } = event.data;
        if (code) {
          setVerificationLogs((prev) => [
            { id: relationship_id || String(Date.now()), code, inviter: inviter_name || 'Sentinel User', phone: inviter_phone },
            ...prev,
          ]);
        }
        fetchRelationships();
        Alert.alert(
          'New Guardian Verification Code 🛡️',
          `Guardian request from ${inviter_name || 'User'} (${inviter_phone || ''}).\n\nVerification Code: ${code}\n\nShare this code with your ward to complete guardian setup.`
        );
      } else if (event.type === 'GUARDIAN_INVITATION_APPROVED') {
        const { guardian_name } = event.data;
        fetchRelationships();
        Alert.alert(
          'Guardian Approved Request ✅',
          `${guardian_name || 'Guardian'} has approved your request!\n\nAsk your guardian for the 6-digit code shown on their screen, then tap Verify below.`
        );
      } else if (event.type === 'GUARDIAN_INVITATION_REJECTED') {
        const { guardian_name } = event.data;
        fetchRelationships();
        Alert.alert(
          'Guardian Invitation Rejected ❌',
          `${guardian_name || 'Guardian'} declined your guardian invitation.`
        );
      } else if (event.type === 'GUARDIAN_LINKED' || event.type === 'GUARDIAN_INVITATION_ACCEPTED' || event.type === 'APPROVAL_REQUEST' || event.type === 'APPROVAL_RESPONSE') {
        fetchRelationships();
      }
    });

    guardianService.initialize();

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchRelationships = async () => {
    setLoading(true);
    try {
      const data = await guardianService.listGuardians();
      setGuardians(data.guardians);
      setWards(data.wards);

      // Also fetch pending approvals
      try {
        const reqs = await guardianService.getPendingRequests();
        setPendingApprovals(reqs.incoming || []);
      } catch (err) {
        console.warn('Failed to load pending requests:', err);
      }
    } catch (e: any) {
      console.warn('Failed to load relationships:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLimit = async () => {
    try {
      const res = await guardianService.getGuardianLimit();
      if (res && res.limit) {
        setSpendingLimit(String(res.limit));
      } else {
        const local = await getSettings();
        if (local.guardianThresholdAmount) {
          setSpendingLimit(String(local.guardianThresholdAmount));
        }
      }
    } catch (e) {
      console.warn('Load limit failed:', e);
    }
  };

  const handleSaveLimit = async (customVal?: string) => {
    const targetVal = customVal !== undefined ? customVal : spendingLimit;
    const num = parseFloat(targetVal);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Limit', 'Please enter a valid limit amount (e.g. 5000)');
      return;
    }

    setSpendingLimit(String(num));
    setLimitLoading(true);
    try {
      await guardianService.setGuardianLimit(num);
      await updateSettings({ guardianThresholdAmount: num });
      Alert.alert('Success', `Maximum transaction spending limit set to ₹${num.toLocaleString('en-IN')}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save limit.');
    } finally {
      setLimitLoading(false);
    }
  };

  const handleSendInvite = async () => {
    const input = inviteInput.trim();
    if (!input) {
      Alert.alert('Validation Error', 'Please enter a registered mobile number or VPA');
      return;
    }

    setInviteLoading(true);
    try {
      const isVpa = input.includes('@');
      const payload = isVpa ? { vpa: input } : { phone: input };
      
      const res = await guardianService.addGuardian(payload.phone, payload.vpa);
      if (res && res.relationship_id) {
        setInviteInput('');
        await fetchRelationships();

        // ✅ DO NOT show or pre-fill the OTP — it is sent to the GUARDIAN's device.
        // The Ward must ask the Guardian to share the code verbally (out-of-band).
        Alert.alert(
          'Invitation Sent ✅',
          `Guardian invitation sent to ${input}.\n\nAsk your guardian to check their SentinelPay app for a 6-digit verification code, then enter it below to complete linking.`
        );

        setVerifyingRelId(res.relationship_id);
        setOtpInput('');   // ← blank: ward must type code received from guardian
        setOtpModalVisible(true);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Failed to send guardian invitation.';
      Alert.alert('Invitation Failed', msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleVerifyOtpCode = async () => {
    const code = otpInput.trim();
    if (!code || code.length < 6) {
      Alert.alert('Validation Error', 'Please enter the 6-digit OTP verification code');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await guardianService.verifyGuardianCode(verifyingRelId, code);
      if (res && res.success) {
        setOtpModalVisible(false);
        setOtpInput('');
        Alert.alert('Guardian Verified', 'Your guardian has been successfully linked to your account!');
        fetchRelationships();
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Verification failed. Incorrect code.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRespondInvitation = async (relationshipId: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      setLoading(true);
      const res = await guardianService.respondInvitation(relationshipId, decision);
      if (decision === 'APPROVE') {
        Alert.alert(
          'Invitation Approved ✅',
          'You have approved this ward request. The 6-digit verification code is displayed on your screen — share it with your ward so they can complete linking.'
        );
      } else {
        Alert.alert('Invitation Rejected', 'The guardian request has been rejected and the verification code invalidated.');
      }
      fetchRelationships();
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Failed to respond to invitation.';
      Alert.alert('Response Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (relationshipId: string) => {
    await handleRespondInvitation(relationshipId, 'APPROVE');
  };

  const handleRemoveRelationship = async (relationshipId: string, name: string, role: 'guardian' | 'ward') => {
    Alert.alert(
      role === 'guardian' ? 'Remove Guardian' : 'Leave Ward',
      `Are you sure you want to discontinue the guardian relationship with ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await guardianService.removeGuardian(relationshipId);
              Alert.alert('Removed', 'Relationship removed.');
              fetchRelationships();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to remove relationship.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRespondApproval = async (reqId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      setLoading(true);
      await guardianService.respondToRequest(reqId, decision, 'Responded via Safety Net Dashboard');
      Alert.alert('Response Saved', `Transaction has been ${decision.toLowerCase()}.`);
      fetchRelationships();
    } catch (e: any) {
      Alert.alert('Action Failed', e?.response?.data?.detail || 'Failed to update request.');
    } finally {
      setLoading(false);
    }
  };

  const activeGuardianCount = guardians.filter(g => g.status === 'ACTIVE').length;
  const activeWardCount = wards.filter(w => w.status === 'ACTIVE').length;

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <TouchableOpacity style={DS.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <AppIcon name="chevronLeft" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: S.sm }}>
          <Text style={DS.pageTitle}>Guardian Protection</Text>
          <Text style={{ fontSize: T.xs, color: C.textSecondary, fontWeight: T.medium }}>
            Protection controls & guardian oversight
          </Text>
        </View>
        <TouchableOpacity style={DS.headerIconBtn} onPress={fetchRelationships} activeOpacity={0.7}>
          <AppIcon name="refresh" size={16} color={C.textPrimary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRelationships} tintColor={C.green} />
        }
      >
        {/* ─── 1. HERO SAFETY DASHBOARD (Matches Home Balance Card) ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroBadge}>
              <AppIcon name="shield" size={12} color="#34D399" />
              <Text style={styles.heroBadgeText}>ACTIVE PROTECTION</Text>
            </View>
            <View style={styles.protectedStatusPill}>
              <View style={styles.statusDotPulse} />
              <Text style={styles.protectedStatusText}>
                {activeGuardianCount > 0 ? 'PROTECTED' : 'SETUP PENDING'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroLabelText}>CURRENT SPENDING THRESHOLD</Text>
          <Text style={styles.heroAmountText}>
            ₹{parseFloat(spendingLimit || '0').toLocaleString('en-IN')}
          </Text>
          <Text style={styles.heroSubtitle}>
            Transfers above this threshold require guardian authorization.
          </Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{activeGuardianCount}/5</Text>
              <Text style={styles.metricLabel}>Guardians</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{activeWardCount}</Text>
              <Text style={styles.metricLabel}>Protected Wards</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{pendingApprovals.length}</Text>
              <Text style={styles.metricLabel}>Pending Requests</Text>
            </View>
          </View>
        </View>

        {/* ─── 2. SEGMENTED TAB SELECTOR ─── */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'guardians' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('guardians')}
          >
            <View style={styles.tabIconRow}>
              <AppIcon name="shield" size={14} color={activeTab === 'guardians' ? '#FFFFFF' : '#94A3B8'} />
              <Text style={[styles.segmentText, activeTab === 'guardians' && styles.segmentTextActive]}>
                Guardians ({guardians.length})
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'wards' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('wards')}
          >
            <View style={styles.tabIconRow}>
              <AppIcon name="users" size={14} color={activeTab === 'wards' ? '#FFFFFF' : '#94A3B8'} />
              <Text style={[styles.segmentText, activeTab === 'wards' && styles.segmentTextActive]}>
                Wards ({wards.length})
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'approvals' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('approvals')}
          >
            <View style={styles.tabBadgeRow}>
              <AppIcon name="zap" size={14} color={activeTab === 'approvals' ? '#FFFFFF' : '#94A3B8'} />
              <Text style={[styles.segmentText, activeTab === 'approvals' && styles.segmentTextActive]}>
                Requests
              </Text>
              {pendingApprovals.length > 0 && (
                <View style={styles.tabCountPill}>
                  <Text style={styles.tabCountText}>{pendingApprovals.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── TAB 1: GUARDIANS & LIMIT SETTINGS ─── */}
        {activeTab === 'guardians' && (
          <>
            {/* SPENDING LIMIT CONFIG */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <AppIcon name="coin" size={18} color="#10B981" />
                <Text style={styles.cardTitle}>Maximum Spending Limit</Text>
              </View>
              <Text style={styles.cardDescription}>
                Any transfer exceeding this threshold will automatically require guardian authorization.
              </Text>

              {/* Preset Limit Shortcuts */}
              <View style={styles.presetRow}>
                {['1000', '5000', '10000', '25000'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, spendingLimit === preset && styles.presetChipActive]}
                    onPress={() => handleSaveLimit(preset)}
                  >
                    <Text style={[styles.presetChipText, spendingLimit === preset && styles.presetChipTextActive]}>
                      ₹{parseInt(preset).toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputRow}>
                <View style={styles.currencyPrefix}>
                  <Text style={styles.currencyText}>₹</Text>
                </View>
                <TextInput
                  style={[styles.input, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                  placeholder="Custom Limit e.g. 5000"
                  placeholderTextColor="#64748B"
                  value={spendingLimit}
                  onChangeText={setSpendingLimit}
                  keyboardType="numeric"
                  editable={!limitLoading}
                />
                <TouchableOpacity
                  style={[styles.saveLimitButton, limitLoading && styles.buttonDisabled]}
                  onPress={() => handleSaveLimit()}
                  disabled={limitLoading}
                >
                  {limitLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveLimitButtonText}>Set Limit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* ADD GUARDIAN CARD */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <AppIcon name="userPlus" size={18} color="#10B981" />
                <Text style={styles.cardTitle}>Link a Trusted Guardian</Text>
              </View>
              <Text style={styles.cardDescription}>
                Enter the registered phone number or VPA of a trusted SentinelPay user.
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone (e.g. 9876543210) or VPA"
                  placeholderTextColor="#64748B"
                  value={inviteInput}
                  onChangeText={setInviteInput}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!inviteLoading}
                />
                <TouchableOpacity
                  style={[styles.inviteButton, inviteLoading && styles.buttonDisabled]}
                  onPress={handleSendInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.inviteButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* IN-APP OTP FEED */}
            {verificationLogs.length > 0 && (
              <View style={[styles.card, { borderColor: '#6366F1', borderWidth: 1.5 }]}>
                <View style={styles.cardTitleRow}>
                  <AppIcon name="mail" size={18} color="#818CF8" />
                  <Text style={[styles.cardTitle, { color: '#818CF8' }]}>Guardian OTP Notification Feed</Text>
                </View>
                <Text style={styles.cardDescription}>
                  Recent verification codes generated for guardian linking:
                </Text>
                {verificationLogs.map((log) => (
                  <View key={log.id} style={styles.otpFeedItem}>
                    <View>
                      <Text style={styles.otpFeedUser}>{log.inviter} ({log.phone || 'Phone'})</Text>
                      <Text style={styles.otpFeedCode}>OTP: {log.code}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.verifyDirectBtn}
                      onPress={() => {
                        setVerifyingRelId(log.id);
                        setOtpInput(log.code);
                        setOtpModalVisible(true);
                      }}
                    >
                      <Text style={styles.verifyDirectBtnText}>Enter Code</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* GUARDIANS LIST */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <AppIcon name="shield" size={18} color="#10B981" />
                  <Text style={styles.cardTitle}>Active Guardians ({guardians.length}/5)</Text>
                </View>
              </View>

              {guardians.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <AppIcon name="shield" size={36} color="#475569" />
                  <Text style={styles.emptyTitle}>No Guardians Linked</Text>
                  <Text style={styles.emptyText}>Add a trusted family member or friend above to start protecting transactions.</Text>
                </View>
              ) : (
                guardians.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetter}>{(item.guardian_name || 'G')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.guardian_name || 'Sentinel Guardian'}</Text>
                      <Text style={styles.itemSub}>{item.guardian_vpa || item.guardian_phone}</Text>
                    </View>
                    <View style={styles.itemActions}>
                      {item.status === 'PENDING_VERIFICATION' || item.status === 'PENDING' ? (
                        <TouchableOpacity
                          style={styles.enterCodePill}
                          onPress={() => {
                            navigation.navigate('GuardianVerification', {
                              relationshipId: item.id,
                              guardianName: item.guardian_name || undefined,
                              guardianPhone: item.guardian_phone || item.guardian_vpa,
                            });
                          }}
                        >
                          <AppIcon name="key" size={12} color="#FFFFFF" />
                          <Text style={styles.enterCodePillText}> Verify</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveRelationship(item.id, item.guardian_name || 'this user', 'guardian')}
                      >
                        <AppIcon name="trash" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ─── TAB 2: WARDS (USERS I PROTECT) ─── */}
        {activeTab === 'wards' && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <AppIcon name="users" size={18} color="#3B82F6" />
              <Text style={styles.cardTitle}>Users You Protect (Wards)</Text>
            </View>
            <Text style={styles.cardDescription}>
              Configure cumulative spending limits, monitor financial activity, and review transaction approval requests for all your protected wards.
            </Text>

            {wards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="users" size={36} color="#475569" />
                <Text style={styles.emptyTitle}>Not Protecting Anyone Yet</Text>
                <Text style={styles.emptyText}>When another user adds you as their guardian, their profile and spending controls will appear here.</Text>
              </View>
            ) : (
              wards.map((item) => {
                const spent = item.cumulative_spent || 0;
                const limit = item.spending_limit || 5000;
                const remaining = item.remaining_limit !== undefined ? item.remaining_limit : Math.max(0, limit - spent);
                const percentSpent = Math.min(100, Math.round((spent / limit) * 100));
                const timeoutMins = item.timeout_minutes || 5;

                return (
                  <View key={item.id} style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B', marginBottom: 12, padding: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <View style={[styles.avatarCircle, { backgroundColor: '#3B82F6', marginRight: 10 }]}>
                          <Text style={styles.avatarLetter}>{(item.ward_name || 'W')[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                            {item.ward_name || 'Sentinel Ward'}
                          </Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {item.ward_vpa || item.ward_phone}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {item.status === 'ACTIVE' && (
                          <View style={[styles.activePill, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                            <Text style={[styles.activePillText, { color: '#60A5FA' }]}>PROTECTING</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveRelationship(item.id, item.ward_name || 'this user', 'ward')}
                        >
                          <AppIcon name="trash" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {item.status === 'PENDING' || item.status === 'APPROVED' ? (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155', width: '100%' }}>
                        <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ color: '#818CF8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                              In-App Verification Code
                            </Text>
                            <CountdownTimer expiresAt={item.code_expires_at} />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 4, fontFamily: 'monospace' }}>
                              {item.verification_code || '------'}
                            </Text>
                            <View style={{ backgroundColor: item.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                              <Text style={{ color: item.status === 'APPROVED' ? '#34D399' : '#A5B4FC', fontSize: 11, fontWeight: '600' }}>
                                {item.status === 'APPROVED' ? 'APPROVED' : 'PENDING'}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>
                            Share this 6-digit code with {item.ward_name || 'your ward'} so they can complete linking on their device.
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => handleRespondInvitation(item.id, 'APPROVE')}
                          >
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => handleRespondInvitation(item.id, 'REJECT')}
                          >
                            <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 13 }}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {/* Ward Cumulative Spending Progress Bar */}
                    {item.status === 'ACTIVE' && (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Cumulative Spent</Text>
                          <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>
                            ₹{spent.toLocaleString('en-IN')} / ₹{limit.toLocaleString('en-IN')}
                          </Text>
                        </View>

                        {/* Progress Bar Container */}
                        <View style={{ height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                          <View
                            style={{
                              height: '100%',
                              width: `${percentSpent}%`,
                              backgroundColor: percentSpent >= 100 ? '#EF4444' : percentSpent >= 80 ? '#F59E0B' : '#10B981',
                              borderRadius: 4,
                            }}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: remaining <= 0 ? '#EF4444' : '#10B981', fontSize: 11, fontWeight: '600', flex: 1, marginRight: 8 }} numberOfLines={1}>
                            {remaining <= 0 ? '⚠️ Limit Exhausted (Approval Req.)' : `₹${remaining.toLocaleString('en-IN')} available limit`}
                          </Text>
                          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '500', flexShrink: 0 }}>
                            Timeout: {timeoutMins}m
                          </Text>
                        </View>

                        {/* Manage Ward Button */}
                        <TouchableOpacity
                          style={{
                            marginTop: 10,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            borderColor: '#3B82F6',
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                          onPress={() => handleOpenWardModal(item)}
                        >
                          <AppIcon name="settings" size={14} color="#60A5FA" />
                          <Text style={{ color: '#60A5FA', fontWeight: '700', fontSize: 12 }}>Manage Limit & Transactions</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─── TAB 3: PENDING APPROVAL REQUESTS ─── */}
        {activeTab === 'approvals' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <AppIcon name="zap" size={18} color="#F59E0B" />
                <Text style={styles.cardTitle}>Pending Payment Approvals</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('GuardianApproval')} style={styles.fullScreenLinkRow}>
                <Text style={styles.fullScreenLink}>Full View </Text>
                <AppIcon name="externalLink" size={12} color="#10B981" />
              </TouchableOpacity>
            </View>

            {pendingApprovals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="checkCircle" size={36} color="#10B981" />
                <Text style={styles.emptyTitle}>All Clear!</Text>
                <Text style={styles.emptyText}>No pending transactions require your guardian authorization right now.</Text>
              </View>
            ) : (
              pendingApprovals.map((req) => {
                const expiresDate = new Date(req.expires_at);
                const minsLeft = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000));
                const isHighRisk = req.fraud_score > 0.7;

                return (
                  <View key={req.id} style={styles.reqCardInner}>
                    <View style={styles.reqHeaderRow}>
                      <View>
                        <Text style={styles.reqWardName}>{req.requester_name || 'Sentinel Ward'}</Text>
                        <Text style={styles.reqWardSub}>+{req.requester_phone}</Text>
                      </View>
                      <View style={[styles.riskChip, { backgroundColor: isHighRisk ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
                        <Text style={[styles.riskChipText, { color: isHighRisk ? '#EF4444' : '#F59E0B' }]}>
                          Risk {(req.fraud_score * 100).toFixed(0)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqBodyRow}>
                      <View>
                        <Text style={styles.reqLabel}>AMOUNT</Text>
                        <Text style={styles.reqAmount}>₹{req.amount.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.reqLabel}>EXPIRES</Text>
                        <View style={styles.timerRow}>
                          <AppIcon name="clock" size={12} color="#F59E0B" />
                          <Text style={styles.reqTime}> {minsLeft} mins left</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.reqActionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectActionBtn]}
                        onPress={() => handleRespondApproval(req.id, 'REJECTED')}
                      >
                        <Text style={styles.rejectActionText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveActionBtn]}
                        onPress={() => handleRespondApproval(req.id, 'APPROVED')}
                      >
                        <Text style={styles.approveActionText}>Approve & Sign</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── OTP CODE VERIFICATION MODAL ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={otpModalVisible}
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleRow}>
                <AppIcon name="key" size={18} color="#10B981" />
                <Text style={styles.modalTitle}>Enter Guardian Code</Text>
              </View>
              <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Enter the 6-digit verification code received by your guardian to complete account linking.
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="123456"
              placeholderTextColor="#475569"
              value={otpInput}
              onChangeText={setOtpInput}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setOtpModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, otpLoading && styles.buttonDisabled]}
                onPress={handleVerifyOtpCode}
                disabled={otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Verify & Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── WARD DETAIL & LIMIT MANAGEMENT MODAL ─── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={wardModalVisible}
        onRequestClose={() => setWardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.cardTitleRow}>
                <AppIcon name="users" size={18} color="#3B82F6" />
                <Text style={styles.modalTitle}>{selectedWard?.ward_name || 'Ward Management'}</Text>
              </View>
              <TouchableOpacity onPress={() => setWardModalVisible(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              {selectedWard?.ward_vpa || selectedWard?.ward_phone}
            </Text>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {/* 1. Cumulative Spending Limit Config */}
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#334155', marginBottom: 14 }]}>
                <Text style={[styles.cardTitle, { fontSize: 13, marginBottom: 4 }]}>Configure Cumulative Spending Limit</Text>
                <Text style={[styles.cardDescription, { fontSize: 11, marginBottom: 10 }]}>
                  Set the total amount this ward can spend before explicit guardian approval is required for all transactions.
                </Text>

                <View style={styles.presetRow}>
                  {['1000', '5000', '10000', '25000'].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, wardLimitInput === preset && styles.presetChipActive]}
                      onPress={() => setWardLimitInput(preset)}
                    >
                      <Text style={[styles.presetChipText, wardLimitInput === preset && styles.presetChipTextActive]}>
                        ₹{parseInt(preset).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.currencyPrefix}>
                    <Text style={styles.currencyText}>₹</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                    placeholder="Limit Amount e.g. 5000"
                    placeholderTextColor="#64748B"
                    value={wardLimitInput}
                    onChangeText={setWardLimitInput}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 2. Approval Request Timeout Config */}
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#334155', marginBottom: 14 }]}>
                <Text style={[styles.cardTitle, { fontSize: 13, marginBottom: 4 }]}>Configure Approval Request Timeout</Text>
                <Text style={[styles.cardDescription, { fontSize: 11, marginBottom: 10 }]}>
                  Duration for approval requests before unapproved transactions automatically expire and cancel.
                </Text>

                <View style={styles.presetRow}>
                  {['1', '3', '5', '10'].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, wardTimeoutInput === preset && styles.presetChipActive]}
                      onPress={() => setWardTimeoutInput(preset)}
                    >
                      <Text style={[styles.presetChipText, wardTimeoutInput === preset && styles.presetChipTextActive]}>
                        {preset} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Timeout in minutes (1 - 60)"
                    placeholderTextColor="#64748B"
                    value={wardTimeoutInput}
                    onChangeText={setWardTimeoutInput}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[styles.saveLimitButton, wardSaving && styles.buttonDisabled, { flex: 2 }]}
                  onPress={handleSaveWardConfig}
                  disabled={wardSaving}
                >
                  {wardSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveLimitButtonText}>Save Ward Config</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveLimitButton, { flex: 1, backgroundColor: '#DC2626' }]}
                  onPress={async () => {
                    if (!selectedWard) return;
                    Alert.alert(
                      'Reset Spending Counter',
                      `Reset cumulative spending counter for ${selectedWard.ward_name || 'ward'} to ₹0.00?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Reset',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              setWardSaving(true);
                              await guardianService.resetWardSpending({ ward_vpa: selectedWard.ward_vpa, ward_phone: selectedWard.ward_phone });
                              Alert.alert('Reset Complete', 'Cumulative spending counter has been reset to ₹0.00.');
                              setWardModalVisible(false);
                              fetchRelationships();
                            } catch (e: any) {
                              Alert.alert('Error', e?.message || 'Failed to reset spending counter.');
                            } finally {
                              setWardSaving(false);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  disabled={wardSaving}
                >
                  <Text style={styles.saveLimitButtonText}>Reset Spend</Text>
                </TouchableOpacity>
              </View>

              {/* 3. Ward Transaction History */}
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
                <Text style={[styles.cardTitle, { fontSize: 13, marginBottom: 8 }]}>Ward Transaction History</Text>
                {wardDetailsLoading ? (
                  <ActivityIndicator color="#3B82F6" size="small" style={{ marginVertical: 12 }} />
                ) : wardDetailsData && wardDetailsData.transactions && wardDetailsData.transactions.length > 0 ? (
                  wardDetailsData.transactions.map((t: any) => (
                    <View key={t.transaction_id} style={[styles.itemRow, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' }]}>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { fontSize: 13 }]}>{t.receiver_vpa}</Text>
                        <Text style={[styles.itemSub, { fontSize: 10 }]}>{new Date(t.created_at || Date.now()).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>₹{t.amount?.toLocaleString('en-IN')}</Text>
                        <Text style={{ color: t.status === 'APPROVED' || t.status === 'SUCCESS' ? '#10B981' : '#EF4444', fontSize: 10, fontWeight: '600' }}>
                          {t.status}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginVertical: 10 }}>No transactions recorded for this ward yet.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContainer: {
    padding: S.base,
    paddingBottom: 100,
  },

  /* HERO DASHBOARD (Matches Home Screen Balance Card) */
  heroCard: {
    backgroundColor: C.dark,
    borderRadius: R.card,
    padding: S.lg,
    marginBottom: S.lg,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.full,
    gap: 6,
  },
  heroBadgeText: {
    color: '#34D399',
    fontSize: T.xs,
    fontWeight: T.bold,
    letterSpacing: 0.5,
  },
  protectedStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.full,
    gap: 6,
  },
  statusDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  protectedStatusText: {
    color: '#60A5FA',
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  heroLabelText: {
    color: '#94A3B8',
    fontSize: T.xs,
    fontWeight: T.bold,
    marginTop: S.xs,
    letterSpacing: 0.5,
  },
  heroAmountText: {
    fontSize: 32,
    fontWeight: T.black,
    color: '#FFFFFF',
    marginVertical: 4,
  },
  heroSubtitle: {
    fontSize: T.sm,
    color: '#94A3B8',
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: R.xl,
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
    marginTop: S.base,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: T.xl,
    fontWeight: T.extrabold,
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: T.xs,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: T.medium,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },

  /* SEGMENTED TAB SELECTOR */
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 4,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: S.sm,
    alignItems: 'center',
    borderRadius: R.md,
  },
  segmentBtnActive: {
    backgroundColor: C.dark,
  },
  tabIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    fontSize: T.sm,
    fontWeight: T.bold,
    color: C.textSecondary,
  },
  segmentTextActive: {
    color: C.textInverse,
  },
  tabBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabCountPill: {
    backgroundColor: C.red,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  tabCountText: {
    color: C.textInverse,
    fontSize: T.caption,
    fontWeight: T.extrabold,
  },

  /* CARDS */
  card: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    padding: S.base,
    marginBottom: S.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: T.lg,
    fontWeight: T.extrabold,
    color: C.textPrimary,
  },
  cardDescription: {
    fontSize: T.sm,
    color: C.textSecondary,
    marginBottom: S.base,
    lineHeight: 18,
  },
  fullScreenLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullScreenLink: {
    color: C.blue,
    fontSize: T.sm,
    fontWeight: T.bold,
  },

  /* PRESETS & INPUTS */
  presetRow: {
    flexDirection: 'row',
    gap: S.sm,
    marginBottom: S.base,
  },
  presetChip: {
    flex: 1,
    height: 44,
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  presetChipActive: {
    backgroundColor: C.greenBg,
    borderColor: C.green,
  },
  presetChipText: {
    color: C.textSecondary,
    fontSize: T.sm,
    fontWeight: T.bold,
  },
  presetChipTextActive: {
    color: C.green,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  currencyPrefix: {
    backgroundColor: C.surfaceAlt,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: R.md,
    borderBottomLeftRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  currencyPrefixText: {
    color: C.textPrimary,
    fontSize: T.md,
    fontWeight: T.extrabold,
  },
  currencyText: {
    color: C.textPrimary,
    fontSize: T.md,
    fontWeight: T.extrabold,
  },
  limitInput: {
    flex: 1,
    height: 52,
    backgroundColor: C.surface,
    borderTopRightRadius: R.md,
    borderBottomRightRadius: R.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: C.border,
    paddingHorizontal: 14,
    fontSize: T.body,
    fontWeight: T.bold,
    color: C.textPrimary,
  },
  saveLimitBtn: {
    backgroundColor: C.dark,
    paddingHorizontal: S.lg,
    height: 52,
    borderRadius: R.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveLimitButton: {
    backgroundColor: C.dark,
    paddingHorizontal: S.lg,
    height: 52,
    borderRadius: R.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveLimitBtnText: {
    color: C.textInverse,
    fontSize: T.sm,
    fontWeight: T.extrabold,
  },
  saveLimitButtonText: {
    color: C.textInverse,
    fontSize: T.sm,
    fontWeight: T.extrabold,
  },
  inviteButton: {
    backgroundColor: C.dark,
    borderRadius: R.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    marginLeft: 8,
  },
  inviteButtonText: {
    color: C.textInverse,
    fontSize: T.body,
    fontWeight: T.extrabold,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    height: 52,
    fontSize: T.body,
    fontWeight: T.bold,
    color: C.textPrimary,
  },
  button: {
    backgroundColor: C.dark,
    borderRadius: R.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.lg,
  },
  buttonText: {
    color: C.textInverse,
    fontSize: T.body,
    fontWeight: T.extrabold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  /* LIST ITEMS */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: C.textInverse,
    fontSize: T.md,
    fontWeight: T.black,
  },
  itemInfo: {
    flex: 1,
    marginLeft: S.md,
  },
  itemName: {
    fontSize: T.body,
    fontWeight: T.bold,
    color: C.textPrimary,
  },
  itemSub: {
    fontSize: T.xs,
    color: C.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: C.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillText: {
    color: C.green,
    fontSize: T.xs,
    fontWeight: T.extrabold,
  },
  enterCodePill: {
    backgroundColor: C.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  enterCodePillText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  pillText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  acceptBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptBtnText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 8,
  },

  /* EMPTY STATES */
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: S.xxl,
    paddingHorizontal: S.lg,
  },
  emptyTitle: {
    color: C.textPrimary,
    fontSize: T.md,
    fontWeight: T.extrabold,
    marginTop: S.md,
    marginBottom: S.xs,
    textAlign: 'center',
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: T.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* OTP FEED */
  otpFeedItem: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    padding: S.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  otpFeedUser: {
    color: C.textSecondary,
    fontSize: T.xs,
  },
  otpFeedCode: {
    color: C.green,
    fontSize: T.lg,
    fontWeight: T.black,
    marginTop: 2,
  },
  verifyDirectBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyDirectBtnText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.bold,
  },

  /* APPROVAL CARDS IN TAB */
  reqCardInner: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reqWardName: {
    color: C.textPrimary,
    fontSize: T.body,
    fontWeight: T.bold,
  },
  reqWardSub: {
    color: C.textSecondary,
    fontSize: T.xs,
  },
  riskChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskChipText: {
    fontSize: T.xs,
    fontWeight: T.extrabold,
  },
  reqBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqLabel: {
    color: C.textSecondary,
    fontSize: T.caption,
    fontWeight: T.bold,
  },
  reqAmount: {
    color: C.green,
    fontSize: T.lg,
    fontWeight: T.black,
    marginTop: 2,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reqTime: {
    color: C.amber,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  reqActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectActionBtn: {
    backgroundColor: C.redBg,
  },
  rejectActionText: {
    color: C.red,
    fontSize: T.xs,
    fontWeight: T.bold,
  },
  approveActionBtn: {
    backgroundColor: C.green,
  },
  approveActionText: {
    color: C.textInverse,
    fontSize: T.xs,
    fontWeight: T.extrabold,
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.base,
  },
  modalContent: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: S.xl,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: T.xl,
    fontWeight: T.black,
    color: C.textPrimary,
  },
  modalCloseIcon: {
    color: C.textTertiary,
    fontSize: T.lg,
    fontWeight: T.bold,
  },
  modalSubtitle: {
    fontSize: T.sm,
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: S.lg,
  },
  otpInput: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    borderWidth: 2,
    borderColor: C.green,
    height: 52,
    fontSize: T.xxl,
    fontWeight: T.black,
    color: C.green,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: S.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: S.base,
    paddingVertical: 10,
    borderRadius: R.md,
    marginRight: 8,
  },
  modalCancelBtnText: {
    color: C.textSecondary,
    fontWeight: T.bold,
    fontSize: T.body,
  },
  modalSubmitBtn: {
    backgroundColor: C.dark,
    paddingHorizontal: S.lg,
    paddingVertical: 10,
    borderRadius: R.md,
  },
  modalSubmitBtnText: {
    color: C.textInverse,
    fontWeight: T.bold,
    fontSize: T.body,
  },
});
