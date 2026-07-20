# SentinelPay AI — Build Tracker & Progress Log

**Project:** Android UPI Wallet Simulator with Real-Time AI Fraud Detection
**Started:** July 18, 2026 | **Last Updated:** July 20, 2026
**Target:** Phase 1 Demo-Ready APK (sideloaded, no Play Store)

---

## 🧱 TECH STACK (Full Reference)

### Mobile — SentinelPayApp
| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Framework | React Native (Bare Workflow) | 0.73.6 | ✅ Running |
| Language | TypeScript | 5.3.3 | ✅ |
| Navigation | React Navigation Native Stack | 6.1.9 | ✅ |
| State / Storage | AsyncStorage | 1.23.1 | ✅ |
| API Client | Axios | 1.6.7 | ✅ |
| QR Generator | react-native-qrcode-svg + react-native-svg | 6.2.0 / 14.1.0 | ✅ |
| QR Scanner | react-native-vision-camera | 3.8.2 | ✅ |
| Biometrics | react-native-biometrics | 3.0.1 | ✅ installed |
| UI Safety Area | react-native-safe-area-context | 4.8.2 | ✅ |
| JS Engine | Hermes | bundled | ✅ |
| Build System | Gradle 8.6 + AGP 8.x | — | ✅ |
| Native Language | Kotlin 1.9.22 | — | ✅ |
| Java Runtime | Temurin JDK 17 | 17.0.19 | ✅ |
| Target SDK | Android 14 (API 34) | — | ✅ |
| Min SDK | Android 8 (API 26) | — | ✅ |
| Emulator | Pixel 6 AVD, API 34, arm64-v8a | — | ✅ Running |
| Metro Bundler | Metro 0.80.12 | — | ✅ Running :8081 |

### Backend — FraudShield AI
| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Framework | FastAPI | 0.115.0 | ✅ Running :8000 |
| Language | Python | 3.11 (venv) | ✅ |
| ML Model | LightGBM + SHAP explainer | 4.5.0 | ✅ Loaded |
| Anomaly Detection | Isolation Forest | scikit-learn 1.5.2 | ✅ |
| Graph Engine | NetworkX | 3.2.1 | ✅ |
| Rule Engine | Custom (10 rules loaded) | — | ✅ |
| Database | PostgreSQL 16 | 16.14 | ✅ Running :5432 |
| Cache / Session | Redis | 8.8.0 | ✅ Running :6379 |
| ORM | SQLAlchemy 2.0 + psycopg3 | 2.0.35 | ✅ |
| Explainability | SHAP + NL summary | 0.46.0 | ✅ |
| Auth | API Key (X-API-Key header) | — | ✅ |
| Avg API Latency | — | — | ✅ **3.3ms** |

### Infrastructure
| Component | Tool | Status |
|-----------|------|--------|
| PostgreSQL | Homebrew postgresql@16 | ✅ Auto-start |
| Redis | Homebrew redis | ✅ Auto-start |
| Backend | uvicorn + Python 3.11 venv | ✅ Manual start |
| Android Emulator | AOSP arm64 AVD | ✅ Running |
| SDK Manager | cmdline-tools 12.0 | ✅ |
| NDK | 25.1.8937393 | ✅ |

---

## 📊 PROGRESS DASHBOARD

```
Overall Progress  ████████░░░░░░░░░░░░  ~42% (28/68 core tasks)
Phase 1 (Foundation)  ██████████████████████  100% ✅ DONE
Phase 2 (Wallet)      ██████████████████████  100% ✅ DONE
Phase 3 (Payment)     ██████████████████████  100% ✅ DONE
Phase 4 (SMS Intel)   ░░░░░░░░░░░░░░░░░░░░░░   0% ⏳ Next
Phase 5 (Call)        ░░░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 6 (QR)          ████████████████████░░  90% (scanner+gen built, trust API pending)
Phase 7 (Auth)        ░░░░░░░░░░░░░░░░░░░░░░   0% ⏳
Phase 8 (Polish+APK)  ██░░░░░░░░░░░░░░░░░░░░  10% (components built)
```

| Metric | Now | Target |
|--------|-----|--------|
| Core Tasks Done | **28** | 68 |
| Overall Completion | **42%** | 100% |
| Backend Health | ✅ ALL 8 UP | ✅ |
| API Pass Rate | ✅ 16/17 (94.1%) | ✅ |
| API Avg Latency | ✅ **3.3ms** | <200ms |
| App Running on Emulator | ✅ YES | ✅ |
| APK Installable | ✅ Debug APK | Release APK |
| Screens Built | ✅ 6/6 | 6 |
| Fraud APPROVE/REVIEW/REJECT | ✅ Working | ✅ |
| QR Scan + Generate | ✅ Built | ✅ |
| SMS Intelligence | ❌ Not started | ✅ |
| Call Detection | ❌ Not started | ✅ |
| Biometric Gate | ❌ Not wired | ✅ |
| Release APK | ❌ | ✅ |

---

## ✅ COMPLETED TASKS (28 done)

### Phase 0 — Analysis & Setup
- [x] Gap analysis — SentinelPay PRD vs FraudShield backend (70% aligned)
- [x] Architecture decision — React Native bare workflow (not Expo, not native)
- [x] Build tracker created and maintained in real-time

### Phase 1 — Foundation
- [x] **1.1.1** PostgreSQL 16 + Redis 8 running locally (Homebrew, auto-start)
- [x] **1.1.2** FraudShield backend health verified — ALL 8 components UP
- [x] **1.1.3** API test suite — 16/17 passing, 3.3ms avg latency
- [x] **1.2.1** React Native 0.73.6 bare project created at `/SentinelPayApp`
- [x] **1.2.2** Android build config — build.gradle, settings.gradle, AndroidManifest, Kotlin, NDK
- [x] **1.2.3** All npm dependencies installed and version-pinned for RN 0.73 compatibility
- [x] **1.2.4** Project structure — `/screens`, `/services`, `/components`, `/utils`, `/types`
- [x] **1.2.5** First debug build — APK installed and running on Pixel 6 emulator ✅
- [x] **1.3.1** FraudShield API service (axios, typed, 10.0.2.2 for emulator)
- [x] **1.3.2** `/score` endpoint fully integrated
- [x] **1.3.3** `/health` endpoint — live status dot on HomeScreen
- [x] **1.3.4** API config (10.0.2.2 dev / swap to VPS for prod)

### Phase 2 — Simulated Wallet
- [x] **2.1.1–2.1.3** AsyncStorage wallet DB — user, balance, transactions, CRUD helpers
- [x] **2.2.1–2.2.5** Wallet logic — ₹1,00,000 SPC initial, debit/credit, validation, history
- [x] **2.3.1–2.3.3** Home screen — balance card, SIMULATED badge, recent txns, quick actions
- [x] **2.3.4** TransactionHistory screen — full list, stats bar (total/approved/reviewed/blocked)
- [x] TransactionDetail screen — full per-txn breakdown with fraud signals

### Phase 3 — Payment Flow
- [x] **3.1.1–3.1.5** SendMoney screen — VPA input, amount, fraud check, success, blocked
- [x] **3.2.1–3.2.6** Full fraud integration: score → APPROVE (instant) / REVIEW (cooldown) / REJECT (block)
- [x] **3.2.6** FraudExplanationCard + RiskBadge components
- [x] **3.3.2** 5-second cooldown timer on REVIEW decisions
- [x] **3.3.3** Block screen with AI-generated fraud reasons

### Phase 6 — QR Features (partial, built ahead of schedule)
- [x] **6.1.1–6.1.5** QR Scanner — vision-camera, UPI QR parsing, pre-fills SendMoney
- [x] **6.2.1–6.2.4** QR Generator — renders live UPI QR, share VPA, ReceiveMoney screen

---

## ⏳ REMAINING TASKS

### 🔴 PHASE 4 — SMS Intelligence (HIGH PRIORITY)
#### 4.1 Native SMS Module (Java)
- [ ] **4.1.1** Create `SmsReceiverModule.java` + `SmsReceiverPackage.java`
- [ ] **4.1.2** Implement `BroadcastReceiver` for incoming SMS
- [ ] **4.1.3** Extract sender, body, timestamp
- [ ] **4.1.4** Emit to React Native via `DeviceEventEmitter`
- [ ] **4.1.5** Runtime SMS permission request (READ_SMS, RECEIVE_SMS)

#### 4.2 On-Device SMS Classification
- [ ] **4.2.1** Source Indian SMS dataset (OTP, scam, phishing, banking)
- [ ] **4.2.2** Fine-tune DistilBERT / MobileBERT for classification
- [ ] **4.2.3** Export to TFLite (<50MB)
- [ ] **4.2.4** Integrate `react-native-fast-tflite`
- [ ] **4.2.5** Run inference on received SMS
- [ ] **4.2.6** Output label: OTP / SCAM / PHISHING / BANKING / LEGIT

#### 4.3 OTP Guardian
- [ ] **4.3.1** Regex OTP detection in SMS body
- [ ] **4.3.2** "Never share OTP" push notification
- [ ] **4.3.3** Track OTP receipt timestamp in AsyncStorage
- [ ] **4.3.4** Pass `otp_in_last_60s` flag to `/score` payload

---

### 🔴 PHASE 5 — Call Context Detection
#### 5.1 Native Call Module (Java)
- [ ] **5.1.1** Create `CallStateModule.java` + `CallStatePackage.java`
- [ ] **5.1.2** Implement `PhoneStateListener` (IDLE / RINGING / OFFHOOK)
- [ ] **5.1.3** Detect active call (OFFHOOK state)
- [ ] **5.1.4** Emit state to React Native via `DeviceEventEmitter`
- [ ] **5.1.5** Runtime READ_PHONE_STATE permission request

#### 5.2 Integration
- [ ] **5.2.1** Read call state when SendMoney is opened
- [ ] **5.2.2** Pass `is_call_active: true` to `/score` payload
- [ ] **5.2.3** Show "You're on a call — are you sure?" warning banner
- [ ] **5.2.4** Log call context in WalletTransaction record

---

### 🟡 PHASE 6 — QR Trust Check (backend extension)
- [ ] **6.3.1** Add `/api/v1/qr/trust/{vpa}` endpoint to FraudShield
- [ ] **6.3.2** Return trust score + flags for a VPA
- [ ] **6.3.3** Call trust check before showing payment confirmation
- [ ] **6.3.4** Show trust badge (✓ Verified / ⚠ Unknown / ✕ Flagged) in SendMoney

---

### 🟡 PHASE 7 — Authentication & Security
#### 7.1 Biometric Gate
- [ ] **7.1.1** Check biometric availability on app start
- [ ] **7.1.2** Implement biometric prompt (react-native-biometrics)
- [ ] **7.1.3** Trigger biometric for REVIEW decisions (currently just cooldown)
- [ ] **7.1.4** PIN fallback for devices without biometrics
- [ ] **7.1.5** Gate app launch with biometric (optional, Phase 2 hardening)

#### 7.2 Device Fingerprinting
- [ ] **7.2.1** Collect device ID, model, OS version
- [ ] **7.2.2** Java native root detection
- [ ] **7.2.3** Emulator detection flag (already partially done)
- [ ] **7.2.4** VPN/proxy detection
- [ ] **7.2.5** Pass all signals to `/score` device object

---

### 🟢 PHASE 8 — Polish & Release APK
#### 8.1 UI Polish
- [ ] **8.1.3** Skeleton loading states during API calls
- [ ] **8.1.4** Global error boundary + offline state
- [ ] **8.1.5** Onboarding screen (first-launch disclosure)

#### 8.2 Testing
- [ ] **8.2.1** Test APPROVE / REVIEW / REJECT flows end-to-end
- [ ] **8.2.2** Test SMS detection with real device
- [ ] **8.2.3** Test call detection during payment
- [ ] **8.2.4** Test QR scan with real UPI QR codes
- [ ] **8.2.5** Test biometric auth
- [ ] **8.2.6** Edge case: insufficient balance, network timeout, invalid VPA

#### 8.3 Release APK
- [ ] **8.3.1** Configure release signing (generate production keystore)
- [ ] **8.3.2** Run `./gradlew assembleRelease`
- [ ] **8.3.3** Test release APK on physical device
- [ ] **8.3.4** Write sideload installation guide
- [ ] **8.3.5** Upload to Google Drive / share link

---

## 🗂️ ALL SOURCE FILES

### Mobile App (`/SentinelPayApp/src/`)
```
src/
├── App.tsx                          ← Root navigator (6 screens wired)
├── types/index.ts                   ← All TypeScript types
├── services/
│   └── fraudShieldApi.ts            ← Axios client → FraudShield backend
├── utils/
│   └── walletDb.ts                  ← AsyncStorage wallet DB + payment logic
├── components/
│   ├── RiskBadge.tsx                ← APPROVE/REVIEW/REJECT colour pill
│   └── FraudExplanationCard.tsx     ← AI explanation + score bar
└── screens/
    ├── HomeScreen.tsx               ← Dashboard: balance, actions, recent txns
    ├── SendMoneyScreen.tsx          ← Full payment + live fraud scoring
    ├── TransactionHistoryScreen.tsx ← Full history with stats
    ├── TransactionDetailScreen.tsx  ← Per-txn deep dive
    ├── ReceiveMoneyScreen.tsx       ← QR generator + share VPA
    └── ScanQRScreen.tsx             ← Camera QR scanner
```

### Backend (`/backend/app/`)
```
app/
├── main.py                 ← FastAPI app, middleware, lifespan
├── config.py               ← Settings (thresholds, weights, keys)
├── api/v1/
│   ├── score.py            ← POST /score (main fraud endpoint)
│   ├── risk.py             ← GET /risk/{txn_id}
│   ├── health.py           ← GET /health
│   ├── analytics.py        ← GET /analytics
│   ├── feedback.py         ← POST /feedback
│   └── model.py            ← GET /model
├── core/scoring_engine.py  ← Orchestrates all 4 engines
├── engines/
│   ├── ml_engine.py        ← LightGBM + Isolation Forest
│   ├── rule_engine.py      ← 10 active rules
│   ├── behavioral_engine.py← Velocity + pattern analysis
│   ├── graph_engine.py     ← NetworkX graph risk
│   └── xai_engine.py       ← SHAP explanations → NL summary
├── ml_models/              ← lgbm_model.pkl, iso_forest_model.pkl, shap_explainer.pkl
├── db/                     ← PostgreSQL schema, init, seed
└── services/
    ├── redis_service.py    ← Redis client + in-memory fallback
    └── auth_service.py     ← API key verification
```

---

## 🔧 TECHNICAL DECISIONS LOG

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| 1 | React Native over Native Android | July 18 | JS expertise, faster UI dev |
| 2 | Bare Workflow over Expo Managed | July 18 | Need native SMS/Call/TFLite modules |
| 3 | AsyncStorage over SQLite | July 19 | No extra native dep, sufficient for demo |
| 4 | Python 3.11 venv for backend | July 19 | Python 3.14 incompatible with pinned ML deps |
| 5 | Kotlin 1.9.22 (not 2.x) | July 20 | AsyncStorage 1.23.1 works; 2.x breaks RN 0.73 ecosystem |
| 6 | Gradle 8.6 + AGP 8.x | July 20 | Required by RN 0.73 gradle plugin |
| 7 | `10.0.2.2` as backend URL | July 20 | Android emulator maps this to host's localhost |

---

## 🐛 ISSUES & RESOLUTIONS

| # | Issue | Date | Fix |
|---|-------|------|-----|
| 1 | Docker Desktop not running | July 18 | Started manually |
| 2 | Python 3.14 breaks pinned ML deps | July 19 | Used Python 3.11 venv |
| 3 | LightGBM missing `libomp` | July 19 | `brew install libomp` |
| 4 | Android SDK missing cmdline-tools + NDK | July 20 | Downloaded manually from Google |
| 5 | Java 8 too old for sdkmanager | July 20 | `brew install --cask temurin@17` |
| 6 | `settings.gradle` passed `this` not `settings` | July 20 | Fixed to `applyNativeModulesSettingsGradle(settings)` |
| 7 | `react-native-svg` / `react-native-screens` version mismatch | July 20 | Pinned svg@14.1.0, screens@3.29.0 |
| 8 | AsyncStorage requires Kotlin 2.1 | July 20 | Pinned to version 1.23.1 |
| 9 | Android blocks cleartext HTTP to 10.0.2.2 | July 20 | Added `network_security_config.xml` |
| 10 | Metro config missing | July 20 | Copied `metro.config.js` + `babel.config.js` from RN template |

---

## 🎯 NEXT IMMEDIATE ACTIONS

**Status: App running on emulator ✅ — Phase 4 (SMS) is next high-value task**

### Option A — SMS Intelligence (highest PRD value)
Build the Java native bridge for SMS reception + OTP detection

```
Priority order:
1. SmsReceiverModule.java    ← native bridge
2. OTP regex detection       ← pass flag to /score
3. TFLite SMS classifier     ← on-device ML (can defer)
```

### Option B — Release APK now (demo-ready)
```bash
cd SentinelPayApp/android
./gradlew assembleRelease
# APK at: app/build/outputs/apk/release/app-release.apk
```

### Option C — Biometric Gate (quick win, 1-2 hours)
Wire `react-native-biometrics` (already installed) into REVIEW payment flow

---

## 🚀 HOW TO RESTART EVERYTHING

```bash
# 1. Backend services (auto-start on login, but if needed:)
brew services start postgresql@16
brew services start redis

# 2. FraudShield backend
cd /Users/pranaykadam/Desktop/upi/backend
venv/bin/python run.py    # runs at http://localhost:8000

# 3. Android emulator
export ANDROID_HOME=$HOME/Library/Android/sdk
$ANDROID_HOME/emulator/emulator -avd SentinelPay_Pixel6 -no-snapshot-load -no-audio &

# 4. Metro bundler + run app
cd /Users/pranaykadam/Desktop/upi/SentinelPayApp
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
npx react-native start           # terminal 1
npx react-native run-android --deviceId emulator-5554 --no-packager  # terminal 2
```

---

*Last Updated: July 20, 2026 — App running on emulator, Phases 1–3 + QR complete*
