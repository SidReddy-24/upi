/**
 * Unified SMS Fraud Detection Threshold Configuration.
 * Single source of truth for mobile UI, services, and native classifiers.
 */

export const SMS_THRESHOLDS = {
  FRAUD: 0.70,      // Score >= 0.70 -> DANGEROUS / FRAUD
  SUSPICIOUS: 0.40, // 0.40 <= Score < 0.70 -> SUSPICIOUS
  SAFE: 0.30,       // Score < 0.30 -> SAFE / GENUINE
} as const;

export type SmsRiskClassification = 'fraud' | 'suspicious' | 'genuine';
export type SmsRiskNotificationLevel = 'DANGEROUS' | 'SUSPICIOUS' | 'SAFE';

export function getRiskLevelFromScore(score: number): SmsRiskNotificationLevel {
  if (score >= SMS_THRESHOLDS.FRAUD) return 'DANGEROUS';
  if (score >= SMS_THRESHOLDS.SUSPICIOUS) return 'SUSPICIOUS';
  return 'SAFE';
}

export function getClassificationFromScore(score: number): SmsRiskClassification {
  if (score >= SMS_THRESHOLDS.FRAUD) return 'fraud';
  if (score >= SMS_THRESHOLDS.SUSPICIOUS) return 'suspicious';
  return 'genuine';
}
