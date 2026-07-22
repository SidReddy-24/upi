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
        // Automatically inject or reload
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
      setRequests(data.incoming);
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
    
    const scoreColor = item.fraud_score > 0.8 ? '#f43f5e' : '#f59e0b';

    return (
      <View style={styles.reqCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.wardName}>{item.requester_name || 'Sentinel User'}</Text>
            <Text style={styles.wardPhone}>+{item.requester_phone}</Text>
          </View>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>AI Risk</Text>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{(item.fraud_score * 100).toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>AMOUNT</Text>
            <Text style={styles.detailVal}>₹{item.amount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>RECIPIENT VPA</Text>
            <Text style={styles.detailVal} numberOfLines={1} ellipsizeMode="middle">{item.recipient_vpa}</Text>
          </View>
        </View>

        {item.risk_signals && item.risk_signals.length > 0 && (
          <View style={styles.signalsContainer}>
            <Text style={styles.signalsLabel}>CRITICAL RISK SIGNALS CHECKED:</Text>
            <View style={styles.signalsList}>
              {item.risk_signals.map((sig, idx) => (
                <Text key={idx} style={styles.signalBadge}>⚠️ {sig.replace(/_/g, ' ')}</Text>
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
            <Text style={styles.btnText}>Reject Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() => handleOpenRespond(item, 'APPROVED')}
          >
            <Text style={styles.btnText}>Approve & Sign</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Ward Approvals</Text>
        <Text style={styles.subtitle}>
          Securely review and sign off on high-risk transactions requested by users protecting themselves under your coverage.
        </Text>
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
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
              <Text style={styles.emptyText}>All Clear! No pending approvals required.</Text>
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

            <Text style={styles.inputLabel}>Add a Note / Explanation (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Confirmed details over phone call."
              placeholderTextColor="#64748b"
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
                <Text style={styles.cancelBtnText}>Go Back</Text>
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
                  <ActivityIndicator color="#fff" />
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
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    lineHeight: 18,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
  },
  reqCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 12,
  },
  wardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  wardPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailVal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 4,
  },
  signalsContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  signalsLabel: {
    fontSize: 11,
    color: '#f43f5e',
    fontWeight: '700',
    marginBottom: 8,
  },
  signalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  signalBadge: {
    backgroundColor: '#f43f5e15',
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expiryText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  expiryTime: {
    fontWeight: '700',
    color: '#f59e0b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  approveBtn: {
    backgroundColor: '#10b981',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 20,
  },
  bold: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  confirmApproveBtn: {
    backgroundColor: '#10b981',
  },
  confirmRejectBtn: {
    backgroundColor: '#ef4444',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
