import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import guardianService, { PendingRequest } from '../services/guardianService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function GuardianApprovalScreen() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Respond Modal states
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [note, setNote] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
    
    // Subscribe to real-time WebSocket updates
    const unsubscribe = guardianService.subscribe((event) => {
      console.log('[GuardianApprovalScreen] WebSocket update received:', event);
      if (event.type === 'APPROVAL_REQUEST') {
        fetchRequests();
        Alert.alert('🚨 SECURITY NOTICE', `New high-risk transaction request received from ward: ${event.data.requester_name || 'Sentinel User'}`);
      } else if (event.type === 'APPROVAL_RESPONSE') {
        fetchRequests();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await guardianService.getPendingRequests();
      setRequests(data.incoming || []);
    } catch (e) {
      console.warn('Failed to load pending requests:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRespond = (req: PendingRequest, dec: 'APPROVED' | 'REJECTED') => {
    setSelectedRequest(req);
    setDecision(dec);
    setNote('');
  };

  const handleRespond = async () => {
    if (!selectedRequest || !decision) return;

    setRespondLoading(true);
    try {
      await guardianService.respondToRequest(selectedRequest.id, decision, note.trim() || undefined);
      Alert.alert('Response Logged', `Transaction has been successfully ${decision.toLowerCase()}.`);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      Alert.alert('Response Failed', error.response?.data?.detail || 'Could not log response.');
    } finally {
      setRespondLoading(false);
    }
  };

  const renderRequestItem = ({ item }: { item: PendingRequest }) => {
    const expiresDate = new Date(item.expires_at);
    const minsLeft = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000));
    
    const isHighRisk = item.fraud_score > 0.7;
    const scoreColor = isHighRisk ? '#EF4444' : '#F59E0B';

    return (
      <View style={styles.reqCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{(item.requester_name || 'U')[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.wardName}>{item.requester_name || 'Sentinel User'}</Text>
              <Text style={styles.wardPhone}>+{item.requester_phone}</Text>
            </View>
          </View>

          <View style={[styles.scoreContainer, { backgroundColor: isHighRisk ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
            <Text style={styles.scoreLabel}>AI RISK</Text>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{(item.fraud_score * 100).toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>PAYMENT AMOUNT</Text>
            <Text style={styles.detailAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>RECIPIENT VPA</Text>
            <Text style={styles.detailVal} numberOfLines={1} ellipsizeMode="middle">{item.recipient_vpa}</Text>
          </View>
        </View>

        {item.risk_signals && item.risk_signals.length > 0 && (
          <View style={styles.signalsContainer}>
            <Text style={styles.signalsLabel}>DETECTED RISK SIGNALS:</Text>
            <View style={styles.signalsList}>
              {item.risk_signals.map((sig, idx) => (
                <View key={idx} style={styles.signalBadge}>
                  <Text style={styles.signalBadgeText}>⚠️ {sig.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.expiryRow}>
          <Text style={styles.expiryText}>
            ⏱️ Expires in: <Text style={styles.expiryTime}>{minsLeft} mins</Text>
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            onPress={() => handleOpenRespond(item, 'REJECTED')}
          >
            <Text style={styles.rejectBtnText}>Reject Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() => handleOpenRespond(item, 'APPROVED')}
          >
            <Text style={styles.approveBtnText}>Approve & Sign</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Approvals</Text>
        <Text style={styles.subtitle}>
          Review and authorize high-risk transaction requests submitted by your protected wards.
        </Text>
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🛡️</Text>
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptyText}>No pending transactions require your guardian authorization.</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={fetchRequests}
        />
      )}

      {/* ─── RESPONSE MODAL ─── */}
      <Modal
        visible={selectedRequest !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Confirm {decision === 'APPROVED' ? 'Approval' : 'Rejection'}
            </Text>
            
            <Text style={styles.modalSubtitle}>
              Are you sure you want to {decision === 'APPROVED' ? 'approve' : 'reject'} this payment of{' '}
              <Text style={styles.bold}>₹{selectedRequest?.amount.toLocaleString('en-IN')}</Text> initiated by{' '}
              {selectedRequest?.requester_name || 'Sentinel User'}?
            </Text>

            <Text style={styles.inputLabel}>OPTIONAL NOTE / EXPLANATION</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Verified over phone call."
              placeholderTextColor="#64748B"
              value={note}
              onChangeText={setNote}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setSelectedRequest(null)}
                disabled={respondLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  decision === 'APPROVED' ? styles.confirmApproveBtn : styles.confirmRejectBtn,
                ]}
                onPress={handleRespond}
                disabled={respondLoading}
              >
                {respondLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnText}>Submit Decision</Text>
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
    backgroundColor: '#0B0F17',
  },
  header: {
    padding: 20,
    backgroundColor: '#161F30',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 18,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 18,
  },
  reqCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 12,
    marginBottom: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  wardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  wardPhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scoreContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 3,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 3,
  },
  signalsContainer: {
    backgroundColor: '#0B0F17',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  signalsLabel: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  signalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  signalBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  signalBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  expiryText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  expiryTime: {
    fontWeight: '700',
    color: '#F59E0B',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 22,
  },
  modalContent: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  bold: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#0B0F17',
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#1E293B',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  confirmApproveBtn: {
    backgroundColor: '#10B981',
  },
  confirmRejectBtn: {
    backgroundColor: '#EF4444',
  },
  modalBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
