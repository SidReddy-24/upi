Created At: 2026-07-21T00:36:26+05:30
Completed At: 2026-07-21T00:52:00+05:30
File Path: `file:///Users/siddharthreddy/Desktop/upi/CONTEXT.md`
Total Lines: 630
Total Bytes: 28500

# SentinelPay — AI Handoff Context Document
**Last Updated:** July 21, 2026 (Session 4 Progress Update)
**Purpose:** Complete factual context for the next AI agent to pick up this build without hallucination.
**Read this before touching any file.**

---

## 0. CONVERSATION TRANSFER SUMMARY

This project was transferred from a previous conversation session and updated in Session 4. The conversations total **42 messages** across multiple work sessions.

### How This Project Started:
1. User provided SentinelPay PRD (Android UPI wallet simulator with fraud detection)
2. Gap analysis completed comparing PRD requirements against existing FraudShield backend
3. Found 70% alignment — backend production-ready, mobile app needs to be built
4. User decided on React Native (bare workflow) over native Kotlin/Java due to JS expertise
5. Built complete foundation, wallet system, payment flow, and QR features
6. **Session 4 Update (~72% completion)**: Implemented SMS hook, Call state hook, Biometric gate, QR Trust backend endpoint & frontend badge, and resolved all backend test failures.

### User Preferences & Requirements:
- **Real device focus**: Wants sideloaded APK for real Android phone (not just emulator)
- **Java preference**: User initially wanted Java over Kotlin, but using Kotlin for MainActivity (standard)
- **Privacy-first**: SMS classification MUST be 100% on-device (TFLite), zero cloud upload
- **Clear simulated money**: Must show "SentinelPay Credits (SPC)" everywhere with SIMULATED badges
- **Speed critical**: Sub-200ms fraud scoring is mandatory (currently achieving 6ms avg ✅)
- **No Play Store**: Demo APK only, sideload installation
- **Separate apps**: `/mobile` = FraudShield admin dashboard (existing), `/SentinelPayApp` = consumer wallet (new)

### Infrastructure Evolution:
- **Originally**: PostgreSQL 15 + Redis 7 via Docker Compose (`docker-compose.yml`)
- **Currently**: PostgreSQL 16 + Redis via Docker (active port listeners).
- **Backend**: Unchanged — FraudShield FastAPI at `http://localhost:8000/api/v1`

### Backend Verification Completed:
- Created comprehensive API test suite (`test_all_apis.py`)
- **13/13 tests passing (100%) 🎉**
  - Fixed database lookup 500 error on nonexistent txn ID (404 correctly propagates now)
  - Fixed check constraint database conflict on feedback submission (`analyst_decision` type altered from `VARCHAR(8)` to `VARCHAR(16)`)
  - Corrected test feedback requests to match valid ENUMs (`CLEAR_FRAUD` / `CONFIRM_FRAUD`)
- **Average latency: ~6ms** (well under 200ms SLA)
- All 8 health components UP: API Gateway, Redis, PostgreSQL, ML, Rules, Behavior, Graph, Kafka
- API key working: `fs_demo_key_001`

---

## 1. WHAT THIS PROJECT IS

A **React Native Android wallet app** called **SentinelPay** that simulates UPI payments with ₹1,00,000 of fake "SPC" (SentinelPay Credits). Every payment is scored in real-time by an existing AI fraud detection backend called **FraudShield**. The app is sideloaded as an APK — no Play Store.

**It is NOT a real payment app. All money is simulated.**

---

## 2. REPO STRUCTURE (absolute paths)

```
/Users/siddharthreddy/Desktop/upi/
├── CONTEXT.md                          ← THIS FILE
├── SENTINELPAY_BUILD_TRACKER.md        ← Live task tracker
├── SENTINELPAY_FRAUDSHIELD_GAP_ANALYSIS.md  ← PRD vs Backend analysis
├── FraudShield_AI_SRD.md               ← Backend API specifications
├── android-emulator-setup.sh           ← Emulator setup guide
├── docker-compose.yml                  ← Original Docker setup (PostgreSQL 15 + Redis 7)
├── SentinelPayApp/                     ← React Native mobile app
│   ├── android/                        ← Android native project
│   ├── src/                            ← All TypeScript/React source
│   │   ├── App.tsx
│   │   ├── types/index.ts
│   │   ├── services/fraudShieldApi.ts
│   │   ├── utils/walletDb.ts
│   │   ├── hooks/                      ← Added: useSmsOtp.ts, useCallState.ts
│   │   ├── components/
│   │   │   ├── RiskBadge.tsx
│   │   │   └── FraudExplanationCard.tsx
│   │   └── screens/
│   │       ├── HomeScreen.tsx
│   │       ├── SendMoneyScreen.tsx     ← Updated: integrated SMS+Call+Biometric+QRTrust
│   │       ├── TransactionHistoryScreen.tsx
│   │       ├── TransactionDetailScreen.tsx
│   │       ├── ReceiveMoneyScreen.tsx
│   │       └── ScanQRScreen.tsx
│   ├── index.js                        ← RN entry point
│   ├── metro.config.js
│   ├── babel.config.js
│   └── package.json
├── backend/                            ← FraudShield FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/v1/                     ← score, risk, health, analytics, feedback, model, qr_trust (new)
│   │   ├── core/scoring_engine.py      ← Main orchestrator
│   │   ├── engines/                    ← ml, rule, behavioral, graph, xai
│   │   ├── ml_models/                  ← lgbm_model.pkl, iso_forest_model.pkl, shap_explainer.pkl
│   │   ├── db/                         ← schema.sql, init_db.py, seed_demo.py
│   │   └── services/                   ← redis_service.py, auth_service.py
│   ├── requirements.txt
│   ├── run.py                          ← uvicorn entry point
│   └── run_api_tests.py                ← API verification suite
├── test_all_apis.py                    ← Root-level full API test suite (13/13 passing)
├── mobile/                             ← FraudShield admin dashboard (existing, separate from SentinelPayApp)
└── data/
    ├── raw_transactions.csv
    └── processed_features.csv
```

---

## 3. TECH STACK (exact versions — do not upgrade without testing)

### Mobile App
| What | Value |
|------|-------|
| Framework | React Native **0.73.6** (bare workflow, NOT Expo) |
| Language | TypeScript 5.3.3 |
| Navigation | @react-navigation/native **6.1.9** + native-stack **6.9.17** |
| Local storage | @react-native-async-storage/async-storage **1.23.1** (MUST stay at 1.x — newer needs Kotlin 2.1 which breaks the build) |
| HTTP client | axios **1.6.7** |
| QR generator | react-native-qrcode-svg **6.2.0** + react-native-svg **14.1.0** |
| QR/camera | react-native-vision-camera **3.8.2** |
| Biometrics | react-native-biometrics **3.0.1** (Wired in SendMoneyScreen) |
| Safe area | react-native-safe-area-context **4.8.2** |
| Screen mgmt | react-native-screens **3.29.0** |
| JS engine | Hermes (enabled) |
| Build system | Gradle **8.6** + Android Gradle Plugin **8.x** |
| Kotlin | **1.9.22** (DO NOT upgrade to 2.x — breaks AsyncStorage 1.23.1) |
| Java | Temurin JDK **17** (at `/Library/Java/JavaVirtualMachines/temurin-17.jdk`) |
| Android target | API **34** (Android 14) |
| Android min | API **26** (Android 8) |
| NDK | **25.1.8937393** |
| Package name | `com.sentinelpay` |
| App name | `SentinelPay` |

### Backend
| What | Value |
|------|-------|
| Framework | FastAPI **0.115.0** |
| Python | **3.13** via venv at `/Users/siddharthreddy/Desktop/upi/venv/` |
| ML | LightGBM **4.5.0** + scikit-learn **1.5.2** (Isolation Forest) |
| Explainability | SHAP **0.46.0** |
| Graph | NetworkX **3.2.1** |
| Database | PostgreSQL **16.14** (Docker) |
| Cache | Redis (Docker) |
| ORM | SQLAlchemy **2.0.35** + psycopg **3.2.4** (async) |
| Models on disk | `backend/app/ml_models/lgbm_model.pkl`, `iso_forest_model.pkl`, `shap_explainer.pkl`, `feature_cols.pkl` |

---

## 4. RUNNING STATE (as of July 21, 2026)

### What is currently running
- **PostgreSQL 16 & Redis** → Running inside Docker containers
- **FraudShield backend** → `http://localhost:8000` — manually started via root virtualenv: `/Users/siddharthreddy/Desktop/upi/venv/bin/python run.py` (with auto-reload)
- **Android emulator** → AVD name: `SentinelPay_Pixel6`, API 34, arm64-v8a — must be manually started
- **Metro bundler** → `localhost:8081` — must be manually started

### Backend health (verified)
All 8 components UP: `api_gateway`, `redis_cluster`, `postgresql`, `ml_inference` (LightGBM loaded), `rule_engine` (10 rules), `behavior_engine`, `graph_engine`, `kafka`

### API test results
- **13/13 tests passing (100%) 🎉**
- Average latency: **~6ms**

---

## 5. HOW TO START EVERYTHING

```bash
# ── Step 1: Backend services (Docker containers) ──────────────────────────────
docker ps | grep -E "postgres|redis"
# If not running:
docker compose up -d

# ── Step 2: FraudShield backend ───────────────────────────────────────────────
cd /Users/siddharthreddy/Desktop/upi/backend
/Users/siddharthreddy/Desktop/upi/venv/bin/python run.py
# Runs at http://localhost:8000 — verify: curl http://localhost:8000/api/v1/health

# ── Step 3: Android emulator ──────────────────────────────────────────────────
export ANDROID_HOME=$HOME/Library/Android/sdk
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
$ANDROID_HOME/emulator/emulator -avd SentinelPay_Pixel6 -no-snapshot-load -no-audio &
# Wait ~30s for boot, then:
$ANDROID_HOME/platform-tools/adb devices  # should show emulator-5554

# ── Step 4: Port forward (CRITICAL — do this every time emulator starts) ──────
$ANDROID_HOME/platform-tools/adb -s emulator-5554 reverse tcp:8081 tcp:8081

# ── Step 5: Metro bundler ─────────────────────────────────────────────────────
cd /Users/siddharthreddy/Desktop/upi/SentinelPayApp
npx react-native start

# ── Step 6: Build and run app (first time or after native changes) ────────────
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
npx react-native run-android --deviceId emulator-5554 --no-packager

# ── Step 7: Reload only (JS changes, no native changes) ──────────────────────
# Press 'r' in Metro terminal, OR:
$ANDROID_HOME/platform-tools/adb -s emulator-5554 shell input keyevent 82
# Then select "Reload" in dev menu
```

---

## 6. BACKEND — KEY FACTS

### Credentials (hardcoded for demo)
```
PostgreSQL:
  host:     localhost:5432
  database: fraudshield
  user:     fraudshield
  password: fraudshield_dev

Redis:
  url: redis://localhost:6379/0

API Keys (any of these work in X-API-Key header):
  fs_demo_key_001   ← used by mobile app
  fs_demo_key_002
  fs_hackathon_key
```

### Scoring thresholds (from config.py)
```
THRESHOLD_APPROVE = 0.35   → risk_score < 0.35 = APPROVE
THRESHOLD_REJECT  = 0.75   → risk_score > 0.75 = REJECT
                             0.35–0.75 = REVIEW
```

### Score aggregation weights (from config.py)
```
WEIGHT_ML       = 0.45
WEIGHT_RULES    = 0.25
WEIGHT_BEHAVIOR = 0.20
WEIGHT_GRAPH    = 0.10
```

### API endpoints
```
GET  /api/v1/health              → system health (no auth required)
GET  /                           → root info (no auth)
POST /api/v1/score               → fraud score a transaction
GET  /api/v1/risk/{txn_id}       → fetch stored risk for a txn (fixed 404 bug)
GET  /api/v1/analytics           → stats (period=24h|7d|30d)
GET  /api/v1/model               → model metadata
POST /api/v1/feedback            → analyst feedback on decision (fixed VARCHAR bug)
GET  /api/v1/qr/trust/{vpa}      → trust score check for VPA (new endpoint)
```

---

## 7. MOBILE APP — KEY FACTS

### Navigation (App.tsx)
6 screens in a native stack. `initialRouteName="Home"`.
```
Home               → HomeScreen.tsx
SendMoney          → SendMoneyScreen.tsx  (params: prefillVpa?, prefillAmount?)
TransactionHistory → TransactionHistoryScreen.tsx
TransactionDetail  → TransactionDetailScreen.tsx  (params: txnId: string)
ReceiveMoney       → ReceiveMoneyScreen.tsx
ScanQR             → ScanQRScreen.tsx  (headerShown: false)
```
Header theme: `backgroundColor: '#6366f1'` (indigo), white text.

### Wallet storage (walletDb.ts)
Uses AsyncStorage with 2 keys:
- `sentinelpay_user` → JSON of `WalletUser` (`{id, name, vpa, balance, created_at}`)
- `sentinelpay_transactions` → JSON array of `WalletTransaction[]` (newest first)

Default user on first launch:
```
name: 'Demo User'
vpa:   demo@sentinelpay
balance: 100000  (₹1,00,000 SPC)
```

### API service (fraudShieldApi.ts)
```
Base URL: http://10.0.2.2:8000/api/v1
API Key header: X-API-Key: fs_demo_key_001
Timeout: 8000ms
```
`10.0.2.2` is how Android emulator reaches the host machine's localhost.

### SendMoney flow (SendMoneyScreen.tsx)
```
FORM → user enters receiver VPA + amount
  ↓ live trust check shows badge (VERIFIED/CAUTION/FLAGGED)
  ↓ tap "Check & Pay"
SCORING → calls fraudShieldApi.scoreTransaction()
  ↓ result
RESULT → shows FraudExplanationCard + signals grid
  ├── APPROVE → biometric gate prompt → executePayment() → SUCCESS
  ├── REVIEW  → amber warning + 5s cooldown timer + biometric gate prompt → executePayment() → SUCCESS
  └── REJECT  → red banner + "Back to Wallet" only → BLOCKED (no payment executed)
```

---

## 8. WHAT IS BUILT

### Screens — all complete and wired
| Screen | File | Status |
|--------|------|--------|
| Wallet dashboard | HomeScreen.tsx | ✅ Full — balance, simulated badge, recent txns, backend health dot |
| Send money + fraud | SendMoneyScreen.tsx | ✅ Full — VPA input, live trust badge, scoring, SMS+Call warnings, biometrics gate |
| Transaction list | TransactionHistoryScreen.tsx | ✅ Full — FlatList, stats bar, RiskBadge per row |
| Transaction detail | TransactionDetailScreen.tsx | ✅ Full — all signals, fraud explanation |
| Receive money | ReceiveMoneyScreen.tsx | ✅ Full — QR generator, share VPA |
| Scan QR | ScanQRScreen.tsx | ✅ Full — vision-camera scan & parse, pre-fills SendMoney |

### Hooks — complete
| Hook | File | What it does |
|------|------|-------------|
| useSmsOtp | hooks/useSmsOtp.ts | Handles READ/RECEIVE permissions, registers SMS BroadcastReceiver, runs OTP regex, keeps 60s flag |
| useCallState | hooks/useCallState.ts | Handles READ_PHONE_STATE permission, calls immediate check + registers phone state listener |

---

## 9. WHAT IS NOT BUILT YET (remaining work)
1. **Gradle Build Native Module Linking**: Must run `npx react-native run-android` to compile and link the new `SmsReceiverModule.java` and `CallStateModule.java` files into the APK binary.
2. **Phase 7.2 Device Fingerprinting**: Gathering hardware parameters and passing to device payload.
3. **Phase 8.1.5 Onboarding screen**: Disclosure of the simulated environment to the user.
4. **Phase 8.3 Release APK build**: `./gradlew assembleRelease` setup.

---

## 10. CRITICAL GOTCHAS (things that broke before — don't repeat)

| # | Gotcha | What happened | Fix that worked |
|---|--------|---------------|-----------------|
| 1 | AsyncStorage version | Versions ≥ 2.0 require Kotlin 2.1 which breaks RN 0.73 ecosystem | Pin to **1.23.1** forever |
| 2 | settings.gradle method call | `applyNativeModulesSettingsGradle(this)` fails | Must be `applyNativeModulesSettingsGradle(settings)` |
| 3 | Java version | System Java 8 breaks sdkmanager and Gradle | Always set `JAVA_HOME=$(/usr/libexec/java_home -v 17)` before any gradle/RN commands |
| 4 | Android cleartext HTTP | Android 9+ blocks plain HTTP — app showed blank screen | Added `network_security_config.xml` + `android:networkSecurityConfig` in manifest |
| 5 | Metro not found | App crashed "unable to load script" | Must run `adb reverse tcp:8081 tcp:8081` every time emulator starts |
| 6 | LightGBM crash on start | Missing system library | `brew install libomp` |
| 7 | VARCHAR(8) in feedback | Database constraint error when marking feedback LEGITIMATE | Altered column type to `VARCHAR(16)` in postgres & schema.sql |
| 8 | catch Exception in risk.py | Blocked 404 from propagating and returned 500 | Added `except HTTPException: raise` |

---

*End of context document.*
