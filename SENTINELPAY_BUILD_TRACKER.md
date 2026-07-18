# SentinelPay AI — Build Tracker & Progress Log
**Project:** Android UPI Wallet Simulator with Real-Time Fraud Detection  
**Started:** July 18, 2026  
**Tech Stack:** React Native (Bare Workflow) + FraudShield Backend  
**Target:** Phase 1 Demo-Ready APK

---

## 🎯 Project Context (ALWAYS REMEMBER)

### What We're Building
- **Android wallet app** with ₹1,00,000 simulated credits
- **Real-time fraud detection** via FraudShield backend (<200ms)
- **On-device SMS classification** (TFLite model)
- **Call context detection** (flag payments during calls)
- **QR scanner/generator** for UPI payments
- **Biometric authentication** for high-risk transactions

### Architecture Decision
```
React Native (Bare Workflow)
├── JavaScript/React for UI
├── Java bridge modules for SMS & Call detection
├── TFLite for on-device ML
└── Axios → FraudShield API (existing backend)
```

### Critical Constraints
1. **No Play Store** — sideloaded APK only
2. **Sub-200ms latency** — all fraud checks must be fast
3. **On-device privacy** — SMS never uploaded to cloud
4. **Simulated money** — must be clearly labeled everywhere

---

## 📋 Master Task List

### ✅ COMPLETED TASKS
- [x] Gap analysis between SentinelPay PRD and FraudShield backend
- [x] API testing (17/17 tests passing)
- [x] Architecture decision (React Native bare workflow)
- [x] Build tracker created
- [x] Task 1.1.1: Start PostgreSQL + Redis via docker-compose ✅
- [x] Task 1.1.2: Verify FraudShield backend health ✅ (HEALTHY status)
- [x] Task 1.1.3: Run API test suite ✅ (16/17 passing, 24.5ms avg latency)
- [x] Task 1.2.1: Create React Native project (bare workflow) ✅
- [x] Task 1.2.3: Install core dependencies (navigation, axios, etc.) ✅

---

### 🚧 IN PROGRESS
- [⚙️] Task 1.2.2: Configure Android build settings — **STARTING NOW**
- [⚙️] Task 1.2.4: Setup project structure (/screens, /services, /components)

---

### 📦 PHASE 1 — FOUNDATION (Week 1)

#### 1.1 Backend Preparation
- [ ] Task 1.1.1: Start PostgreSQL + Redis via docker-compose
- [ ] Task 1.1.2: Verify FraudShield backend health
- [ ] Task 1.1.3: Run API test suite
- [ ] Task 1.1.4: Deploy backend to cloud VPS (optional but recommended)

#### 1.2 React Native Project Setup
- [ ] Task 1.2.1: Create React Native project (bare workflow)
- [ ] Task 1.2.2: Configure Android build settings
- [ ] Task 1.2.3: Install core dependencies (navigation, axios, etc.)
- [ ] Task 1.2.4: Setup project structure (/screens, /services, /components)
- [ ] Task 1.2.5: Test build — generate debug APK

#### 1.3 FraudShield API Integration
- [ ] Task 1.3.1: Create API service layer (axios client)
- [ ] Task 1.3.2: Implement `/score` endpoint integration
- [ ] Task 1.3.3: Implement `/health` endpoint check
- [ ] Task 1.3.4: Add API configuration (dev/prod URLs)
- [ ] Task 1.3.5: Test API calls from app to backend

---

### 💰 PHASE 2 — SIMULATED WALLET (Week 2)

#### 2.1 Local Database Setup
- [ ] Task 2.1.1: Install and configure `expo-sqlite`
- [ ] Task 2.1.2: Create wallet schema (users, transactions, balance)
- [ ] Task 2.1.3: Implement database helper functions
- [ ] Task 2.1.4: Create migration scripts

#### 2.2 Wallet Core Logic
- [ ] Task 2.2.1: User registration flow
- [ ] Task 2.2.2: Credit ₹1,00,000 SPC on first registration
- [ ] Task 2.2.3: Implement debit/credit functions
- [ ] Task 2.2.4: Transaction history logging
- [ ] Task 2.2.5: Balance validation logic

#### 2.3 Wallet UI
- [ ] Task 2.3.1: Home screen with balance display
- [ ] Task 2.3.2: "SIMULATED" badge implementation
- [ ] Task 2.3.3: Transaction history screen
- [ ] Task 2.3.4: Onboarding disclosure screen

---

### 💸 PHASE 3 — PAYMENT FLOW (Week 2)

#### 3.1 Payment UI
- [ ] Task 3.1.1: Send money screen
- [ ] Task 3.1.2: VPA input with validation
- [ ] Task 3.1.3: Amount input screen
- [ ] Task 3.1.4: Payment confirmation screen
- [ ] Task 3.1.5: Success/failure screens

#### 3.2 Fraud Detection Integration
- [ ] Task 3.2.1: Call `/score` before payment execution
- [ ] Task 3.2.2: Parse risk score and decision
- [ ] Task 3.2.3: Implement APPROVE flow (instant execution)
- [ ] Task 3.2.4: Implement REVIEW flow (show warning)
- [ ] Task 3.2.5: Implement REJECT flow (block payment)
- [ ] Task 3.2.6: Display fraud explanation UI

#### 3.3 Decision Enforcement
- [ ] Task 3.3.1: Biometric gate for REVIEW decisions
- [ ] Task 3.3.2: Cooling-off timer UI (30-60s delay)
- [ ] Task 3.3.3: Block screen with reasons

---

### 📱 PHASE 4 — SMS INTELLIGENCE (Week 3)

#### 4.1 Native SMS Module (Java)
- [ ] Task 4.1.1: Create `SmsReceiverModule.java` bridge
- [ ] Task 4.1.2: Implement `BroadcastReceiver` for SMS
- [ ] Task 4.1.3: Extract SMS content and timestamp
- [ ] Task 4.1.4: Send SMS data to React Native via event emitter
- [ ] Task 4.1.5: Request SMS permissions at runtime

#### 4.2 On-Device SMS Classification
- [ ] Task 4.2.1: Source Indian SMS dataset (OTP, scam, phishing)
- [ ] Task 4.2.2: Fine-tune DistilBERT for SMS classification
- [ ] Task 4.2.3: Export model to TFLite (<50MB)
- [ ] Task 4.2.4: Integrate `react-native-fast-tflite`
- [ ] Task 4.2.5: Load model and run inference on SMS
- [ ] Task 4.2.6: Classify: OTP / Scam / Phishing / Banking / Legit

#### 4.3 OTP Guardian
- [ ] Task 4.3.1: Detect OTP pattern in SMS
- [ ] Task 4.3.2: Show "Never share OTP" notification
- [ ] Task 4.3.3: Track OTP receipt timestamp
- [ ] Task 4.3.4: Flag payment if OTP received in last 60s

---

### 📞 PHASE 5 — CALL CONTEXT (Week 3)

#### 5.1 Native Call Module (Java)
- [ ] Task 5.1.1: Create `CallStateModule.java` bridge
- [ ] Task 5.1.2: Implement `PhoneStateListener` for call state
- [ ] Task 5.1.3: Detect active call (OFFHOOK state)
- [ ] Task 5.1.4: Send call state to React Native
- [ ] Task 5.1.5: Request Phone permissions at runtime

#### 5.2 Call-During-Payment Detection
- [ ] Task 5.2.1: Check call state during payment initiation
- [ ] Task 5.2.2: Add `is_call_active` flag to `/score` request
- [ ] Task 5.2.3: Show warning if call detected
- [ ] Task 5.2.4: Log call context in transaction

---

### 📷 PHASE 6 — QR FEATURES (Week 3)

#### 6.1 QR Scanner
- [ ] Task 6.1.1: Install `react-native-vision-camera`
- [ ] Task 6.1.2: Request camera permissions
- [ ] Task 6.1.3: Implement QR scanner screen
- [ ] Task 6.1.4: Parse UPI QR format
- [ ] Task 6.1.5: Pre-fill payment screen with QR data

#### 6.2 QR Generator
- [ ] Task 6.2.1: Install `react-native-qrcode-svg`
- [ ] Task 6.2.2: Generate UPI QR with user's VPA
- [ ] Task 6.2.3: Display QR on "Receive Money" screen
- [ ] Task 6.2.4: Share QR image functionality

#### 6.3 QR Trust Check (Backend Extension)
- [ ] Task 6.3.1: Create `/api/v1/qr/trust/{qr_id}` endpoint
- [ ] Task 6.3.2: Implement QR trust score logic
- [ ] Task 6.3.3: Call trust check before payment
- [ ] Task 6.3.4: Show trust badge in UI

---

### 🔐 PHASE 7 — AUTHENTICATION & SECURITY (Week 4)

#### 7.1 Biometric Authentication
- [ ] Task 7.1.1: Install `react-native-biometrics`
- [ ] Task 7.1.2: Check biometric availability
- [ ] Task 7.1.3: Implement biometric prompt
- [ ] Task 7.1.4: PIN fallback for devices without biometrics
- [ ] Task 7.1.5: Gate high-risk payments with biometric

#### 7.2 Device Fingerprinting
- [ ] Task 7.2.1: Collect device ID, model, OS version
- [ ] Task 7.2.2: Check root status (Java native check)
- [ ] Task 7.2.3: Check emulator status
- [ ] Task 7.2.4: Check VPN/proxy status
- [ ] Task 7.2.5: Send device signals to `/score` endpoint

---

### 🎨 PHASE 8 — UI POLISH & FINAL BUILD (Week 4)

#### 8.1 UI Components
- [ ] Task 8.1.1: Design fraud explanation card
- [ ] Task 8.1.2: Risk score badge (color-coded)
- [ ] Task 8.1.3: Loading states for API calls
- [ ] Task 8.1.4: Error handling UI
- [ ] Task 8.1.5: Onboarding carousel

#### 8.2 Testing & Fixes
- [ ] Task 8.2.1: Test all payment scenarios (approve/review/reject)
- [ ] Task 8.2.2: Test SMS detection with real SMS
- [ ] Task 8.2.3: Test call detection with real call
- [ ] Task 8.2.4: Test QR scan/generate
- [ ] Task 8.2.5: Test biometric auth
- [ ] Task 8.2.6: Fix bugs and edge cases

#### 8.3 APK Generation
- [ ] Task 8.3.1: Configure release build settings
- [ ] Task 8.3.2: Generate signed release APK
- [ ] Task 8.3.3: Test APK on 2-3 different devices
- [ ] Task 8.3.4: Create installation guide
- [ ] Task 8.3.5: Setup APK distribution (Google Drive/direct link)

---

## 🔧 Technical Decisions Log

### Decision 1: React Native over Native Android
**Date:** July 18, 2026  
**Reason:** Team has JS expertise, existing RN dashboard to build on  
**Tradeoff:** Need Java bridges for SMS/Call, but worth it for faster UI dev

### Decision 2: Bare Workflow over Expo Managed
**Date:** July 18, 2026  
**Reason:** Need access to native modules (SMS, Call, TFLite)  
**Implication:** Slightly more complex setup, but necessary for features

### Decision 4: Separate SentinelPay App from Admin Dashboard
**Date:** July 18, 2026  
**Discovery:** Existing `/mobile` is FraudShield admin dashboard (React Native Web)  
**Decision:** Create `/sentinelpay-app` as separate React Native project for consumer wallet  
**Reason:** Admin dashboard and consumer wallet are different products with different UX  
**Structure:**
```
/mobile          → Keep as FraudShield admin dashboard
/sentinelpay-app → New consumer wallet app
```

---

## 🐛 Issues & Resolutions Log

### Issue #1: Docker Desktop Not Running ✅ RESOLVED
**Date:** July 18, 2026  
**Error:** `failed to connect to the docker API at unix:///Users/siddharthreddy/.docker/run/docker.sock`  
**Resolution:** Started Docker Desktop manually  
**Status:** ✅ RESOLVED — PostgreSQL + Redis now running and healthy

---

## 📊 Progress Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Tasks Completed | 8 | 100+ |
| Completion % | 8% | 100% |
| Estimated Days Left | 26 | 0 |
| APK Ready | ❌ | ✅ |
| Backend Health | ✅ HEALTHY | ✅ |
| React Native Project | ✅ CREATED | ✅ |

---

## 🎯 Next Immediate Actions

**Current Status: App Structure Complete, Ready for Emulator Setup**

### ✅ Completed Since Last Update:
- Android build configuration (build.gradle, manifest, permissions)
- MainActivity & MainApplication in Kotlin
- React Navigation with 3 screens
- FraudShield API service integration
- TypeScript app structure with src/ directories
- npm dependencies installed

### 📱 Current Task: Android Emulator Setup

**Option 1: Android Studio (Recommended)**
1. Install Android Studio: https://developer.android.com/studio
2. Or via Homebrew: `brew install --cask android-studio`
3. Open Android Studio → Follow setup wizard → Download SDK
4. Tools → Device Manager → Create Device → Pixel 6 → API 34
5. Add to ~/.zshrc:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```
6. Test: `cd SentinelPayApp && npx react-native run-android`

**Time Estimate:** ~30 minutes (mostly SDK download)

**Option 2: Real Device via USB**
- Enable USB debugging on Android phone
- Connect USB cable
- Run: `npx react-native run-android`

**Progress:** 11/100+ tasks complete (11%)  
**Backend:** ✅ Operational (PostgreSQL + Redis healthy)  
**Mobile:** ✅ App built, awaiting emulator for first run
**Setup Helper:** ✅ Created at `/android-emulator-setup.sh`

---

*Last Updated: July 18, 2026 — Build tracker initialized*
