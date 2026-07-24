# SentinelPay — AI Handoff Context & Technical Documentation

**Last Updated:** July 25, 2026 (03:02 AM)  
**Status:** ✅ 100% COMPLETE — Production-Ready Demonstration Platform & Compiled Release APK  
**Compiled Release APK:** `/Users/pranaykadam/Desktop/SentinelPay-v1.0.apk` (`84 MB`)  
**QA Test Suite Pass Rate:** `17/17 (100%) PASSED` (`backend/exhaustive_user_flow_qa.py`)  
**TypeScript Verification:** `0 Errors` (`npx tsc --noEmit`)

---

## 0. EXECUTIVE SUMMARY & HANDOFF READINESS

SentinelPay is a modern, enterprise-grade Android UPI Wallet demonstration platform backed by a real-time AI fraud detection engine (**FraudShield AI**), a multi-user PostgreSQL/Redis backend, WebSocket infrastructure, and a Truecaller-style real-time notification engine.

Every feature operates end-to-end between real registered users:
- **Phone Registration & Onboarding**: Phone number mandatory (`phone`), Full Name (`name`), optional Email. Duplicate phone numbers are strictly blocked (`"This phone number is already registered."`). Sandbox 6-digit OTP verification required. Unique VPA auto-generated as `<phone_number_without_plus>@sentinelpay`.
- **Guardian Supervisor Flow**: Account owner (User 1) invites Guardian (User 2) via phone. System generates random 6-digit OTP. User 1 verifies OTP to activate link. Guardian configures cumulative spending limit (e.g. ₹5,000) and approval timeout. Small transactions within limit settle instantly; transactions exceeding limit block and trigger real-time WebSocket approval requests to Guardian.
- **Truecaller-Style Notification Banner**: Floating top-of-screen heads-up alert banner (`HeadsUpNotificationBanner.tsx`) with spring animations, haptic vibration, and real-time WebSocket integration.
- **Sub-Engine Risk Breakdown**: FraudShield AI returns composite risk score + sub-scores (`ML Score`, `Rule Score`, `Device Risk`, `Velocity`), displayed on `SendMoneyScreen.tsx`.
- **Enterprise UX Polish**: Real-time reference IDs (`SP250726X91M84`), 1.5–2s progress pipeline, Smart Activity Timeline, AI Risk History, Device Trust (94%), and Admin Operations Analytics Dashboard.

---

## 1. REPOSITORY STRUCTURE

```
/Users/pranaykadam/Desktop/upi/
├── CONTEXT.md                          ← THIS FILE (Complete AI Handoff Context)
├── COMPLETE_PROJECT_STATUS.md          ← Project feature checklist & audit logs
├── deploy.md                           ← Deployment & build guide
├── docker-compose.yml                  ← PostgreSQL 16 + Redis 7 Docker services
├── SentinelPayApp/                     ← React Native Android wallet app (bare workflow)
│   ├── android/                        ← Android native project (Gradle 8.6, Java 17)
│   │   └── app/build/outputs/apk/release/app-release.apk
│   ├── src/
│   │   ├── App.tsx                     ← Root navigator + WebSocket listener + HeadsUpBanner
│   │   ├── types/index.ts              ← TypeScript domain interfaces
│   │   ├── services/
│   │   │   ├── authService.ts          ← Axios API client (API_KEY: fs_demo_key_001)
│   │   │   ├── unifiedAuthService.ts   ← JWT session & profile management
│   │   │   ├── notificationService.ts  ← Storage + remote cloud sync + event emitter
│   │   │   ├── guardianService.ts      ← WebSocket manager + HTTP fallback polling
│   │   │   └── fraudShieldApi.ts       ← Scoring & QR trust endpoints
│   │   ├── components/
│   │   │   ├── HeadsUpNotificationBanner.tsx ← Truecaller-style top notification banner
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── FraudExplanationCard.tsx
│   │   │   ├── PanicButton.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── AppIcon.tsx             ← SVG icons
│   │   └── screens/
│   │       ├── HomeScreen.tsx          ← Wallet balance & security dashboard
│   │       ├── SendMoneyScreen.tsx     ← Payment form, pipeline, fraud card, sub-scores
│   │       ├── NotificationsScreen.tsx  ← Smart Notification Center feed
│   │       ├── GuardianManagementScreen.tsx ← Guardian OTP link & limit config
│   │       ├── GuardianApprovalScreen.tsx   ← Real-time incoming/outgoing approvals
│   │       ├── TransactionHistoryScreen.tsx
│   │       ├── TransactionDetailScreen.tsx  ← Smart activity timeline
│   │       ├── ReceiveMoneyScreen.tsx
│   │       ├── ScanQRScreen.tsx
│   │       ├── RegisterScreen.tsx & LoginScreen.tsx
│   │       ├── PinSetupScreen.tsx & PinLoginScreen.tsx
│   │       ├── BiometricSetupScreen.tsx
│   │       ├── AiRiskHistoryScreen.tsx
│   │       ├── DeviceTrustScreen.tsx
│   │       └── AdminAnalyticsDashboardScreen.tsx
│   └── package.json
└── backend/                            ← FraudShield FastAPI backend
    ├── app/
    │   ├── main.py                     ← FastAPI entry point & router mounts
    │   ├── config.py                   ← API_KEYS="fs_demo_key_001,..."
    │   ├── api/v1/
    │   │   ├── auth.py                 ← Register, Send-OTP, Verify-OTP, Reset-Password
    │   │   ├── transfer.py             ← Multi-user P2P settlement engine & WS push
    │   │   ├── guardian.py             ← Guardian linking, limit config, approval requests
    │   │   ├── score.py                ← Real-time fraud scoring endpoint (/api/v1/score)
    │   │   ├── qr_trust.py             ← QR Trust VPA lookup (/api/v1/qr/trust/{vpa})
    │   │   ├── community.py            ← Scam reports (/api/v1/community/report)
    │   │   ├── heatmap.py              ← Scam heatmap (/api/v1/heatmap)
    │   │   └── notifications.py        ← Notification feed (/api/v1/notifications/list)
    │   ├── core/scoring_engine.py      ← Scoring orchestrator & signal aggregation
    │   ├── engines/                    ← ml_engine.py (with fallback), rule_engine.py, etc.
    │   └── models/scoring_result.py    ← Pydantic schemas (Signals & ScoringResponse)
    ├── exhaustive_user_flow_qa.py      ← 17-flow automated test suite (100% PASS)
    └── venv/                           ← Python 3.11 virtualenv
```

---

## 2. BACKEND API SPECIFICATIONS & ROUTE MAPPING

All API endpoints require header `X-API-Key: fs_demo_key_001` or Bearer JWT token in `Authorization`.

| Method | Endpoint | Request Payload / Params | Description |
|--------|----------|--------------------------|-------------|
| `POST` | `/api/v1/auth/register` | `{"name", "phone", "email", "password"}` | Register new account. Auto-generates `<phone>@sentinelpay` VPA. Blocks duplicate phones with 400. |
| `POST` | `/api/v1/auth/send-otp` | `{"phone", "purpose"}` | Generate 6-digit sandbox OTP (`REGISTRATION`, `PASSWORD_RESET`, `LOGIN`). |
| `POST` | `/api/v1/auth/verify-otp` | `{"phone", "otp_code"}` | Verify OTP code. |
| `POST` | `/api/v1/auth/reset-password` | `{"phone", "otp_code", "new_password"}` | Reset account password using verified OTP. |
| `POST` | `/api/v1/score` | `TransactionRequest` | Submit transaction for real-time fraud scoring. Returns composite risk score, decision, explanation, and signals. |
| `POST` | `/api/v1/transfer` | `P2PTransferRequest` | Execute multi-user P2P transfer. Scores transaction, checks guardian limits, updates PostgreSQL balances, dispatches WebSocket alerts. |
| `POST` | `/api/v1/guardian/add` | `{"phone", "name"}` | Invite a user as Guardian. Generates 6-digit verification code. |
| `POST` | `/api/v1/guardian/verify-code` | `{"relationship_id", "code"}` | Verify 6-digit OTP code to activate Guardian link. |
| `POST` | `/api/v1/guardian/set-ward-config` | `{"ward_vpa", "ward_phone", "limit", "timeout_minutes"}` | Guardian configures ward spending limit & approval timeout. |
| `GET` | `/api/v1/guardian/get-limit` | `Header: Bearer Token` | Query ward cumulative spent and remaining limit. |
| `POST` | `/api/v1/guardian/request-approval` | `{"transaction_id", "amount", "recipient_vpa", "fraud_score", "risk_signals"}` | Request guardian approval for limit-exceeded transaction. |
| `POST` | `/api/v1/guardian/respond` | `{"request_id", "decision", "note"}` | Guardian approves or rejects pending transaction approval request. |
| `GET` | `/api/v1/qr/trust/{vpa}` | Path param `vpa` | Query VPA trust level (`VERIFIED`, `CAUTION`, `FLAGGED`). |
| `POST` | `/api/v1/community/report` | `ReportRequest` | Submit community scam threat report. |
| `GET` | `/api/v1/heatmap` | None | Query live threat wave alert hotspots. |
| `GET` | `/api/v1/notifications/list` | Query param `user_key` | Query persistent notification feed for user. |
| `WS` | `/api/v1/guardian/ws?token=<JWT>` | WebSocket connection | Real-time push channel for payment received & approval events. |

---

## 3. KEY CREDENTIALS & INFRASTRUCTURE CONFIGURATION

### Backend Credentials
- **PostgreSQL**: `postgresql+psycopg://fraudshield:fraudshield_dev@localhost:5432/fraudshield`
- **Redis**: `redis://localhost:6379/0`
- **Valid API Keys**: `fs_demo_key_001`, `fs_demo_key_002`, `fs_hackathon_key`

### Mobile App Build Dependencies
- **React Native**: `0.73.6` (bare workflow)
- **AsyncStorage**: `1.23.1` (pinned)
- **Java**: Temurin JDK 17 (`/Library/Java/JavaVirtualMachines/temurin-17.jdk`)
- **Gradle**: `8.6`
- **Android Target API**: `34` (Android 14)

---

## 4. HOW TO RUN & VERIFY EVERYTHING

```bash
# 1. Verify Docker Services (PostgreSQL & Redis)
docker ps | grep -E "postgres|redis"

# 2. Run Backend Server
cd /Users/pranaykadam/Desktop/upi/backend
PYTHONPATH=. venv/bin/python run.py

# 3. Run Automated QA Test Suite (17/17 Pass Verification)
cd /Users/pranaykadam/Desktop/upi/backend
PYTHONUNBUFFERED=1 PYTHONPATH=. venv/bin/python exhaustive_user_flow_qa.py

# 4. Verify Mobile App TypeScript Code
cd /Users/pranaykadam/Desktop/upi/SentinelPayApp
npx tsc --noEmit

# 5. Rebuild Release APK Binary
cd /Users/pranaykadam/Desktop/upi/SentinelPayApp/android
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ~/Desktop/SentinelPay-v1.0.apk
```

---

## 5. CRITICAL DESIGN & IMPLEMENTATION DECISIONS

1. **Fail-Safe Native Isolation**: Native push notification packages (`react-native-push-notification`) rely on Google Firebase (`google-services.json`). To prevent native startup crashes when Firebase is absent, native push calls are safely guarded and accompanied by an in-app **Truecaller-Style Heads-Up Notification Banner** (`HeadsUpNotificationBanner.tsx`).
2. **Sub-Engine Risk Breakdown**: `ScoringResponse` Pydantic model (`scoring_result.py`) and scoring orchestrator (`scoring_engine.py`) explicitly populate `ml_score`, `rule_score`, `behavior_score`, `graph_score`, `device_risk`, and `velocity_risk` in `signals`, ensuring `SendMoneyScreen.tsx` renders non-zero percentage cards.
3. **Resilient ML Engine Fallback**: In `ml_engine.py`, if LightGBM model files are absent on disk, a heuristic predictor evaluates transaction risk seamlessly without raising a `RuntimeError`.
4. **Deterministic Reference IDs**: Reference transaction IDs follow the standard `SP` + `DDMMYY` + `6 uppercase alphanumeric chars` format (e.g. `SP250726X91M84`).

---

*End of AI Handoff Context Document.*
