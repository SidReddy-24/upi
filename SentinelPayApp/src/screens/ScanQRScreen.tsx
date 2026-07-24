/**
 * ScanQRScreen — camera QR scanner & gallery image upload using react-native-vision-camera & ZXing.
 * Parses UPI QR format (standard UPI URI, JSON, raw VPA, phone numbers) and pre-fills SendMoney screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, NativeModules, ActivityIndicator,
} from 'react-native';
import {
  Camera, useCodeScanner, useCameraDevice, useCameraPermission,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'ScanQR'> };

const { QrDecoderModule } = NativeModules;

/**
 * Robustly parse a UPI QR payload into VPA + Amount + Name.
 * Supports:
 * - Standard UPI scheme: upi://pay?pa=...&pn=...&am=...
 * - Custom URL or query params: pa=...&am=...
 * - JSON payload: {"vpa":"...", "amount":500, "name":"..."}
 * - Raw VPA string: e.g. 9876543210@sentinelpay
 * - Raw mobile number: e.g. 9876543210
 */
export function parseUpiQr(raw: string): { vpa: string; amount?: number; name?: string } | null {
  try {
    if (!raw || typeof raw !== 'string') return null;

    // 1. Sanitize raw input: trim, remove BOM/control chars, decode HTML entities
    let cleaned = raw
      .trim()
      .replace(/[\uFEFF\u200B\u0000-\u001F]/g, '')
      .replace(/&amp;/g, '&');

    console.log('[ScanQR] Parsing QR raw data:', cleaned);

    // 2. Try JSON format
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

    // 3. Extract PA (Payee Address / VPA) using regex matching (pa=..., vpa=...)
    let extractedVpa: string | null = null;
    const paMatch = cleaned.match(/(?:[?&]|^)(?:pa|vpa)=([^&]+)/i);

    if (paMatch && paMatch[1]) {
      try {
        extractedVpa = decodeURIComponent(paMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        extractedVpa = paMatch[1].trim();
      }
    }

    // 4. Extract Amount (am=..., amount=...)
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
        // Ignore amount parse error
      }
    }

    // 5. Extract Payee Name (pn=..., name=...)
    let extractedName: string | undefined = undefined;
    const pnMatch = cleaned.match(/(?:[?&]|^)(?:pn|name)=([^&]+)/i);

    if (pnMatch && pnMatch[1]) {
      try {
        extractedName = decodeURIComponent(pnMatch[1].replace(/\+/g, ' ')).trim();
      } catch {
        extractedName = pnMatch[1].trim();
      }
    }

    // If VPA was found via query parameter
    if (extractedVpa && extractedVpa.includes('@')) {
      return {
        vpa: extractedVpa.toLowerCase(),
        amount: extractedAmount,
        name: extractedName,
      };
    }

    // 6. Fail-safe Direct VPA extraction anywhere in string (regex: username@handle)
    const directVpaMatch = cleaned.match(/[a-zA-Z0-9.\-_%+]+@[a-zA-Z0-9.\-_]+/);
    if (directVpaMatch) {
      return {
        vpa: directVpaMatch[0].toLowerCase(),
        amount: extractedAmount,
        name: extractedName,
      };
    }

    // 7. Direct 10-digit mobile number format
    const cleanPhone = cleaned.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      return {
        vpa: `${cleanPhone}@sentinelpay`,
        amount: extractedAmount,
        name: extractedName,
      };
    }

    console.log('[ScanQR] No valid VPA recognized in:', cleaned);
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
    console.log('[ScanQR] Decoded string:', raw);

    const parsed = parseUpiQr(raw);
    if (parsed) {
      console.log('[ScanQR] Successfully parsed UPI QR:', parsed);
      navigation.replace('SendMoney', {
        prefillVpa: parsed.vpa,
        prefillAmount: parsed.amount,
      });
    } else {
      console.log('[ScanQR] Failed to parse as valid UPI QR');
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
      console.log('[ScanQR] Selected gallery image URI:', imageUri);

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
        isActive={!scanned && !loadingImage}
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
          
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.galleryBtn}
              disabled={loadingImage}
              onPress={handleUploadFromGallery}>
              {loadingImage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.galleryBtnText}>🖼️ Upload from Gallery</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { fontSize: 16, color: '#374151', textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  overlay: { ...StyleSheet.absoluteFillObject },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  middleRow: { flexDirection: 'row', height: VIEWFINDER },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  viewfinder: { width: VIEWFINDER, height: VIEWFINDER },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 20 },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '500', marginBottom: 20 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  galleryBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  galleryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  cancelText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Corner brackets
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#6366f1' },
  topLeft: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  topRight: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
});
