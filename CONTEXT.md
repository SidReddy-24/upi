# SentinelPay — CONTEXT.md (Updated v2.2 · July 2026)

> Single source of truth for SentinelPay project state. Read this before working on any feature.

---

## Project Summary

**SentinelPay** is an AI-powered UPI payment & real-time fraud prevention app.
- **Mobile**: React Native 0.74+ (Android), TypeScript, React Navigation v6
- **Backend**: FastAPI (Python), deployed on Render.com — https://upi-nd1p.onrender.com
- **Database**: Supabase PostgreSQL + Redis (L1 cache)
- **AI/ML**: LightGBM, Isolation Forest, Rule DSL, Z-score, NetworkX, SHAP XAI

---

## Navigation Architecture (V2 — Current)

5-tab bottom navigation, rendered inside HomeScreen.tsx bottom nav bar:

| Tab | Screen | Description |
|-----|---------|-------------|
| Home | HomeScreen.tsx | Balance hero, quick actions, guardian + FraudShield summary, recent activity |
| Payments | PaymentsScreen.tsx | All payment actions hub (Send, Receive, Scan, History) |
| FraudShield | FraudShieldScreen.tsx | All AI/fraud tools hub |
| Notifications | NotificationsScreen.tsx | Alert center |
| More | MoreScreen.tsx | Guardian, Analytics, Community, Account, Settings hubs |

---

## Design System — Single Source of Truth

**File**: src/theme/ds.ts — tokens: C (colors), S (spacing), T (typography), R (radius), DS (shared StyleSheet)

Color palette: Background #F8FAFC | Dark #0F172A | Emerald #10B981 | Cobalt #2563EB | Red #EF4444 | Amber #D97706 | Violet #7C3AED

Icons: Custom SVG in src/components/AppIcon.tsx — 65+ icons, Lucide-style 2px stroke, NO external libraries.

Current icons: send, receive, scan, history, assistant, sms, report, heatmap, profile, settings, guardian, coin, shield, lock, alert, key, users, userPlus, check, checkCircle, trash, refresh, clock, zap, mail, mapPin, phone, search, award, chevronRight, chevronLeft, chevronUp, chevronDown, siren, info, externalLink, bell, cpu, shieldCheck, shieldAlert, barChart2, arrowDownLeft, arrowUpRight, creditCard, xCircle, pieChart, alertTriangle, userCheck, flag, qrCode, messageSquare, activity, eye, eyeOff, fingerprint, close, link, home, menu, qr, wifi, smartphone, layers, hardDrive, server, trendingUp, briefcase

---

## Screens Inventory (All Screens)

### Auth Flow
- AuthModeSelector.tsx — PIN / Biometric / Phone login selector
- PhoneAuthScreen.tsx — phone number entry
- PinLoginScreen.tsx — 6-digit PIN entry
- PinSetupScreen.tsx — set new PIN
- BiometricSetupScreen.tsx — Face/Fingerprint setup
- OnboardingScreen.tsx — first-time welcome

### Main App
- HomeScreen.tsx — V2 overview-only. Contains 5-tab bottom nav.
- PaymentsScreen.tsx — NEW V2. Payment hub.
- FraudShieldScreen.tsx — NEW V2. All AI security tools.
- MoreScreen.tsx — NEW V2. Secondary nav hub.
- NotificationsScreen.tsx — Real-time alert center.
- SendMoneyScreen.tsx — UPI transfer with AI scoring.
- ReceiveMoneyScreen.tsx — QR + VPA display.
- ScanQRScreen.tsx — Native ZXing QR camera scanner.
- TransactionHistoryScreen.tsx — All transactions.
- TransactionDetailScreen.tsx — Single transaction detail.
- GuardianManagementScreen.tsx — Set guardian, configure limits.
- GuardianApprovalScreen.tsx — Approve/decline pending requests.
- GuardianVerificationScreen.tsx — 6-digit OTP code entry.
- AiRiskHistoryScreen.tsx — REBUILT v2.1: Live transaction risk feed, animated score bars, expandable cards.
- DeviceTrustScreen.tsx — REBUILT v2.1: SVG gauge, 14 signals, attestation, security timeline.
- ScamAssistantScreen.tsx — AI chat assistant for scam detection.
- ScamHeatMapScreen.tsx — Geographic fraud hotspot map.
- ScamPassportScreen.tsx — Entity trust score lookup.
- SmsTrackerScreen.tsx — On-device SMS fraud detection.
- SmsDetailScreen.tsx — Single SMS analysis detail.
- ReportScamScreen.tsx — REBUILT v2.2: Premium community report, single header, animated chips, success overlay.
- ProfileScreen.tsx — User profile and preferences.
- SettingsScreen.tsx — App settings.
- AdminAnalyticsDashboardScreen.tsx — Ops and security analytics.

---

## Key Components & Utilities

- src/utils/walletDb.ts — AsyncStorage wallet DB. subscribeWallet() pub-sub for live UI updates.
- src/utils/parsers.ts — parseSafeDate() safe date parsing utility.
- src/services/fraudShieldApi.ts — All backend API calls.
- src/services/notificationService.ts — In-app notification center.
- src/services/authService.ts — Auth session management.
- src/components/AppIcon.tsx — 65+ custom SVG icons. Single icon system.
- src/components/AnimatedPressable.tsx — Spring-animated touchable wrapper.
- src/components/RiskBadge.tsx — Color-coded risk/decision badge.
- src/components/PanicButton.tsx — Floating emergency wallet freeze FAB (bottom-right, absolute positioned).
- src/theme/ds.ts — Design System — all tokens and shared styles.

---

## Recent Changelog

### v2.2 (July 28, 2026)
- ReportScamScreen.tsx — Full premium redesign
  - Single header only (removed duplicate "Report Fraudster" title)
  - Animated category chips — horizontal scroll, no clipping, spring-animated selection
  - Focused input states (inputWrapperFocused on active field)
  - Character counter on description field (500 char max)
  - Dashed attachment cards (Screenshot, Chat Log, Call Log demo)
  - FraudShield AI info banner
  - Spring-animated success overlay (replaces Alert dialog)
  - KeyboardAvoidingView for proper mobile UX
- ScamHeatMapScreen.tsx — Removed emoji (fire emoji) from section title
- ScamPassportScreen.tsx — Removed emoji (chart emoji) from section title
- AppIcon.tsx — Added briefcase icon

### v2.1 (July 28, 2026)
- AiRiskHistoryScreen.tsx — Rebuilt as live risk feed from real walletDb transactions
  - subscribeWallet() pub-sub — updates instantly when payment made
  - Animated score bars (Animated.Value 0 to score)
  - Color-coded risk: green/amber/orange/red
  - Expandable cards with trigger rule, ref ID, call-risk detection
  - Horizontal filter chips with live counts
  - Premium empty state
- DeviceTrustScreen.tsx — Enterprise security dashboard
  - SVG animated circular gauge (arc + counter animate 0 to 94)
  - 14 security signals with staggered fade-in animations
  - Device Attestation panel: 10 rows
  - Security timeline with vertical connector
- AppIcon.tsx — Added: wifi, smartphone, layers, hardDrive, server, trendingUp

### v2.0 (July 27, 2026)
- V2 IA Refactor: 5-tab navigation
- HomeScreen.tsx stripped to overview-only
- Created PaymentsScreen.tsx, FraudShieldScreen.tsx, MoreScreen.tsx
- AppIcon.tsx — Added: home, menu, qr

---

## Current APKs on Desktop
- sentinelpay-v2.2-report-fraud-ui.apk (latest)
- sentinelpay-v2.1-security-dashboard.apk
- sentinelpay-v2.0-ia-refactor.apk

## Git
- Repo: https://github.com/SidReddy-24/upi
- Branch: main
