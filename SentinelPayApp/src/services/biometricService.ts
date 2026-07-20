/**
 * biometricService.ts — Biometric authentication wrapper.
 *
 * Uses react-native-biometrics (already installed in package.json).
 * Called from SendMoneyScreen on REVIEW decisions.
 */
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export interface BiometricCheckResult {
  available: boolean;
  biometryType: string | null;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Check if biometrics are available on this device.
 */
export async function checkBiometricAvailability(): Promise<BiometricCheckResult> {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    return { available, biometryType: biometryType ?? null };
  } catch {
    return { available: false, biometryType: null };
  }
}

/**
 * Prompt user for biometric / device credential authentication.
 * Used as a gate before confirming a REVIEW-flagged payment.
 *
 * @param promptMessage  Text shown in the biometric dialog
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Confirm payment with biometrics',
): Promise<BiometricAuthResult> {
  try {
    const { available } = await rnBiometrics.isSensorAvailable();
    if (!available) {
      // No biometrics — allow through (device doesn't support it)
      return { success: true };
    }

    const { success } = await rnBiometrics.simplePrompt({ promptMessage });
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Biometric authentication failed or cancelled' };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Biometric error' };
  }
}

/**
 * Human-readable label for the biometry type.
 */
export function biometryLabel(type: string | null): string {
  if (!type) return 'Device Lock';
  if (type === BiometryTypes.FaceID)        return 'Face ID';
  if (type === BiometryTypes.TouchID)       return 'Touch ID';
  if (type === BiometryTypes.Biometrics)    return 'Fingerprint';
  return 'Biometrics';
}
