import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Vibration,
} from 'react-native';

interface UpiPinModalProps {
  visible: boolean;
  amount: number;
  receiverVpa: string;
  bankName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function UpiPinModal({
  visible,
  amount,
  receiverVpa,
  bankName = 'HDFC Bank •••• 4821',
  onSuccess,
  onCancel,
}: UpiPinModalProps) {
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const PIN_LENGTH = 4;

  const handleKeyPress = (num: string) => {
    setErrorMsg(null);
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setErrorMsg(null);
    if (pin.length > 0) {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = () => {
    if (pin.length !== PIN_LENGTH) {
      setErrorMsg(`Please enter a ${PIN_LENGTH}-digit UPI PIN`);
      Vibration.vibrate(100);
      return;
    }

    // Default demo PINs or any 4-digit PIN accepted for demo (e.g. 1234, or non-empty valid 4 digits)
    // Accept any 4-digit pin or validate 1234
    onSuccess();
    setPin('');
    setErrorMsg(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.npciContainer}>
            <Text style={styles.npciBadge}>UPI</Text>
            <Text style={styles.npciSub}>NPCI SECURED</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* Payment Target Card */}
        <View style={styles.targetCard}>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Paying from:</Text>
            <Text style={styles.bankValue}>🏦 {bankName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.payeeRow}>
            <View>
              <Text style={styles.payeeLabel}>Paying to:</Text>
              <Text style={styles.payeeVpa}>{receiverVpa}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountText}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* PIN Entry Area */}
        <View style={styles.pinArea}>
          <Text style={styles.pinTitle}>ENTER {PIN_LENGTH}-DIGIT UPI PIN</Text>

          {/* Masked Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => {
              const isFilled = index < pin.length;
              return (
                <View
                  key={index}
                  style={[styles.dot, isFilled && styles.dotFilled]}
                >
                  {isFilled && (
                    <Text style={styles.dotText}>
                      {showPin ? pin[index] : '●'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.showPinBtn}
            onPress={() => setShowPin(!showPin)}
          >
            <Text style={styles.showPinText}>
              {showPin ? '👁️ Hide PIN' : '👁️ Show PIN'}
            </Text>
          </TouchableOpacity>

          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <Text style={styles.pinHint}>Never share your UPI PIN with anyone</Text>
          )}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            {['1', '2', '3'].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            {['4', '5', '6'].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            {['7', '8', '9'].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keyBtnAction} onPress={handleDelete}>
              <Text style={styles.actionKeyText}>⌫</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keyBtn}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.keyBtnSubmit,
                pin.length !== PIN_LENGTH && styles.keyBtnSubmitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={pin.length !== PIN_LENGTH}
            >
              <Text style={styles.submitKeyText}>✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Dark theme matching real UPI PIN screens
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  npciContainer: {
    alignItems: 'center',
  },
  npciBadge: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  npciSub: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  targetCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  bankValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  payeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payeeLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  payeeVpa: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  amountBox: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  amountText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  pinArea: {
    alignItems: 'center',
    marginTop: 28,
    flex: 1,
  },
  pinTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: '#38bdf8',
    backgroundColor: '#1e293b',
  },
  dotText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
  },
  showPinBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  showPinText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  pinHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  keypad: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '600',
  },
  keyBtnAction: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  actionKeyText: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '700',
  },
  keyBtnSubmit: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSubmitDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  submitKeyText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
});
