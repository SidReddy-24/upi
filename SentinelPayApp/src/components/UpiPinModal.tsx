import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Vibration, Easing,
} from 'react-native';

interface UpiPinModalProps {
  visible: boolean;
  amount: number;
  receiverVpa?: string;
  vpa?: string;
  bankName?: string;
  onSuccess: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

type PinScreen = 'ENTRY' | 'PROCESSING' | 'DONE';

export default function UpiPinModal({
  visible,
  amount,
  receiverVpa,
  vpa,
  bankName = 'HDFC Bank •••• 4821',
  onSuccess,
  onCancel,
  onClose,
}: UpiPinModalProps) {
  const targetVpa = receiverVpa || vpa || 'merchant@upi';
  const handleClose = onCancel || onClose || (() => {});
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [screen, setScreen] = useState<PinScreen>('ENTRY');

  const PIN_LENGTH = 4;

  // ── Animation refs ──────────────────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const tickScale = useRef(new Animated.Value(0)).current;
  const tickOpacity = useRef(new Animated.Value(0)).current;

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setPin('');
      setShowPin(false);
      setErrorMsg(null);
      setScreen('ENTRY');
      spinAnim.setValue(0);
      tickScale.setValue(0);
      tickOpacity.setValue(0);
      dot1.setValue(0.3);
      dot2.setValue(0.3);
      dot3.setValue(0.3);
    }
  }, [visible]);

  // Kick off animations based on screen
  useEffect(() => {
    if (screen === 'PROCESSING') {
      // Continuous spinner
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ).start();
      // Staggered bouncing dots
      const pulse = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
            Animated.delay(600 - delay),
          ]),
        );
      Animated.parallel([pulse(dot1, 0), pulse(dot2, 200), pulse(dot3, 400)]).start();
    } else if (screen === 'DONE') {
      spinAnim.stopAnimation();
      Animated.parallel([
        Animated.spring(tickScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }),
        Animated.timing(tickOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [screen]);

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

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
      try { Vibration.vibrate(100); } catch {}
      return;
    }
    try { Vibration.vibrate([0, 50]); } catch {}
    setScreen('PROCESSING');
    // Simulate auth delay then show success tick
    setTimeout(() => {
      setScreen('DONE');
      setTimeout(() => {
        onSuccess();
        setPin('');
        setErrorMsg(null);
      }, 700);
    }, 2000);
  };

  // ── PROCESSING / DONE overlay ──────────────────────────────────────────────
  if (screen === 'PROCESSING' || screen === 'DONE') {
    return (
      <Modal visible={visible} animationType="none" transparent={false} onRequestClose={() => {}}>
        <SafeAreaView style={styles.container}>
          <View style={styles.processingWrap}>
            {/* NPCI badge at top */}
            <View style={styles.npciTopRow}>
              <Text style={styles.npciBadge}>UPI</Text>
              <Text style={styles.npciSub}>NPCI SECURED</Text>
            </View>

            {/* Amount card */}
            <View style={styles.amountCard}>
              <Text style={styles.procAmtLabel}>Processing payment of</Text>
              <Text style={styles.procAmtValue}>₹{amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.procVpa}>→ {targetVpa}</Text>
            </View>

            {/* Spinner or tick */}
            {screen === 'PROCESSING' ? (
              <Animated.View style={[styles.spinnerOuter, { transform: [{ rotate: spinRotate }] }]}>
                <View style={styles.spinnerInner} />
              </Animated.View>
            ) : (
              <Animated.View style={[styles.tickCircle, { transform: [{ scale: tickScale }], opacity: tickOpacity }]}>
                <Text style={styles.tickText}>✓</Text>
              </Animated.View>
            )}

            <Text style={styles.procLabel}>
              {screen === 'PROCESSING' ? 'Authorising payment...' : 'Payment authorised!'}
            </Text>

            {/* Bouncing dots */}
            {screen === 'PROCESSING' && (
              <View style={styles.dotsAnimRow}>
                {[dot1, dot2, dot3].map((d, i) => (
                  <Animated.View key={i} style={[styles.bounceDot, { opacity: d }]} />
                ))}
              </View>
            )}

            {/* Security badge */}
            <View style={styles.secRow}>
              <Text style={styles.secIcon}>🔒</Text>
              <Text style={styles.secText}>Encrypted with 256-bit SSL · NPCI certified</Text>
            </View>

            <Text style={styles.doNotClose}>Do not close the app or press back</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── PIN ENTRY screen ───────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
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
              <Text style={styles.payeeVpa}>{targetVpa}</Text>
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
              <TouchableOpacity key={key} style={styles.keyBtn} onPress={() => handleKeyPress(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            {['4', '5', '6'].map(key => (
              <TouchableOpacity key={key} style={styles.keyBtn} onPress={() => handleKeyPress(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            {['7', '8', '9'].map(key => (
              <TouchableOpacity key={key} style={styles.keyBtn} onPress={() => handleKeyPress(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keyBtnAction} onPress={handleDelete}>
              <Text style={styles.actionKeyText}>⌫</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keyBtn} onPress={() => handleKeyPress('0')}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyBtnSubmit, pin.length !== PIN_LENGTH && styles.keyBtnSubmitDisabled]}
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
    backgroundColor: '#0f172a',
  },

  // ── Processing screen ───────────────────────────────────────────────────────
  processingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  npciTopRow: {
    alignItems: 'center',
    position: 'absolute',
    top: 20,
  },
  amountCard: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  procAmtLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  procAmtValue: {
    color: '#f8fafc',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  procVpa: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  spinnerOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#1d4ed8',
    borderTopColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#1e3a5f',
    borderBottomColor: '#60a5fa',
  },
  tickCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  tickText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
  },
  procLabel: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dotsAnimRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bounceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38bdf8',
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secIcon: { fontSize: 16 },
  secText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  doNotClose: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── PIN entry ────────────────────────────────────────────────────────────────
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
  npciContainer: { alignItems: 'center' },
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
  bankLabel: { color: '#94a3b8', fontSize: 12 },
  bankValue: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  payeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payeeLabel: { color: '#94a3b8', fontSize: 12 },
  payeeVpa: { color: '#38bdf8', fontSize: 15, fontWeight: '800', marginTop: 2 },
  amountBox: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  amountText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  pinArea: { alignItems: 'center', marginTop: 28, flex: 1 },
  pinTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
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
  dotFilled: { borderColor: '#38bdf8', backgroundColor: '#1e293b' },
  dotText: { color: '#f8fafc', fontSize: 22, fontWeight: 'bold' },
  showPinBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  showPinText: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },
  pinHint: { color: '#64748b', fontSize: 12, marginTop: 12 },
  errorText: { color: '#f87171', fontSize: 13, fontWeight: '700', marginTop: 12 },
  keypad: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  keyBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: '#f8fafc', fontSize: 24, fontWeight: '600' },
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
  actionKeyText: { color: '#94a3b8', fontSize: 22, fontWeight: '700' },
  keyBtnSubmit: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSubmitDisabled: { backgroundColor: '#334155', opacity: 0.5 },
  submitKeyText: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
});
