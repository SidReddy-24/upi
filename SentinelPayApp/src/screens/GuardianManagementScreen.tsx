import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import guardianService, { GuardianRelationship, WardRelationship } from '../services/guardianService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GuardianManagement'>;
};

export default function GuardianManagementScreen({ navigation }: Props) {
  const [guardians, setGuardians] = useState<GuardianRelationship[]>([]);
  const [wards, setWards] = useState<WardRelationship[]>([]);
  const [inviteInput, setInviteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    fetchRelationships();
  }, []);

  const fetchRelationships = async () => {
    setLoading(true);
    try {
      const data = await guardianService.listGuardians();
      setGuardians(data.guardians);
      setWards(data.wards);
    } catch (e: any) {
      console.warn('Failed to load relationships:', e);
      Alert.alert('Error', 'Could not load guardian data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    const input = inviteInput.trim();
    if (!input) {
      Alert.alert('Validation Error', 'Please enter a VPA or phone number');
      return;
    }

    setInviteLoading(true);
    try {
      const isVpa = input.includes('@');
      const payload = isVpa ? { vpa: input } : { phone: input };
      
      const res = await guardianService.addGuardian(payload.phone, payload.vpa);
      if (res) {
        Alert.alert('Invite Sent', 'Guardian invitation sent successfully!');
        setInviteInput('');
        fetchRelationships();
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Failed to send guardian invitation. Account may not exist.';
      Alert.alert('Invitation Failed', msg);
    } finally {
      setInviteLoading(false);
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} refreshControl={
        <ActivityIndicator animating={loading && guardians.length === 0} color="#6366f1" style={{ marginVertical: 12 }} />
      }>
        <View style={styles.header}>
          <Text style={styles.title}>Guardian Safety net</Text>
          <Text style={styles.subtitle}>
            Add trusted users (guardians) to approve high-risk payments, or accept invitations to protect other users.
          </Text>
        </View>

        {/* ─── ADD GUARDIAN FORM ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invite a Guardian</Text>
          <Text style={styles.cardDescription}>
            Enter the VPA or Mobile Number of a user with a SentinelPay account. They must accept your invite before they can protect your transactions.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9999999902 or name@sentinelpay"
              placeholderTextColor="#94a3b8"
              value={inviteInput}
              onChangeText={setInviteInput}
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.inviteButtonText}>Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── LIST OF GUARDIANS (PROTECTING ME) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>My Guardians (Protecting Me)</Text>
            <Text style={styles.countBadge}>{guardians.length}/5</Text>
          </View>
          
          {guardians.length === 0 ? (
            <Text style={styles.emptyText}>No guardians configured. Add one above to enable secure transaction coverage.</Text>
          ) : (
            guardians.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.guardian_name || 'Sentinel User'}</Text>
                  <Text style={styles.itemSub}>{item.guardian_vpa || item.guardian_phone}</Text>
                </View>
                <View style={styles.itemActions}>
                  <Text style={[styles.statusText, item.status === 'ACTIVE' ? styles.statusActive : styles.statusPending]}>
                    {item.status}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveRelationship(item.id, item.guardian_name || 'this user', 'guardian')}
                  >
                    <Text style={styles.removeBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ─── LIST OF WARDS (ME PROTECTING THEM) ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Users I am Protecting (Wards)</Text>
          
          {wards.length === 0 ? (
            <Text style={styles.emptyText}>You are not currently protecting any wards.</Text>
          ) : (
            wards.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.ward_name || 'Sentinel User'}</Text>
                  <Text style={styles.itemSub}>{item.ward_vpa || item.ward_phone}</Text>
                </View>
                <View style={styles.itemActions}>
                  {item.status === 'PENDING' ? (
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptInvite(item.id)}
                    >
                      <Text style={styles.acceptBtnText}>Accept Invite</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.row}>
                      <Text style={[styles.statusText, styles.statusActive]}>PROTECTING</Text>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveRelationship(item.id, item.ward_name || 'this user', 'ward')}
                      >
                        <Text style={styles.removeBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
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
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: '#334155',
    color: '#38bdf8',
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 12,
  },
  inviteButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  itemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#10b98122',
    color: '#10b981',
  },
  statusPending: {
    backgroundColor: '#f59e0b22',
    color: '#f59e0b',
  },
  removeBtn: {
    padding: 6,
  },
  removeBtnText: {
    fontSize: 18,
  },
  acceptBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
