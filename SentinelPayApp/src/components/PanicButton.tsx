import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from './AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

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
        <AppIcon name={isFrozen ? 'lock' : 'siren'} size={24} color={C.textInverse} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={DS.modalCenter}>
          <View style={DS.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
              <AppIcon name="siren" size={22} color={C.red} />
              <Text style={[DS.cardTitle, { color: C.red }]}>Emergency Panic Button</Text>
            </View>
            <Text style={[DS.cardSub, { marginBottom: S.sm }]}>
              Are you currently being coerced or scammed? Activating Emergency Panic will:
            </Text>
            <Text style={[DS.cardSub, { color: C.textPrimary, fontWeight: T.bold, marginBottom: 4 }]}>• Freeze all outbound UPI payments instantly</Text>
            <Text style={[DS.cardSub, { color: C.textPrimary, fontWeight: T.bold, marginBottom: 4 }]}>• Lock SentinelPay wallet transfers</Text>
            <Text style={[DS.cardSub, { color: C.textPrimary, fontWeight: T.bold, marginBottom: 4 }]}>• Generate downloadable Incident Report</Text>

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              <TouchableOpacity
                style={[DS.btn, DS.btnOutline, { flex: 1 }]}
                onPress={() => setModalVisible(false)}>
                <Text style={DS.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[DS.btn, DS.btnDanger, { flex: 1 }]}
                onPress={handlePanicAction}>
                <Text style={DS.btnText}>FREEZE NOW</Text>
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
    bottom: 100,
    right: 24,
    backgroundColor: C.red,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    zIndex: 999,
  },
  frozenFab: {
    backgroundColor: C.green,
    shadowColor: C.green,
  },
});
