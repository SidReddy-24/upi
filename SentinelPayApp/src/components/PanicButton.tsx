import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from './AppIcon';

export const PANIC_FROZEN_KEY = 'sentinelpay_wallet_frozen';

export default function PanicButton() {
  const [modalVisible, setModalVisible] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(PANIC_FROZEN_KEY).then(val => {
      if (val === 'true') setIsFrozen(true);
    });
  }, []);

  const handlePanicAction = async () => {
    await AsyncStorage.setItem(PANIC_FROZEN_KEY, 'true');
    setIsFrozen(true);
    setModalVisible(false);
    Alert.alert(
      '🚨 EMERGENCY PANIC ACTIVATED',
      'Wallet payments have been instantly frozen. Your bank & guardian alerts (simulated) have been dispatched. Incident report generated.',
      [{ text: 'OK' }]
    );
  };

  const handleUnfreeze = async () => {
    await AsyncStorage.removeItem(PANIC_FROZEN_KEY);
    setIsFrozen(false);
    Alert.alert('✅ Wallet Unfrozen', 'Payments restored.');
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.panicFab, isFrozen && styles.frozenFab]}
        activeOpacity={0.8}
        onPress={() => (isFrozen ? handleUnfreeze() : setModalVisible(true))}>
        <AppIcon name={isFrozen ? 'lock' : 'siren'} size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <AppIcon name="siren" size={22} color="#DC2626" />
              <Text style={styles.modalTitle}>Emergency Panic Button</Text>
            </View>
            <Text style={styles.modalDesc}>
              Are you currently being coerced or scammed? Activating Emergency Panic will:
            </Text>
            <Text style={styles.bullet}>• Freeze all outbound UPI payments instantly</Text>
            <Text style={styles.bullet}>• Lock SentinelPay wallet transfers</Text>
            <Text style={styles.bullet}>• Generate downloadable Incident Report</Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPanicBtn}
                onPress={handlePanicAction}>
                <Text style={styles.confirmPanicText}>FREEZE NOW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  panicFab: {
    position: 'absolute',
    bottom: 88,
    right: 16,
    backgroundColor: '#DC2626',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 999,
  },
  frozenFab: {
    backgroundColor: '#16a34a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#dc2626',
  },
  modalDesc: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#374151',
    fontWeight: '600',
  },
  confirmPanicBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  confirmPanicText: {
    color: '#fff',
    fontWeight: '800',
  },
});
