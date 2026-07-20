# SentinelPay — AI Handoff Context Document
**Last Updated:** July 20, 2026
**Purpose:** Complete factual context for the next AI agent to pick up this build without hallucination.
**Read this before touching any file.**

---

## 1. WHAT THIS PROJECT IS

A **React Native Android wallet app** called **SentinelPay** that simulates UPI payments with ₹1,00,000 of fake "SPC" (SentinelPay Credits). Every payment is scored in real-time by an existing AI fraud detection backend called **FraudShield**. The app is sideloaded as an APK — no Play Store.

**It is NOT a real payment app. All money is simulated.**

---

## 2. REPO STRUCTURE (absolute paths)

```
/Users/pranaykadam/Desktop/upi/
├── CONTEXT.md                          ← THIS FILE
├── SENTINELPAY_BUILD_TRACKER.md        ← Live task tracker
├── SentinelPayApp/                     ← React Native mobile app
│   ├── android/                        ← Android native project
│   ├── src/                            ← All TypeScript/React source
│   │   ├── App.tsx
│   │   ├── types/index.ts
│   │   ├── services/fraudShieldApi.ts
│   │   ├── utils/walletDb.ts
│   │   ├── components/
│   │   │   ├── RiskBadge.tsx
│   │   │   └── FraudExplanationCard.tsx
│   │   └── screens/
│   │       ├── HomeScreen.tsx
│   │       ├── SendMoneyScreen.tsx
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
│   │   ├── api/v1/                     ← score, risk, health, analytics, feedback, model
│   │   ├── core/scoring_engine.py      ← Main orchestrator
│   │   ├── engines/                    ← ml, rule, behavioral, graph, xai
│   │   ├── ml_models/                  ← lgbm_model.pkl, iso_forest_model.pkl, shap_explainer.pkl
│   │   ├── db/                         ← schema.sql, init_db.py, seed_demo.py
│   │   └── services/                   ← redis_service.py, auth_service.py
│   ├── requirements.txt
│   ├── run.py                          ← uvicorn entry point
│   └── run_api_tests.py
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
| Biometrics | react-native-biometrics **3.0.1** (installed, NOT yet wired) |
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
| Python | **3.11** via venv at `/Users/pranaykadam/Desktop/upi/backend/venv/` |
| ML | LightGBM **4.5.0** + scikit-learn **1.5.2** (Isolation Forest) |
| Explainability | SHAP **0.46.0** |
| Graph | NetworkX **3.2.1** |
| Database | PostgreSQL **16.14** (Homebrew, auto-start) |
| Cache | Redis **8.8.0** (Homebrew, auto-start) |
| ORM | SQLAlchemy **2.0.35** + psycopg **3.2.4** (async) |
| Models on disk | `backend/app/ml_models/lgbm_model.pkl`, `iso_forest_model.pkl`, `shap_explainer.pkl`, `feature_cols.pkl` |


---

## 4. RUNNING STATE (as of July 20, 2026)

### What is currently running
- **PostgreSQL 16** → `localhost:5432` — Homebrew auto-start service
- **Redis 8** → `localhost:6379` — Homebrew auto-start service
- **FraudShield backend** → `http://localhost:8000` — must be manually started
- **Android emulator** → AVD name: `SentinelPay_Pixel6`, API 34, arm64-v8a — must be manually started
- **Metro bundler** → `localhost:8081` — must be manually started

### Backend health (verified)
All 8 components UP: `api_gateway`, `redis_cluster`, `postgresql`, `ml_inference` (LightGBM loaded), `rule_engine` (10 rules), `behavior_engine`, `graph_engine`, `kafka`

### API test results (last run July 19, 2026)
- 16/17 tests passing (94.1%)
- Average latency: **3.3ms**
- 1 "failure" is a stale test expectation: feedback endpoint correctly returns 404 (not 500) when transaction not found — this is correct behavior, the test expected 500 from when DB was down

---

## 5. HOW TO START EVERYTHING

```bash
# ── Step 1: Backend services (usually auto-start, verify first) ──────────────
brew services list | grep -E "postgresql|redis"
# If not running:
brew services start postgresql@16
brew services start redis

# ── Step 2: FraudShield backend ───────────────────────────────────────────────
cd /Users/pranaykadam/Desktop/upi/backend
venv/bin/python run.py
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
cd /Users/pranaykadam/Desktop/upi/SentinelPayApp
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
GET  /api/v1/risk/{txn_id}       → fetch stored risk for a txn
GET  /api/v1/analytics           → stats (period=24h|7d|30d)
GET  /api/v1/model               → model metadata
POST /api/v1/feedback            → analyst feedback on decision
```

### POST /api/v1/score — exact required payload
```json
{
  "transaction_id": "TXN_UNIQUE_001",
  "sender_vpa": "alice@okicici",
  "receiver_vpa": "merchant@okaxis",
  "amount": 4500.0,
  "currency": "INR",
  "transaction_type": "P2P",
  "device": {
    "device_id": "DEV_ABC123",
    "os_type": "ANDROID",
    "is_rooted": false,
    "is_emulator": false
  },
  "location": { "latitude": 19.076, "longitude": 72.877 },
  "network": { "ip_address": "103.21.58.200", "connection_type": "4G" },
  "metadata": { "org_id": "ORG_DEMO_001", "channel": "mobile_app" }
}
```
**Constraints:** amount must be > 0 and ≤ 200,000. VPA must contain @. currency must be "INR".

### POST /api/v1/score — response shape
```json
{
  "transaction_id": "...",
  "risk_score": 0.12,
  "decision": "APPROVE",
  "signals": {
    "rule_flags": [],
    "behavioral_deviation": 0.05,
    "graph_risk": 0.02,
    "device_risk": 0.0
  },
  "explanation": {
    "nl_summary": "Transaction looks normal...",
    "reasons": [...],
    "top_features": [...]
  },
  "latency_ms": 8
}
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
vpa:  'demo@sentinelpay'
balance: 100000  (₹1,00,000 SPC)
```

Payment execution logic:
1. `executePayment(receiverVpa, amount, riskScore, decision, fraudReason)`
2. Returns `{success: false}` if: amount ≤ 0, amount > balance, or decision === 'REJECT'
3. On success: deducts from balance, stores WalletTransaction with status APPROVED or REVIEW
4. Transaction ID format: `TXN_${Date.now()}_${6-char-random}`

### API service (fraudShieldApi.ts)
```
Base URL: http://10.0.2.2:8000/api/v1
API Key header: X-API-Key: fs_demo_key_001
Timeout: 8000ms
```
`10.0.2.2` is how Android emulator reaches the host machine's localhost.
For **real device on WiFi**, change to laptop's LAN IP e.g. `192.168.1.x`.
For **VPS deployment**, change to full public URL.

### SendMoney flow (SendMoneyScreen.tsx)
```
FORM → user enters receiver VPA + amount
  ↓ tap "Check & Pay"
SCORING → calls fraudShieldApi.scoreTransaction()
  ↓ result
RESULT → shows FraudExplanationCard + signals grid
  ├── APPROVE → green "Confirm Payment" button → executePayment() → SUCCESS
  ├── REVIEW  → amber warning + 5s cooldown timer → "Proceed Anyway" button → executePayment() → SUCCESS
  └── REJECT  → red banner + "Back to Wallet" only → BLOCKED (no payment executed)
```

### Android-specific configs
```
Package name:        com.sentinelpay
Application ID:      com.sentinelpay
Min SDK:             26
Target SDK:          34
NDK:                 25.1.8937393
Kotlin:              1.9.22
New Architecture:    DISABLED (IS_NEW_ARCHITECTURE_ENABLED = false)
Hermes:              ENABLED  (IS_HERMES_ENABLED = true)
Network security:    android/app/src/main/res/xml/network_security_config.xml
                     → allows cleartext to 10.0.2.2, localhost, 127.0.0.1
Debug keystore:      android/app/debug.keystore (password: android, alias: androiddebugkey)
```

### Critical gradle facts
- `settings.gradle` uses `applyNativeModulesSettingsGradle(settings)` — NOT `this`
- `app/build.gradle` ends with `applyNativeModulesAppBuildGradle(project)`
- Root `build.gradle` uses `apply plugin: "com.facebook.react.rootproject"` — NOT an allprojects block
- Gradle wrapper: 8.6 (at `android/gradle/wrapper/gradle-wrapper.properties`)
- Java required: **17** — Java 8 (system default) will break the build


---

## 8. WHAT IS BUILT (do NOT rebuild these)

### Screens — all complete and wired
| Screen | File | Status |
|--------|------|--------|
| Wallet dashboard | HomeScreen.tsx | ✅ Full — balance, simulated badge, recent txns, backend health dot, quick actions |
| Send money + fraud | SendMoneyScreen.tsx | ✅ Full — VPA input, scoring, APPROVE/REVIEW/REJECT, cooldown, explanation card |
| Transaction list | TransactionHistoryScreen.tsx | ✅ Full — FlatList, stats bar, RiskBadge per row |
| Transaction detail | TransactionDetailScreen.tsx | ✅ Full — all signals, fraud explanation |
| Receive money | ReceiveMoneyScreen.tsx | ✅ Full — QR generator (react-native-qrcode-svg), share VPA |
| Scan QR | ScanQRScreen.tsx | ✅ Full — vision-camera, UPI QR parser, pre-fills SendMoney |

### Components — all complete
| Component | File | What it does |
|-----------|------|-------------|
| RiskBadge | components/RiskBadge.tsx | Colour pill: green APPROVE / amber REVIEW / red REJECT + risk % |
| FraudExplanationCard | components/FraudExplanationCard.tsx | AI summary, top factors, visual score bar |

### Types — all defined in src/types/index.ts
`RootStackParamList`, `WalletUser`, `WalletTransaction`, `TransactionRequest`, `FraudScore`, `FraudSignals`, `FraudExplanation`, `DeviceInfo`, `LocationInfo`, `NetworkInfo`

---

## 9. WHAT IS NOT BUILT YET (the remaining work)

### Phase 4 — SMS Intelligence (HIGHEST PRIORITY per PRD)
Needs 2 new Java files + TypeScript integration:

**4.1 — Java native bridge (create these files):**
```
android/app/src/main/java/com/sentinelpay/SmsReceiverModule.java
android/app/src/main/java/com/sentinelpay/SmsReceiverPackage.java
```
- `SmsReceiverModule` extends `ReactContextBaseJavaModule`
- Register a `BroadcastReceiver` for `android.provider.Telephony.SMS_RECEIVED`
- Extract sender, body, timestamp
- Emit to JS via `reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("onSmsReceived", params)`
- After creating, add to `MainApplication.kt` packages list

**4.2 — OTP detection (TypeScript):**
- Regex: `/\b\d{4,8}\b/` on SMS body
- Store OTP timestamp in AsyncStorage key `sentinelpay_last_otp_at`
- In `SendMoneyScreen.tsx`, check if `Date.now() - lastOtpAt < 60000`
- Pass `otp_in_last_60s: true` in `metadata` field of `/score` payload

**4.3 — TFLite SMS classifier (deferred, lower priority):**
- Model not yet trained
- Dependency: `react-native-fast-tflite` (not yet installed)

### Phase 5 — Call Detection
**Java native bridge (create these files):**
```
android/app/src/main/java/com/sentinelpay/CallStateModule.java
android/app/src/main/java/com/sentinelpay/CallStatePackage.java
```
- Use `TelephonyManager.listen(PhoneStateListener, LISTEN_CALL_STATE)`
- Detect `CALL_STATE_OFFHOOK` (active call)
- Emit to JS via `DeviceEventEmitter`
- In `SendMoneyScreen.tsx`, subscribe and show warning banner if call active
- Pass `is_call_active: true` in device object of `/score` payload

### Phase 6 — QR Trust API (backend extension)
- Add endpoint `GET /api/v1/qr/trust/{vpa}` to FraudShield backend
- Return trust score + flags
- Show trust badge in SendMoneyScreen before confirmation

### Phase 7 — Biometric Auth
- Library `react-native-biometrics` is **already installed** in package.json
- Just needs to be wired in
- Import `ReactNativeBiometrics` from `react-native-biometrics`
- Call `rnBiometrics.simplePrompt({promptMessage: 'Confirm payment'})` in SendMoneyScreen
- Replace or augment the cooldown timer on REVIEW decisions with biometric challenge

### Phase 8 — Release APK
```bash
cd /Users/pranaykadam/Desktop/upi/SentinelPayApp/android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```
Release build currently uses debug keystore (acceptable for demo sideloading).


---

## 10. CRITICAL GOTCHAS (things that broke before — don't repeat)

| # | Gotcha | What happened | Fix that worked |
|---|--------|---------------|-----------------|
| 1 | AsyncStorage version | Versions ≥ 2.0 require Kotlin 2.1 which breaks RN 0.73 ecosystem | Pin to **1.23.1** forever |
| 2 | settings.gradle method call | `applyNativeModulesSettingsGradle(this)` fails | Must be `applyNativeModulesSettingsGradle(settings)` |
| 3 | Java version | System Java 8 breaks sdkmanager and Gradle | Always set `JAVA_HOME=$(/usr/libexec/java_home -v 17)` before any gradle/RN commands |
| 4 | Android cleartext HTTP | Android 9+ blocks plain HTTP — app showed blank screen | Added `network_security_config.xml` + `android:networkSecurityConfig` in manifest |
| 5 | Metro not found | App crashed "unable to load script" | Must run `adb reverse tcp:8081 tcp:8081` every time emulator starts |
| 6 | Metro config missing | Metro refused to start | Copy `metro.config.js` + `babel.config.js` from RN template — both exist now |
| 7 | react-native-svg version | Newer svg broke with RN 0.73 RenderableViewManager API | Pin to **14.1.0** |
| 8 | react-native-screens version | Same — BaseReactPackage not found | Pin to **3.29.0** |
| 9 | LightGBM crash on start | Missing system library | `brew install libomp` |
| 10 | Python 3.14 + ML deps | shap, networkx version constraints fail on 3.14 | Use Python **3.11** venv only |
| 11 | Gradle wrapper missing | Copied manually from `node_modules/react-native/template/android/` | Already done — `android/gradle/wrapper/` exists |
| 12 | Root build.gradle `allprojects` block | Older pattern causes "duplicate repositories" with RN 0.73 plugin | Use `apply plugin: "com.facebook.react.rootproject"` instead |
| 13 | `MainApplication.kt` load() call | Was called inside `!IS_NEW_ARCHITECTURE_ENABLED` (wrong) | Only call `load()` when `IS_NEW_ARCHITECTURE_ENABLED = true` |

---

## 11. ENVIRONMENT VARIABLES NEEDED

Add these to `~/.zshrc` (already done, but include in any new terminal):
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## 12. ADDING A NATIVE JAVA MODULE (pattern to follow for SMS/Call)

When you create `SmsReceiverModule.java` or `CallStateModule.java`, this is the exact wiring pattern for RN 0.73 bare workflow:

**Step 1** — Create `MyModule.java` + `MyPackage.java` in `android/app/src/main/java/com/sentinelpay/`

**Step 2** — In `MainApplication.kt`, the `PackageList(this).packages` auto-links most things. For manual packages, add inside the `.apply { }` block:
```kotlin
PackageList(this).packages.apply {
    add(SmsReceiverPackage())
    add(CallStatePackage())
}
```

**Step 3** — After adding native files, you MUST run a full rebuild (not just Metro reload):
```bash
npx react-native run-android --deviceId emulator-5554 --no-packager
```

**Step 4** — In TypeScript, listen to native events:
```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';
const emitter = new NativeEventEmitter(NativeModules.SmsReceiverModule);
const sub = emitter.addListener('onSmsReceived', (data) => { ... });
// cleanup: sub.remove();
```

---

## 13. PROGRESS SUMMARY

```
Phase 1 — Foundation       ████████████ 100%  ✅ DONE
Phase 2 — Wallet           ████████████ 100%  ✅ DONE
Phase 3 — Payment + Fraud  ████████████ 100%  ✅ DONE
Phase 6 — QR               ██████████░░  90%  ✅ scan+gen done, trust API pending
Phase 4 — SMS Intelligence ░░░░░░░░░░░░   0%  ← START HERE
Phase 5 — Call Detection   ░░░░░░░░░░░░   0%
Phase 7 — Biometrics       ░░░░░░░░░░░░   0%  (lib installed, 1-2h to wire)
Phase 8 — Release APK      ██░░░░░░░░░░  10%  (one gradle command away)

Overall: ~42% complete (28/68 core tasks)
```

The recommended next task is **Phase 4.1** — `SmsReceiverModule.java` — as it's the highest-value feature per the PRD and the remaining foundation (permissions in manifest, Java bridge pattern) is already in place.


---

## 14. QUICK VERIFICATION COMMANDS

Run these to confirm everything is healthy before starting work:

```bash
# 1. Backend alive?
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool | grep status

# 2. Emulator connected?
$HOME/Library/Android/sdk/platform-tools/adb devices

# 3. Metro running?
lsof -i :8081 | grep LISTEN

# 4. PostgreSQL alive?
/opt/homebrew/bin/psql -U fraudshield -d fraudshield -c "SELECT 1;"

# 5. Redis alive?
/opt/homebrew/bin/redis-cli ping

# 6. Run full API test suite
cd /Users/pranaykadam/Desktop/upi/backend && venv/bin/python run_api_tests.py

# 7. List AVDs
$HOME/Library/Android/sdk/emulator/emulator -list-avds
# Expected output: SentinelPay_Pixel6
```

---

*End of context document. Do not modify this file — regenerate it from the build tracker when state changes.*
