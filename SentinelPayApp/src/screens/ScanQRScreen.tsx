/**
 * ScanQRScreen — camera QR scanner & gallery image upload using react-native-vision-camera & ZXing.
 * Parses UPI QR format (standard UPI URI, JSON, raw VPA, phone numbers) and pre-fills SendMoney screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, NativeModules, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import {
  Camera, useCodeScanner, useCameraDevice, useCameraPermission,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getUser } from '../utils/walletDb';
import AppIcon from '../components/AppIcon';
import { C, S, T, R, DS } from '../theme/ds';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScanQR'> };

const { QrDecoderModule } = NativeModules;

export function parseUpiQr(raw: string): { vpa: string; amount?: number; name?: string } | null {
  try {
    if (!raw || typeof raw !== 'string') return null;

    let cleaned = raw
      .trim()
      .replace(/[\uFEFF\u200B\u0000-\u001F]/g, '')
      .replace(/&amp;/g, '&');

    console.log('[ScanQR] Parsing QR raw data:', cleaned);

    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        const obj = JSON.parse(cleaned);
        const vpa = obj.vpa || obj.pa || obj.upiId || obj.id;
        const rawAmt = obj.amount || obj.am;
        const parsedAmt = rawAmt ? parseFloat(String(rawAmt).replace(/,/g, '')) : undefined;
        const finalAmt = parsedAmt !== undefined && !isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : undefined;
        const name = obj.name || obj.pn;

        if (vpa && typeof vpa === 'string' && vpa.includes('@')) {
          return {
            vpa: vpa.trim().toLowerCase(),
            amount: finalAmt,
            name: name ? String(name).trim() : undefined,
          };
        }
      } catch {
        // Fallthrough
      }
    }

    let extractedVpa: string | null = null;
    const paMatch = cleaned.match(/(?:[?&]|^)(?:pa|vpa)=([^&]+)/i);

    if (paMatch && paMatch[1]) {
      try {
        extractedVpa = decodeURIComponent(paMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        extractedVpa = paMatch[1].trim();
      }
    }

    let extractedAmount: number | undefined = undefined;
    const amMatch = cleaned.match(/(?:[?&]|^)(?:am|amount)=([^&]+)/i);

    if (amMatch && amMatch[1]) {
      try {
        const rawAm = decodeURIComponent(amMatch[1]).replace(/,/g, '');
        const num = parseFloat(rawAm);
        if (!isNaN(num) && num > 0) {
          extractedAmount = num;
        }
      } catch {
        // Ignore
      }
    }

    let extractedName: string | undefined = undefined;
    const pnMatch = cleaned.match(/(?:[?&]|^)(?:pn|name)=([^&]+)/i);

    if (pnMatch && pnMatch[1]) {
      try {
        extractedName = decodeURIComponent(pnMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        extractedName = pnMatch[1].trim();
      }
    }

    if (extractedVpa && extractedVpa.includes('@')) {
      return {
        vpa: extractedVpa.toLowerCase(),
        amount: extractedAmount,
        name: extractedName,
      };
    }

    const directVpaMatch = cleaned.match(/[a-zA-Z0-9.\-_%+]+@[a-zA-Z0-9.\-_]+/);
    if (directVpaMatch) {
      return {
        vpa: directVpaMatch[0].toLowerCase(),
        amount: extractedAmount,
        name: extractedName,
      };
    }

    const cleanPhone = cleaned.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      return {
        vpa: `${cleanPhone}@sentinelpay`,
        amount: extractedAmount,
        name: extractedName,
      };
    }

    return null;
  } catch (error) {
    console.error('[ScanQR] Parse error:', error);
    return null;
  }
}

export default function ScanQRScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleScanSuccess = useCallback((raw: string) => {
    setScanned(true);

    const parsed = parseUpiQr(raw);
    if (parsed) {
      getUser().then(currentUser => {
        if (currentUser && currentUser.vpa.toLowerCase() === parsed.vpa.toLowerCase()) {
          Alert.alert(
            'Self QR Code Scanned',
            `This QR code (${parsed.vpa}) belongs to your own logged-in account.\n\nYou cannot send money to yourself. Please scan a QR code belonging to another user.`,
            [
              { text: 'Scan Another', onPress: () => setScanned(false) },
              { text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' },
            ],
          );
        } else {
          navigation.replace('SendMoney', {
            prefillVpa: parsed.vpa,
            prefillAmount: parsed.amount,
          });
        }
      });
    } else {
      Alert.alert(
        'Invalid QR Code',
        `This QR code doesn't contain a valid UPI VPA or payment link.\n\nScanned Data:\n${raw.slice(0, 100)}${raw.length > 100 ? '...' : ''}`,
        [
          { text: 'Try Again', onPress: () => setScanned(false) },
          { text: 'Cancel', onPress: () => navigation.goBack(), style: 'cancel' },
        ],
      );
    }
  }, [navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanned || !codes.length) return;
      const raw = codes[0].value ?? '';
      handleScanSuccess(raw);
    },
  });

  const handleUploadFromGallery = async () => {
    try {
      setLoadingImage(true);
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
      });

      if (result.didCancel || !result.assets || !result.assets[0]?.uri) {
        setLoadingImage(false);
        return;
      }

      const imageUri = result.assets[0].uri;

      if (QrDecoderModule && QrDecoderModule.decodeQrFromImage) {
        try {
          const decodedText = await QrDecoderModule.decodeQrFromImage(imageUri);
          setLoadingImage(false);
          if (decodedText) {
            handleScanSuccess(decodedText);
            return;
          }
        } catch (err: any) {
          console.warn('[ScanQR] Native QrDecoderModule failed:', err?.message ?? err);
        }
      }

      setLoadingImage(false);
      Alert.alert(
        'No QR Code Found',
        'Could not detect a valid QR code in the selected photo. Please choose another clear QR image.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      setLoadingImage(false);
      console.error('[ScanQR] Error picking image from gallery:', err);
      Alert.alert('Error', 'Failed to read image from gallery');
    }
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <View style={DS.emptyCard}>
          <AppIcon name="scan" size={40} color={C.textTertiary} />
          <Text style={DS.emptyTitle}>Camera Permission Required</Text>
          <Text style={[DS.emptySub, { marginBottom: S.md }]}>Please allow camera access to scan UPI QR codes.</Text>
          <TouchableOpacity style={[DS.btn, DS.btnPrimary]} onPress={() => Linking.openSettings()}>
            <Text style={DS.btnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={DS.safeArea}>
        <View style={DS.emptyCard}>
          <AppIcon name="alert" size={40} color={C.red} />
          <Text style={DS.emptyTitle}>No Camera Device Found</Text>
          <Text style={DS.emptySub}>Camera module is unavailable on this device hardware.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned && !loadingImage}
        codeScanner={codeScanner}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        {/* Top bar with back button */}
        <SafeAreaView style={styles.topHeader}>
          <TouchableOpacity style={[DS.headerIconBtn, { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.2)' }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <AppIcon name="chevronLeft" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: T.lg, fontWeight: T.bold, color: '#FFFFFF' }}>Scan UPI QR</Text>
          <View style={{ width: 36 }} />
        </SafeAreaView>

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
          <Text style={styles.scanHint}>Align QR Code inside viewfinder</Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[DS.btn, DS.btnPrimary, { backgroundColor: C.dark }]}
              disabled={loadingImage}
              onPress={handleUploadFromGallery}
              activeOpacity={0.7}>
              {loadingImage ? (
                <ActivityIndicator color={C.textInverse} size="small" />
              ) : (
                <>
                  <AppIcon name="scan" size={18} color={C.textInverse} />
                  <Text style={DS.btnText}>Upload Gallery QR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  overlay: { ...StyleSheet.absoluteFillObject },
  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.base, paddingTop: S.md, zIndex: 10,
  },
  topOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)' },
  middleRow: { flexDirection: 'row', height: VIEWFINDER },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)' },
  viewfinder: { width: VIEWFINDER, height: VIEWFINDER },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', paddingTop: 20 },
  scanHint: { color: C.textInverse, fontSize: T.sm, fontWeight: T.bold, marginBottom: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.base },

  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: C.green },
  topLeft: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  topRight: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
});
