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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import guardianService, { PendingRequest } from '../services/guardianService';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
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
    
    const unsubscribe = guardianService.subscribe((event) => {
      if (event.type === 'APPROVAL_REQUEST') {
        fetchRequests();
        Alert.alert('SECURITY NOTICE', `New high-risk transaction request received from ward: ${event.data.requester_name || 'Sentinel User'}`);
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
    const scoreColor = isHighRisk ? C.red : C.amber;

    return (
      <View style={DS.rowCard}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={[DS.iconSm, { backgroundColor: C.dark }]}>
                <Text style={{ color: C.textInverse, fontWeight: T.bold }}>{(item.requester_name || 'U')[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={DS.cardTitle}>{item.requester_name || 'Sentinel User'}</Text>
                <Text style={DS.cardSub}>+{item.requester_phone}</Text>
              </View>
            </View>

            <View style={[DS.pillBadge, { backgroundColor: isHighRisk ? C.redBg : C.amberBg }]}>
              <Text style={{ fontSize: T.caption, fontWeight: T.bold, color: scoreColor }}>
                AI RISK: {Math.round(item.fraud_score * 100)}%
              </Text>
            </View>
          </View>

          <View style={[DS.infoCard, { backgroundColor: C.surfaceAlt, marginBottom: S.xs }]}>
            <View style={{ flex: 1 }}>
              <Text style={DS.label}>AMOUNT</Text>
              <Text style={{ fontSize: T.md, fontWeight: T.extrabold, color: C.green }}>₹{item.amount.toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={DS.label}>RECIPIENT VPA</Text>
              <Text style={DS.cardTitle} numberOfLines={1}>{item.recipient_vpa}</Text>
            </View>
          </View>

          {item.risk_signals && item.risk_signals.length > 0 && (
            <View style={[DS.infoCard, { backgroundColor: C.redBg, marginBottom: S.xs, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: 4 }}>
                <AppIcon name="alert" size={14} color={C.red} />
                <Text style={{ fontSize: T.xs, fontWeight: T.extrabold, color: C.red }}>DETECTED RISK SIGNALS:</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {item.risk_signals.map((sig, idx) => (
                  <View key={idx} style={[DS.pillBadge, { backgroundColor: C.surface }]}>
                    <Text style={{ fontSize: T.caption, color: C.red, fontWeight: T.bold }}>{sig.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
            <AppIcon name="clock" size={14} color={C.amber} />
            <Text style={{ fontSize: T.xs, color: C.textSecondary }}>
              Expires in: <Text style={{ fontWeight: T.bold, color: C.amber }}>{minsLeft} mins</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <TouchableOpacity
              style={[DS.btn, DS.btnDanger, { flex: 1 }]}
              onPress={() => handleOpenRespond(item, 'REJECTED')}
              activeOpacity={0.7}
            >
              <Text style={DS.btnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[DS.btn, DS.btnSuccess, { flex: 1 }]}
              onPress={() => handleOpenRespond(item, 'APPROVED')}
              activeOpacity={0.7}
            >
              <Text style={DS.btnText}>Approve & Sign</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={DS.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={DS.headerBar}>
        <Text style={DS.pageTitle}>Pending Approvals</Text>
      </View>

      {loading && requests.length === 0 ? (
        <View style={[DS.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={DS.scrollContent}
          ListEmptyComponent={
            <View style={DS.emptyCard}>
              <AppIcon name="checkCircle" size={40} color={C.green} />
              <Text style={DS.emptyTitle}>All Clear!</Text>
              <Text style={DS.emptySub}>No pending transactions require your guardian authorization.</Text>
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
        <View style={DS.modalCenter}>
          <View style={DS.modalCard}>
            <Text style={DS.cardTitle}>
              Confirm {decision === 'APPROVED' ? 'Approval' : 'Rejection'}
            </Text>
            
            <Text style={[DS.cardSub, { marginVertical: S.md }]}>
              Are you sure you want to {decision === 'APPROVED' ? 'approve' : 'reject'} this payment of{' '}
              <Text style={{ color: C.textPrimary, fontWeight: T.bold }}>₹{selectedRequest?.amount.toLocaleString('en-IN')}</Text> initiated by{' '}
              {selectedRequest?.requester_name || 'Sentinel User'}?
            </Text>

            <Text style={DS.inputLabel}>OPTIONAL NOTE / EXPLANATION</Text>
            <TextInput
              style={DS.inputStandalone}
              placeholder="e.g. Verified over phone call."
              placeholderTextColor={C.textTertiary}
              value={note}
              onChangeText={setNote}
            />

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
              <TouchableOpacity
                style={[DS.btn, DS.btnOutline, { flex: 1 }]}
                onPress={() => setSelectedRequest(null)}
                disabled={respondLoading}
              >
                <Text style={DS.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  DS.btn,
                  decision === 'APPROVED' ? DS.btnSuccess : DS.btnDanger,
                  { flex: 1 }
                ]}
                onPress={handleRespond}
                disabled={respondLoading}
              >
                {respondLoading ? (
                  <ActivityIndicator color={C.textInverse} size="small" />
                ) : (
                  <Text style={DS.btnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
