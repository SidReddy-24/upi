import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PANIC_FROZEN_KEY = 'sentinelpay_wallet_frozen';

export default function PanicButton() {
  const [modalVisible, setModalVisible] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

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
    Alert.alert('🛡️ Wallet Unfrozen', 'Payments restored.');
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.panicFab, isFrozen && styles.frozenFab]}
        onPress={() => (isFrozen ? handleUnfreeze() : setModalVisible(true))}>
        <Text style={styles.panicFabText}>{isFrozen ? '🔓' : '🚨'}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🚨 Emergency Panic Button</Text>
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
    bottom: 24,
    right: 24,
    backgroundColor: '#dc2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 999,
  },
  frozenFab: {
    backgroundColor: '#16a34a',
  },
  panicFabText: {
    fontSize: 26,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#dc2626',
    marginBottom: 12,
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
