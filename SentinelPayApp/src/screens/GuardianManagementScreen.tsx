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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import guardianService, { GuardianRelationship, WardRelationship, PendingRequest } from '../services/guardianService';
import { getSettings, updateSettings } from '../utils/settingsDb';
import AppIcon from '../components/AppIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GuardianManagement'>;
};

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

  useEffect(() => {
    fetchRelationships();
    loadLimit();

    // Subscribe to real-time guardian events
    const unsubscribe = guardianService.subscribe((event) => {
      if (event.type === 'GUARDIAN_VERIFICATION_CODE') {
        const { relationship_id, code, inviter_name, inviter_phone } = event.data;
        setVerificationLogs((prev) => [
          { id: relationship_id || String(Date.now()), code, inviter: inviter_name || 'Sentinel User', phone: inviter_phone },
          ...prev,
        ]);
        fetchRelationships();
        Alert.alert(
          'Guardian Verification OTP Code',
          `Verification code for ${inviter_name || 'User'} (${inviter_phone || ''}): ${code}\n\nShare this code with your ward to complete guardian setup.`
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
        fetchRelationships();

        // Code is sent to the guardian via WebSocket/SMS, notify ward to ask guardian for code
        Alert.alert(
          'Invitation Sent',
          `Guardian invitation sent to ${input}. Please ask your guardian for the 6-digit verification code to complete setup.`
        );

        // Open OTP verification modal for ward to enter guardian's code
        setVerifyingRelId(res.relationship_id);
        setOtpInput('');
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

  const handleAcceptInvite = async (relationshipId: string) => {
    try {
      setLoading(true);
      await guardianService.acceptInvitation(relationshipId);
      Alert.alert('Success', 'You are now an active guardian!');
      fetchRelationships();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept invitation.');
    } finally {
      setLoading(false);
    }
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRelationships} tintColor="#10B981" />
        }
      >
        {/* ─── 1. HERO SAFETY DASHBOARD ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroBadge}>
              <AppIcon name="shield" size={12} color="#10B981" />
              <Text style={styles.heroBadgeText}>ACTIVE SAFETY NET</Text>
            </View>
            <TouchableOpacity onPress={fetchRelationships} style={styles.refreshBtnIcon}>
              <AppIcon name="refresh" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>Guardian Safety Net</Text>
          <Text style={styles.heroSubtitle}>
            Protect your funds with trusted guardians. Payments above your limit require instant guardian approval.
          </Text>

          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{activeGuardianCount}/5</Text>
              <Text style={styles.metricLabel}>Guardians</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>₹{parseFloat(spendingLimit || '0').toLocaleString('en-IN')}</Text>
              <Text style={styles.metricLabel}>Limit Threshold</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{activeWardCount}</Text>
              <Text style={styles.metricLabel}>Wards Protected</Text>
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
                            setVerifyingRelId(item.id);
                            setOtpInput('');
                            setOtpModalVisible(true);
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
              As a guardian, you will receive real-time notifications to review and approve high-risk or high-value transfers initiated by these users.
            </Text>

            {wards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="users" size={36} color="#475569" />
                <Text style={styles.emptyTitle}>Not Protecting Anyone Yet</Text>
                <Text style={styles.emptyText}>When another user adds you as their guardian, their requests will appear here.</Text>
              </View>
            ) : (
              wards.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: '#3B82F6' }]}>
                    <Text style={styles.avatarLetter}>{(item.ward_name || 'W')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.ward_name || 'Sentinel Ward'}</Text>
                    <Text style={styles.itemSub}>{item.ward_vpa || item.ward_phone}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    {item.status === 'PENDING' ? (
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {item.verification_code && (
                          <View style={styles.otpFeedItem}>
                            <Text style={styles.otpFeedUser}>Code to share with ward:</Text>
                            <Text style={styles.otpFeedCode}>{item.verification_code}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => handleAcceptInvite(item.id)}
                        >
                          <Text style={styles.acceptBtnText}>Accept & Link</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.row}>
                        <View style={[styles.activePill, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                          <Text style={[styles.activePillText, { color: '#60A5FA' }]}>PROTECTING</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveRelationship(item.id, item.ward_name || 'this user', 'ward')}
                        >
                          <AppIcon name="trash" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3EA',
  },
  scrollContainer: {
    padding: 18,
    paddingBottom: 40,
  },

  /* HERO DASHBOARD */
  heroCard: {
    backgroundColor: '#EFE7DA',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DCD1BF',
    shadowColor: '#181818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 139, 87, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  heroBadgeText: {
    color: '#236847',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  refreshBtnIcon: {
    padding: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#181818',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 6,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F7F3EA',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2E8B57',
  },
  metricLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#DCD1BF',
  },

  /* SEGMENTED TAB SELECTOR */
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFE7DA',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#2E8B57',
  },
  tabIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabCountPill: {
    backgroundColor: '#C0392B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  tabCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* CARDS */
  card: {
    backgroundColor: '#EFE7DA',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#181818',
  },
  cardDescription: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 14,
    lineHeight: 18,
  },
  fullScreenLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullScreenLink: {
    color: '#2E8B57',
    fontSize: 13,
    fontWeight: '700',
  },

  /* PRESETS & INPUTS */
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#F7F3EA',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  presetChipActive: {
    backgroundColor: 'rgba(46, 139, 87, 0.15)',
    borderColor: '#2E8B57',
  },
  presetChipText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#236847',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    backgroundColor: '#E5DCCB',
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  currencyText: {
    color: '#2E8B57',
    fontSize: 18,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#F7F3EA',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#181818',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  inviteButton: {
    backgroundColor: '#2E8B57',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  saveLimitButton: {
    backgroundColor: '#236847',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  saveLimitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  /* LIST ITEMS */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DCD1BF',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E8B57',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#181818',
  },
  itemSub: {
    fontSize: 12,
    color: '#666666',
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
    backgroundColor: 'rgba(46, 139, 87, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillText: {
    color: '#236847',
    fontSize: 11,
    fontWeight: '800',
  },
  enterCodePill: {
    backgroundColor: '#2E8B57',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  enterCodePillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: '#2E8B57',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 6,
    marginLeft: 8,
  },

  /* EMPTY STATES */
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    color: '#181818',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* OTP FEED */
  otpFeedItem: {
    backgroundColor: '#F7F3EA',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  otpFeedUser: {
    color: '#666666',
    fontSize: 12,
  },
  otpFeedCode: {
    color: '#2E8B57',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  verifyDirectBtn: {
    backgroundColor: '#2E8B57',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyDirectBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* APPROVAL CARDS IN TAB */
  reqCardInner: {
    backgroundColor: '#F7F3EA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reqWardName: {
    color: '#181818',
    fontSize: 14,
    fontWeight: '700',
  },
  reqWardSub: {
    color: '#666666',
    fontSize: 12,
  },
  riskChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reqBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqLabel: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
  },
  reqAmount: {
    color: '#2E8B57',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reqTime: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: 'rgba(192, 57, 43, 0.15)',
  },
  rejectActionText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '700',
  },
  approveActionBtn: {
    backgroundColor: '#2E8B57',
  },
  approveActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#EFE7DA',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#DCD1BF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#181818',
  },
  modalCloseIcon: {
    color: '#666666',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 20,
  },
  otpInput: {
    backgroundColor: '#F7F3EA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E8B57',
    height: 54,
    fontSize: 22,
    fontWeight: '900',
    color: '#2E8B57',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  modalCancelBtnText: {
    color: '#666666',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: '#2E8B57',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSubmitBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
