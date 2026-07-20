/**
 * ScanQRScreen — camera QR scanner using react-native-vision-camera.
 * Parses UPI QR format and pre-fills SendMoney screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking,
} from 'react-native';
import {
  Camera, useCodeScanner, useCameraDevice, useCameraPermission,
} from 'react-native-vision-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScanQR'> };

/**
 * Parse a UPI deep-link into VPA + amount.
 * Format: upi://pay?pa=vpa@bank&pn=Name&am=100&cu=INR
 */
function parseUpiQr(raw: string): { vpa: string; amount?: number } | null {
  try {
    const url = new URL(raw);
    const pa = url.searchParams.get('pa');
    const am = url.searchParams.get('am');
    if (!pa) return null;
    return { vpa: pa, amount: am ? parseFloat(am) : undefined };
  } catch {
    return null;
  }
}

export default function ScanQRScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanned || !codes.length) return;
      const raw = codes[0].value ?? '';
      setScanned(true);

      const parsed = parseUpiQr(raw);
      if (parsed) {
        navigation.replace('SendMoney', {
          prefillVpa: parsed.vpa,
          prefillAmount: parsed.amount,
        });
      } else {
        Alert.alert(
          'Not a UPI QR',
          `Scanned: ${raw.slice(0, 60)}`,
          [{ text: 'Scan Again', onPress: () => setScanned(false) }],
        );
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permBtnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>No camera found on this device</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned}
        codeScanner={codeScanner}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          <Text style={styles.scanHint}>Point camera at a UPI QR code</Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const VIEWFINDER = 240;
const BORDER = 3;
const CORNER = 24;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  overlay: { ...StyleSheet.absoluteFillObject },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  middleRow: { flexDirection: 'row', height: VIEWFINDER },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  viewfinder: { width: VIEWFINDER, height: VIEWFINDER },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 24 },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '500', marginBottom: 24 },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Corner brackets
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#6366f1' },
  topLeft: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  topRight: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
});
