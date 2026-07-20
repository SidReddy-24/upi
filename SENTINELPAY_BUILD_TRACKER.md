# SentinelPay AI — Build Tracker & Progress Log

**Project:** Android UPI Wallet Simulator with Real-Time AI Fraud Detection
**Started:** [Context Transfer Date] | **Last Updated:** July 21, 2026 (Session 4)
**Target:** Phase 1 Demo-Ready APK (sideloaded, no Play Store)

---

## 🚀 LATEST UPDATE (July 21, 2026 — Session 4)

**Bugs Fixed:**
- ✅ `GET /api/v1/risk/{nonexistent}` was returning 500 instead of 404 — fixed by adding `except HTTPException: raise` guard in `risk.py`
- ✅ `POST /api/v1/feedback` was returning 500 with `CLEAR_FRAUD`/`CONFIRM_FRAUD` types — root cause was `analyst_decision VARCHAR(8)` column too short for "LEGITIMATE". Fixed: migrated to `VARCHAR(16)` + updated `schema.sql`
- ✅ Test payloads used wrong `feedback_type` values (`FALSE_POSITIVE`/`TRUE_POSITIVE`) — corrected to `CLEAR_FRAUD`/`CONFIRM_FRAUD` per schema CHECK constraint
- ✅ **Backend API tests: 13/13 passing 🎉** (up from 10/13)

**New Code Built:**
- ✅ **Phase 4** — `useSmsOtp.ts` hook: requests RECEIVE_SMS + READ_SMS permissions, registers native listener, runs OTP regex (`\b\d{4,8}\b`), stores timestamp in AsyncStorage, sets `otpInLast60s` flag with 60s auto-reset
- ✅ **Phase 5** — `useCallState.ts` hook: requests READ_PHONE_STATE permission, calls `isCallActive()` immediately + subscribes to `onCallStateChanged` events
- ✅ **Phase 6.3** — `GET /api/v1/qr/trust/{vpa}` backend endpoint: checks Redis blacklist, Redis graph risk, in-memory graph engine; returns VERIFIED/CAUTION/FLAGGED trust level + flags
- ✅ **Phase 7** — `ReactNativeBiometrics.simplePrompt()` wired into `handleExecute()` in SendMoneyScreen — fires for APPROVE and REVIEW decisions; gracefully falls through if biometrics unavailable
- ✅ **SendMoneyScreen.tsx** — Complete rewrite integrating all three hooks + QR trust badge (live trust check as VPA is typed) + call warning banner + OTP warning banner + biometric gate

**Current Status:**
- 🛡️ Backend: 13/13 tests passing, 8/8 health components UP, avg ~6ms latency
- 📱 App: All 6 screens built, Phase 4+5+6.3+7 integrated in TypeScript
- 🏗️ Needs: Full native rebuild (`npx react-native run-android`) to link new Java modules

---

## 📝 CONVERSATION CONTEXT SUMMARY

This project was transferred from a previous conversation session. Key background:

### Original Task Sequence:
1. **Gap Analysis** — Analyzed SentinelPay PRD against existing FraudShield backend (70% aligned)
2. **Backend Verification** — Tested all FraudShield APIs, confirmed 17/17 passing with 23-24ms avg latency
3. **Infrastructure Setup** — Started PostgreSQL 15 + Redis 7 via Docker (now running locally via Docker)
4. **Tech Stack Decision** — Chose React Native bare workflow over native Kotlin/Java (user has JS expertise)
5. **Build Tracking System** — Created this document to maintain real-time context
6. **Project Creation** — Set up `/SentinelPayApp` with React Native 0.73.6 bare workflow
7. **Android Configuration** — Created all build files, MainActivity, navigation, API integration
8. **Emulator Setup** — User installed Android Studio and created Pixel 6 API 34 emulator
9. **Screen Implementation** — Built all 6 core screens with full fraud detection integration
10. **Phase 4+5+6.3+7** — Native Java SMS + Call modules wired to TypeScript hooks, QR Trust API built

### Key User Requirements:
- **Real Device Focus**: User prefers testing on real Android device (sideload APK)
- **Simulated Money**: Must be clearly labeled "SentinelPay Credits (SPC)" everywhere
- **Privacy-First**: SMS classification must be 100% on-device (TFLite), zero cloud upload
- **Sub-200ms SLA**: Real-time fraud scoring is critical (currently achieving ~6ms avg)
- **Separate Apps**: `/mobile` = admin dashboard, `/SentinelPayApp` = consumer wallet
- **No Play Store**: Demo APK only, sideloaded installation

### Backend Status:
- FraudShield backend fully operational at `http://localhost:8000/api/v1`
- All 8 health components UP (API, Redis, PostgreSQL, ML, Rules, Behavior, Graph)
- API test suite: **13/13 passing (100%) 🎉**, avg latency ~6ms
- API key configured: `fs_demo_key_001`

### Current App Status:
- ✅ Running on Pixel 6 emulator (API 34, Android 14)
- ✅ All 6 screens built and functional
- ✅ Full payment flow with fraud detection working
- ✅ QR scanner + generator working
- ✅ SMS OTP hook written (Phase 4) — needs native rebuild to activate
- ✅ Call detection hook written (Phase 5) — needs native rebuild to activate
- ✅ QR Trust API live (Phase 6.3)
- ✅ Biometrics wired in SendMoneyScreen (Phase 7)
- ❌ TFLite SMS classifier (Phase 4.2 — deferred, model not trained)
- ❌ Release APK (Phase 8 — one `./gradlew assembleRelease` away)

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
| Biometrics | react-native-biometrics | 3.0.1 | ✅ **Wired** |
| UI Safety Area | react-native-safe-area-context | 4.8.2 | ✅ |
| JS Engine | Hermes | bundled | ✅ |
| Build System | Gradle 8.6 + AGP 8.x | — | ✅ |
| Native Language | Kotlin 1.9.22 | — | ✅ |
| Java Runtime | Temurin JDK 17 | 17.0.19 | ✅ |
| Target SDK | Android 14 (API 34) | — | ✅ |
| Min SDK | Android 8 (API 26) | — | ✅ |
| Emulator | Pixel 6 AVD, API 34, arm64-v8a | — | ✅ |
| Metro Bundler | Metro 0.80.12 | — | manual start :8081 |

### Backend — FraudShield AI
| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Framework | FastAPI | 0.115.0 | ✅ Running :8000 |
| Language | Python | 3.13 (venv at /Desktop/upi/venv/) | ✅ |
| ML Model | LightGBM + SHAP explainer | 4.5.0 | ✅ Loaded |
| Anomaly Detection | Isolation Forest | scikit-learn 1.5.2 | ✅ |
| Graph Engine | NetworkX | 3.2.1 | ✅ |
| Rule Engine | Custom (10 rules loaded) | — | ✅ |
| Database | PostgreSQL 16 (Docker) | — | ✅ Running :5432 |
| Cache / Session | Redis (Docker) | — | ✅ Running :6379 |
| ORM | SQLAlchemy 2.0 + psycopg3 | 2.0.35 | ✅ |
| Explainability | SHAP + NL summary | 0.46.0 | ✅ |
| Auth | API Key (X-API-Key header) | — | ✅ |
| Avg API Latency | — | — | ✅ **~6ms** |

---

## 📊 PROGRESS DASHBOARD

```
Overall Progress  ██████████████░░░░░░  ~72% (49/68 core tasks)
Phase 1 (Foundation)  ██████████████████████  100% ✅ DONE
Phase 2 (Wallet)      ██████████████████████  100% ✅ DONE
Phase 3 (Payment)     ██████████████████████  100% ✅ DONE
Phase 4 (SMS Intel)   ████████████████░░░░░░   75% ✅ Java+TS done, TFLite deferred
Phase 5 (Call)        ████████████████████░░   90% ✅ Java+TS done, needs rebuild
Phase 6 (QR)          ██████████████████████  100% ✅ scanner+gen+trust API done
Phase 7 (Auth)        █████████████████░░░░░   80% ✅ biometric gate wired, PIN TBD
Phase 8 (Polish+APK)  ████░░░░░░░░░░░░░░░░░░   20% needs release build
```

| Metric | Now | Target |
|--------|-----|--------|
| Core Tasks Done | **49** | 68 |
| Overall Completion | **~72%** | 100% |
| Backend Health | ✅ ALL 8 UP | ✅ |
| API Pass Rate | ✅ **13/13 (100%)** | ✅ |
| API Avg Latency | ✅ **~6ms** | <200ms |
| App Running on Emulator | ✅ YES | ✅ |
| APK Installable | ✅ Debug APK | Release APK |
| Screens Built | ✅ 6/6 | 6 |
| Fraud APPROVE/REVIEW/REJECT | ✅ Working | ✅ |
| QR Scan + Generate | ✅ Built | ✅ |
| QR VPA Trust Check | ✅ Live | ✅ |
| SMS OTP Hook | ✅ Written | needs rebuild |
| Call Detection Hook | ✅ Written | needs rebuild |
| Biometric Gate | ✅ Wired | ✅ |
| TFLite SMS Classifier | ❌ Deferred | optional |
| Release APK | ❌ | ✅ |

---

## ✅ COMPLETED TASKS (49 done)

### Phase 0 — Analysis & Setup
- [x] Gap analysis — SentinelPay PRD vs FraudShield backend (70% aligned)
- [x] Architecture decision — React Native bare workflow (not Expo, not native)
- [x] Build tracker created and maintained in real-time

### Phase 1 — Foundation
- [x] **1.1.1** PostgreSQL 16 + Redis running locally (Docker auto-start)
- [x] **1.1.2** FraudShield backend health verified — ALL 8 components UP
- [x] **1.1.3** API test suite — **13/13 passing 🎉**, ~6ms avg latency
- [x] **1.2.1** React Native 0.73.6 bare project created at `/SentinelPayApp`
- [x] **1.2.2** Android build config — build.gradle, settings.gradle, AndroidManifest, Kotlin, NDK
- [x] **1.2.3** All npm dependencies installed and version-pinned for RN 0.73 compatibility
- [x] **1.2.4** Project structure — `/screens`, `/services`, `/components`, `/utils`, `/types`, `/hooks`
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

### Phase 4 — SMS Intelligence (75% done)
- [x] **4.1.1** `SmsReceiverModule.java` + `SmsReceiverPackage.java` created
- [x] **4.1.2** BroadcastReceiver for `android.provider.Telephony.SMS_RECEIVED`
- [x] **4.1.3** Extracts sender, body, timestamp from PDU
- [x] **4.1.4** Emits `onSmsReceived` event to React Native via DeviceEventEmitter
- [x] **4.1.5** Runtime permissions (READ_SMS, RECEIVE_SMS) in `useSmsOtp.ts`
- [x] **4.3.1** OTP regex detection (`\b\d{4,8}\b`) in `useSmsOtp.ts`
- [x] **4.3.3** OTP timestamp stored in AsyncStorage (`sentinelpay_last_otp_at`)
- [x] **4.3.4** `otp_in_last_60s` flag passed in `/score` metadata payload
- [ ] **4.2.x** TFLite SMS classifier — deferred (model not trained)

### Phase 5 — Call Detection (90% done)
- [x] **5.1.1** `CallStateModule.java` + `CallStatePackage.java` created
- [x] **5.1.2** `PhoneStateListener` for IDLE/RINGING/OFFHOOK states
- [x] **5.1.3** OFFHOOK detection as `isCallActive`
- [x] **5.1.4** `onCallStateChanged` event emitted to React Native
- [x] **5.1.5** Runtime `READ_PHONE_STATE` permission in `useCallState.ts`
- [x] **5.2.1** `isCallActive` queried when SendMoney is opened (immediate check)
- [x] **5.2.2** `is_call_active: true` passed in `/score` metadata
- [x] **5.2.3** "You're on a call" warning banner + pre-score alert
- [ ] **5.2.4** Log call context in WalletTransaction record (minor, next)

### Phase 6 — QR Features (100% done)
- [x] **6.1.1–6.1.5** QR Scanner — vision-camera, UPI QR parsing, pre-fills SendMoney
- [x] **6.2.1–6.2.4** QR Generator — renders live UPI QR, share VPA, ReceiveMoney screen
- [x] **6.3.1** `GET /api/v1/qr/trust/{vpa}` endpoint added to FraudShield backend
- [x] **6.3.2** Returns trust_score + flags (BLACKLISTED_VPA, HIGH_GRAPH_RISK, FRAUD_RING_MEMBER)
- [x] **6.3.3** Trust check called in SendMoneyScreen as VPA is typed (live, debounced by useEffect)
- [x] **6.3.4** Trust badge shown: ✓ VERIFIED / ⚠ CAUTION / ✕ FLAGGED (colour-coded)

### Phase 7 — Authentication & Security (80% done)
- [x] **7.1.1** `rnBiometrics.isSensorAvailable()` check on each payment
- [x] **7.1.2** `rnBiometrics.simplePrompt()` biometric prompt implemented
- [x] **7.1.3** Biometric triggered for both APPROVE and REVIEW decisions
- [x] **7.1.4** Graceful fallback if biometrics unavailable (allows through)
- [ ] **7.1.5** Gate app launch with biometric (optional hardening)
- [ ] **7.2.1–7.2.5** Device fingerprinting (next session)

### Registered in MainApplication.kt
- [x] `SmsReceiverPackage()` added to `getPackages()`
- [x] `CallStatePackage()` added to `getPackages()`

### Backend Fixes (Session 4)
- [x] `risk.py`: Added `except HTTPException: raise` guard — 404 now correctly propagates
- [x] `schema.sql`: `analyst_decision VARCHAR(8)` → `VARCHAR(16)` (was too short for "LEGITIMATE")
- [x] `test_all_apis.py`: feedback_type corrected to `CLEAR_FRAUD`/`CONFIRM_FRAUD`
- [x] `qr_trust.py`: New endpoint + registered in `router.py`
- [x] `fraudShieldApi.ts`: Added `getQrTrust()` method + `QRTrustResult` type
- [x] `seed_demo.py`: Added `mule@okhdfc` to blacklist for test fixtures

---

## ⏳ REMAINING TASKS

### 🟡 PHASE 5 — Call Detection (Minor Remaining)
- [ ] **5.2.4** Log `call_during_payment: true` field in WalletTransaction record

### 🟡 PHASE 7 — Authentication & Security
- [ ] **7.1.5** Gate app launch with biometric (optional Phase 2 hardening)
- [ ] **7.2.1** Collect device ID, model, OS version for fingerprinting
- [ ] **7.2.2** Java native root detection
- [ ] **7.2.3** Emulator detection flag (already partially done)
- [ ] **7.2.4** VPN/proxy detection
- [ ] **7.2.5** Pass all signals to `/score` device object

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
│   └── fraudShieldApi.ts            ← Axios client → FraudShield + getQrTrust()
├── utils/
│   └── walletDb.ts                  ← AsyncStorage wallet DB + payment logic
├── hooks/                           ← NEW in Session 4
│   ├── useSmsOtp.ts                 ← Phase 4: SMS OTP detection + 60s flag
│   └── useCallState.ts              ← Phase 5: Call state native bridge hook
├── components/
│   ├── RiskBadge.tsx                ← APPROVE/REVIEW/REJECT colour pill
│   └── FraudExplanationCard.tsx     ← AI explanation + score bar
└── screens/
    ├── HomeScreen.tsx               ← Dashboard: balance, actions, recent txns
    ├── SendMoneyScreen.tsx          ← ⭐ Updated: SMS+Call+Biometric+QRTrust
    ├── TransactionHistoryScreen.tsx ← Full history with stats
    ├── TransactionDetailScreen.tsx  ← Per-txn deep dive
    ├── ReceiveMoneyScreen.tsx       ← QR generator + share VPA
    └── ScanQRScreen.tsx             ← Camera QR scanner
```

### Native Java (`/SentinelPayApp/android/app/src/main/java/com/sentinelpay/`)
```
├── MainActivity.kt                  ← Standard RN entry
├── MainApplication.kt               ← Registers SMS + Call packages
├── SmsReceiverModule.java           ← Phase 4: BroadcastReceiver → RN event
├── SmsReceiverPackage.java          ← Phase 4: Package wrapper
├── CallStateModule.java             ← Phase 5: PhoneStateListener → RN event
└── CallStatePackage.java            ← Phase 5: Package wrapper
```

### Backend (`/backend/app/`)
```
app/
├── main.py                 ← FastAPI app, middleware, lifespan
├── config.py               ← Settings (thresholds, weights, keys)
├── api/v1/
│   ├── score.py            ← POST /score (main fraud endpoint)
│   ├── risk.py             ← GET /risk/{txn_id} (fixed 404 bug)
│   ├── health.py           ← GET /health
│   ├── analytics.py        ← GET /analytics
│   ├── feedback.py         ← POST /feedback (fixed VARCHAR bug)
│   ├── model.py            ← GET /model
│   └── qr_trust.py         ← NEW: GET /qr/trust/{vpa} (Phase 6.3)
├── core/scoring_engine.py  ← Orchestrates all 4 engines
├── engines/                ← ml, rule, behavioral, graph, xai
├── ml_models/              ← lgbm_model.pkl, iso_forest_model.pkl, shap_explainer.pkl
├── db/
│   ├── schema.sql          ← Fixed: analyst_decision VARCHAR(16)
│   ├── init_db.py
│   └── seed_demo.py        ← Updated: added mule@okhdfc blacklist
└── services/
    ├── redis_service.py
    └── auth_service.py
```

---

## 🔧 TECHNICAL DECISIONS LOG

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| 1 | React Native over Native Android | Session 1 | JS expertise, faster UI dev, user preference |
| 2 | Bare Workflow over Expo Managed | Session 1 | Need native SMS/Call/TFLite modules (unavoidable) |
| 3 | AsyncStorage over SQLite | Session 1 | No extra native dep, sufficient for demo wallet |
| 4 | Python 3.13 venv for backend | Session 1 | Use system Python 3.13 (worked with pinned deps) |
| 5 | Kotlin 1.9.22 (not 2.x) | Session 1 | AsyncStorage 1.23.1 works; 2.x breaks RN 0.73 ecosystem |
| 6 | Gradle 8.6 + AGP 8.x | Session 1 | Required by RN 0.73 gradle plugin |
| 7 | `10.0.2.2` as backend URL | Session 1 | Android emulator maps this to host's localhost |
| 8 | Separate Apps | Session 1 | `/mobile` = FraudShield admin, `/SentinelPayApp` = consumer wallet |
| 9 | Java Bridges in Java (not Kotlin) | Session 2 | Simpler interop with existing Java telephony/SMS APIs |
| 10 | Custom hooks for SMS/Call | Session 4 | Clean separation of concerns; testable in isolation |
| 11 | QR Trust as separate endpoint | Session 4 | Can be called before /score for UX preview; reusable by other clients |
| 12 | Biometric fallthrough on failure | Session 4 | Better UX — biometrics optional until hardening phase |

---

## 🐛 ISSUES & RESOLUTIONS

| # | Issue | Date | Fix |
|---|-------|------|-----|
| 1 | Docker Desktop not running | July 18 | Started manually |
| 2 | Python 3.14 breaks pinned ML deps | July 19 | Used Python 3.11/3.13 venv at `/Desktop/upi/venv/` |
| 3 | LightGBM missing `libomp` | July 19 | `brew install libomp` |
| 4 | Android SDK missing cmdline-tools + NDK | July 20 | Downloaded manually from Google |
| 5 | Java 8 too old for sdkmanager | July 20 | `brew install --cask temurin@17` |
| 6 | `settings.gradle` passed `this` not `settings` | July 20 | Fixed to `applyNativeModulesSettingsGradle(settings)` |
| 7 | `react-native-svg` / `react-native-screens` version mismatch | July 20 | Pinned svg@14.1.0, screens@3.29.0 |
| 8 | AsyncStorage requires Kotlin 2.1 | July 20 | Pinned to version 1.23.1 |
| 9 | Android blocks cleartext HTTP to 10.0.2.2 | July 20 | Added `network_security_config.xml` |
| 10 | Metro config missing | Session 1 | Copied `metro.config.js` + `babel.config.js` from RN template |
| 11 | `GET /risk/{nonexistent}` returned 500 instead of 404 | July 21 | Added `except HTTPException: raise` in `risk.py` catch block |
| 12 | `POST /feedback` returned 500 with LEGITIMATE decision | July 21 | `analyst_decision VARCHAR(8)` too narrow — migrated to `VARCHAR(16)` |
| 13 | Test used wrong `feedback_type` values | July 21 | Schema uses `CLEAR_FRAUD`/`CONFIRM_FRAUD`, not `FALSE_POSITIVE`/`TRUE_POSITIVE` |

---

## 🎯 NEXT IMMEDIATE ACTIONS

**Status: Phase 4/5/6.3/7 TypeScript done ✅ — Native rebuild needed to activate SMS/Call**

### Step 1 — Native Rebuild (REQUIRED to activate Phase 4+5)
```bash
# Kill Metro and existing app
adb -s emulator-5554 shell am force-stop com.sentinelpay

# Ensure JAVA_HOME is set
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk

# Full rebuild (Metro already running)
cd /Users/siddharthreddy/Desktop/upi/SentinelPayApp
npx react-native run-android --deviceId emulator-5554 --no-packager
```

### Step 2 — Release APK (demo-ready in ~10 min)
```bash
cd /Users/siddharthreddy/Desktop/upi/SentinelPayApp/android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

### Step 3 — Device Fingerprinting (optional, Phase 7.2)
Wire device ID, root detection, emulator flag more precisely into `/score` payload

### Step 4 — Onboarding Screen (Phase 8.1.5)
First-launch screen explaining simulated nature of the app

---

## 🚀 HOW TO RESTART EVERYTHING

```bash
# 1. Backend services (Docker containers — check they are running)
docker ps | grep -E "postgres|redis"
# If not running: docker compose up -d (from /Desktop/upi/)

# 2. FraudShield backend
cd /Users/siddharthreddy/Desktop/upi/backend
/Users/siddharthreddy/Desktop/upi/venv/bin/python run.py  # runs at http://localhost:8000

# 3. Android emulator
export ANDROID_HOME=$HOME/Library/Android/sdk
$ANDROID_HOME/emulator/emulator -avd SentinelPay_Pixel6 -no-snapshot-load -no-audio &

# 4. Port forward
$ANDROID_HOME/platform-tools/adb -s emulator-5554 reverse tcp:8081 tcp:8081

# 5. Metro bundler + run app
cd /Users/siddharthreddy/Desktop/upi/SentinelPayApp
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
npx react-native start           # terminal 1
npx react-native run-android --deviceId emulator-5554 --no-packager  # terminal 2
```

---

## 📚 REFERENCE DOCUMENTS

| Document | Path | Purpose |
|----------|------|---------|
| Gap Analysis | `/SENTINELPAY_FRAUDSHIELD_GAP_ANALYSIS.md` | PRD vs Backend alignment, architecture decisions |
| Context Doc | `/CONTEXT.md` | Complete context handoff document |
| FraudShield SRD | `/FraudShield_AI_SRD.md` | Backend API specifications |
| API Test Suite | `/test_all_apis.py` | Backend verification tests (13/13 passing) |
| Emulator Setup Script | `/android-emulator-setup.sh` | Android Studio setup guide |

---

*Last Updated: July 21, 2026 — Session 4 complete. 72% overall. Phase 4+5+6.3+7 TypeScript done. 13/13 API tests passing. Next: native rebuild to activate SMS/Call, then release APK.*
