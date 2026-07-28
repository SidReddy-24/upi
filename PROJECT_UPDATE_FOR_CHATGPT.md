# SentinelPay — Complete Project Update (v2.2 · July 2026)

> For AI Assistants: Read this document to instantly understand the full architecture, design system, navigation, all screens, components, backend, and latest changes in SentinelPay.

---

## 1. What is SentinelPay?

SentinelPay is an AI-powered, enterprise-grade UPI Payment + Real-Time Fraud Prevention Application.

- React Native 0.74+ Android app (TypeScript)
- FastAPI Python backend on Render.com (https://upi-nd1p.onrender.com)
- Supabase PostgreSQL + Redis persistence
- 6-engine ML fraud scoring: LightGBM, Isolation Forest, Rule DSL, Z-score, NetworkX, SHAP
- Native Android modules: SmsReceiverModule, SmsClassifier (TFLite), QrDecoderModule (ZXing)

---

## 2. Design System (Single Source of Truth)

**File**: SentinelPayApp/src/theme/ds.ts

All UI follows this single design system. Never inline custom styles that deviate from it.

Color palette:
- Background: #F8FAFC
- Dark/Primary: #0F172A (Deep Slate)
- Emerald: #10B981
- Cobalt: #2563EB
- Red: #EF4444
- Amber: #D97706
- Violet: #7C3AED
- Surface: #FFFFFF
- Border: #E2E8F0

Typography: fontWeight 400/500/600/700/800/900
Spacing: 8-pt grid (xs=4, sm=8, md=12, base=16, lg=20, xl=24, xxl=32)
Button height: 52dp
Card radius: 24dp
Page padding: 20dp horizontal

Icon system: Custom SVG component — src/components/AppIcon.tsx
65+ icons. All Lucide-style, 2px stroke, NO react-native-vector-icons or other external icon library.

Icon list: send, receive, scan, history, assistant, sms, report, heatmap, profile, settings, guardian, coin, shield, lock, alert, key, users, userPlus, check, checkCircle, trash, refresh, clock, zap, mail, mapPin, phone, search, award, chevronRight, chevronLeft, chevronUp, chevronDown, siren, info, externalLink, bell, cpu, shieldCheck, shieldAlert, barChart2, arrowDownLeft, arrowUpRight, creditCard, xCircle, pieChart, alertTriangle, userCheck, flag, qrCode, messageSquare, activity, eye, eyeOff, fingerprint, close, link, home, menu, qr, wifi, smartphone, layers, hardDrive, server, trendingUp, briefcase

---

## 3. Navigation Architecture (V2)

Stack navigator in App.tsx.
HomeScreen contains a custom 5-tab bottom nav bar (NOT React Navigation tab navigator).

Tabs:
1. Home → HomeScreen (overview-only)
2. Payments → PaymentsScreen
3. FraudShield → FraudShieldScreen
4. Notifications → NotificationsScreen
5. More → MoreScreen

Every feature has ONE canonical location. No duplicate pages.

Home = summaries and shortcuts only.
Payments = all money movement.
FraudShield = all AI security tools.
More = all management (Guardian, Analytics, Community, Account, Settings).

---

## 4. All Screens

### Auth (pre-login)
- AuthModeSelector — choose login method
- PhoneAuthScreen — phone number entry
- PinLoginScreen — 6-digit PIN
- PinSetupScreen — create new PIN
- BiometricSetupScreen — Face/Fingerprint
- OnboardingScreen — first-time onboarding

### Main App
- HomeScreen — V2 overview: balance hero (dark card), quick actions grid, Guardian summary card, FraudShield status card, recent 5 transactions. 5-tab bottom nav bar.
- PaymentsScreen — Payment hub: quick action pills, recent transactions, payment links
- FraudShieldScreen — AI security hub: all fraud tools, backend status
- MoreScreen — Secondary nav: Guardian & Safety, Analytics, Community, Account, App sections
- NotificationsScreen — Real notification center (no mock data)
- SendMoneyScreen — UPI P2P transfer with FraudShield AI scoring + UpiPinModal
- ReceiveMoneyScreen — QR code display + VPA
- ScanQRScreen — ZXing camera QR scanner
- TransactionHistoryScreen — Full transaction list
- TransactionDetailScreen — Single transaction with AI analysis
- GuardianManagementScreen — Add guardian, set spending limit, manage relationship
- GuardianApprovalScreen — Ward view: pending approvals
- GuardianVerificationScreen — 6-digit OTP entry for guardian linking
- AiRiskHistoryScreen — REBUILT v2.1: Live feed from real walletDb transactions. subscribeWallet() pub-sub. Animated score bars. Expandable cards. Horizontal filter chips. Empty state.
- DeviceTrustScreen — REBUILT v2.1: SVG animated circular trust gauge (0→94). 14 security signals with staggered animations. Device Attestation panel (10 rows). Security timeline.
- ScamAssistantScreen — AI chat bot for scam detection and advice
- ScamHeatMapScreen — Geographic fraud hotspot visualization
- ScamPassportScreen — Entity trust score lookup and fraud history
- SmsTrackerScreen — On-device SMS fraud detection (TFLite classifier)
- SmsDetailScreen — Single SMS analysis view
- ReportScamScreen — REBUILT v2.2: Single clean header. Animated horizontal category chips (10 categories, no clipping). Focused input states. 500-char description with counter. Dashed attachment cards. FraudShield AI info banner. Spring-animated success overlay (no Alert dialog). KeyboardAvoidingView.
- ProfileScreen — User profile and preferences
- SettingsScreen — App settings (notifications, security, etc)
- AdminAnalyticsDashboardScreen — Ops & security analytics for admins

---

## 5. Key Components

- AppIcon.tsx — 65+ SVG icons. Pass name prop from IconName type union.
- AnimatedPressable.tsx — Spring-animated TouchableOpacity wrapper.
- RiskBadge.tsx — Color-coded risk/decision badge (APPROVE/REJECT/GUARDIAN_REQUIRED).
- PanicButton.tsx — Floating red FAB (bottom-right, absolute) for emergency wallet freeze.
- UpiPinModal.tsx — Animated payment processing modal (ENTRY→PROCESSING→DONE states).

---

## 6. Key Utilities & Services

- src/utils/walletDb.ts
  - AsyncStorage-based wallet DB
  - subscribeWallet(listener) — pub-sub for live UI updates across screens
  - notifyWalletChanged() — call after any balance/transaction change
  - getUser(), getTransactions(), syncCloudTransactions()

- src/utils/parsers.ts — parseSafeDate(isoString) safe date parser

- src/services/fraudShieldApi.ts — All backend API calls
  - checkHealth(), sendMoney(), getTransactions()
  - submitCommunityReport(), getScamPassport(), getHeatMap()
  - Guardian: setPairedGuardian(), getPendingRequests(), respondToRequest()

- src/services/notificationService.ts
  - subscribe(listener) — real-time notification updates
  - getUnreadCount(), markAllRead()

---

## 7. Backend API (FastAPI)

Base URL: https://upi-nd1p.onrender.com

Key endpoints:
- POST /api/v1/auth/login
- POST /api/v1/auth/register
- POST /api/v1/transfer — UPI transfer + 6-engine fraud scoring
- GET  /api/v1/guardian/pending-requests
- POST /api/v1/guardian/respond
- GET  /api/v1/guardian/get-limit
- POST /api/v1/community/report
- GET  /api/v1/health
- GET  /api/v1/fraud/risk-history
- GET  /api/v1/scam-passport/{entity_id}
- GET  /api/v1/heatmap

---

## 8. UI Rules & Global Constraints

1. Every screen has ONE and ONLY ONE page title. Never repeat the same heading twice.
2. Single header pattern: ← Back | Page Title | Optional Badge (no secondary hero card with the same name)
3. Section titles introduce new content groups only — never duplicate the page title.
4. No emoji in section titles or headings.
5. All icons from AppIcon.tsx — never use emoji or external icon libraries.
6. Use DS.inputWrapperFocused for focused TextInput states.
7. Bottom nav clearance: contentContainerStyle paddingBottom must be >= 100 on all scrollable screens accessible from bottom tabs.
8. Empty states: use DS.emptyCard + DS.emptyIcon + DS.emptyTitle + DS.emptySub pattern.
9. PanicButton (floating FAB) lives in App.tsx and overlays all screens — do not add it inside screens.

---

## 9. Changelog (Recent)

### v2.2 — July 28, 2026
Commit: (pushed to main)

ReportScamScreen.tsx — Full premium redesign:
- Single "Report Fraud" header with subtitle
- Horizontal scrolling animated category chips (10 categories, no clipping)
- Animated chip selection (scale spring on press)
- Focused input states (inputWrapperFocused)
- Character counter (500 max) on description
- Dashed attachment cards (Screenshot, Chat Log, Call Log)
- FraudShield AI info banner
- Spring-animated success overlay replacing Alert.alert
- KeyboardAvoidingView

ScamHeatMapScreen — removed emoji from "All Hotspots" section title
ScamPassportScreen — removed emoji from "Intelligence Summary" section title
AppIcon — added briefcase icon

APK: sentinelpay-v2.2-report-fraud-ui.apk (85MB) on Desktop

### v2.1 — July 28, 2026
Commit: b87384dc

AiRiskHistoryScreen — rebuilt as live risk feed
DeviceTrustScreen — enterprise security dashboard with SVG gauge
AppIcon — added wifi, smartphone, layers, hardDrive, server, trendingUp
APK: sentinelpay-v2.1-security-dashboard.apk

### v2.0 — July 27, 2026
Commit: a2f3e502

V2 IA Refactor — 5-tab navigation
HomeScreen — stripped to overview-only
PaymentsScreen, FraudShieldScreen, MoreScreen created
AppIcon — added home, menu, qr
APK: sentinelpay-v2.0-ia-refactor.apk

---

## 10. File Tree (Key Paths)

SentinelPayApp/
├── src/
│   ├── App.tsx                    — Root navigator + PanicButton overlay
│   ├── types/index.ts             — RootStackParamList + shared types
│   ├── theme/ds.ts                — Design system tokens + shared styles
│   ├── components/
│   │   ├── AppIcon.tsx            — 65+ custom SVG icons
│   │   ├── AnimatedPressable.tsx
│   │   ├── RiskBadge.tsx
│   │   ├── PanicButton.tsx
│   │   └── UpiPinModal.tsx
│   ├── screens/                   — 32 screen files
│   ├── services/
│   │   ├── fraudShieldApi.ts
│   │   ├── notificationService.ts
│   │   ├── authService.ts
│   │   └── smsService.ts
│   └── utils/
│       ├── walletDb.ts
│       └── parsers.ts
├── android/                       — Native Android (Java modules)
└── ios/                           — Not used
