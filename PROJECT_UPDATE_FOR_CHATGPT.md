# SentinelPay (UPI + AI Fraud Protection) — Complete Project Update for Gemini

> **Note for Gemini / AI Assistants:** This document contains a comprehensive, production-grade technical summary of the entire **SentinelPay** repository. Read this file to instantly understand the architecture, tech stack, unified UI design system, payment animation pipeline, Guardian workflow, backend endpoints, database schema, native Android modules, ML pipeline, cloud deployment, and current project status.

---

## 1. Project Overview & Context

**SentinelPay** is an AI-powered, enterprise-grade UPI Payment & Real-Time Fraud Prevention Application. It combines a **React Native (Android)** mobile client with a **FastAPI (Python)** scoring and backend engine.

### Key Objectives & Achievements:
1. **Mandatory Phone Authentication**: Primary key for all user accounts across devices is their **Phone Number**. Flow: Phone Login → Name/DOB → UPI PIN & Biometrics setup.
2. **Unified Design System (Apple Wallet / Revolut Standard)**:
   - Single source of truth design tokens in `src/theme/ds.ts` (`C`, `S`, `T`, `R`, `shadow`, `DS`).
   - Unified color palette: Deep Slate (`#0F172A`), Emerald (`#10B981`), Cobalt (`#2563EB`), Slate Surface (`#F8FAFC`).
   - 28 redesigned screens + 4 shared components inheriting exact visual language from `HomeScreen.tsx`.
   - Standardized 52dp input & button heights, 24dp global horizontal padding, and 120dp FAB bottom clearance.
3. **Interactive Payment Processing Animation (`UpiPinModal.tsx`)**:
   - Animated state machine (`ENTRY` → `PROCESSING` → `DONE`).
   - Dual-ring spinner with continuous `Easing.linear` rotation + 3 staggered bouncing dots + payee VPA & amount display + NPCI 256-bit SSL security badge.
   - Spring-animated green tick circle on payment authorization success.
4. **Real-Time SMS Fraud Tracker (Truecaller-Style)**:
   - On-device background SMS monitoring via native Android `SmsReceiverModule.java` and `spam_classifier.tflite` + rule fallback.
   - Pop-up push notifications with risk badges: **DANGEROUS**, **SUSPICIOUS**, or **LEGIT**.
5. **Guardian Approval & Threshold Gating System**:
   - Link trusted guardians via 6-digit OTP verification code.
   - Configure spending threshold (e.g. ₹5,000). Payments above threshold trigger real-time approval requests via WebSockets and 2s polling fallback.
   - Resolved `409 Conflict` retries, missing response codes, and UUID casting in backend `guardian.py`.
6. **Dynamic QR Code Engine & Dual Scanner**:
   - SVG UPI QR generator with custom preset amounts.
   - 1-tap social sharing (WhatsApp direct payment links).
   - Dual Camera & Gallery Photo QR reader backed by native Java `QrDecoderModule.java` (ZXing library).
7. **6-Engine Fraud Scoring Backend (FraudShield AI)**:
   - Concurrently processes transactions in <200ms using LightGBM, Isolation Forest, Rule DSL, Z-score Behavioral Engine, NetworkX Graph Analytics, and SHAP XAI explainability.
8. **Production Cloud Deployment (Render.com)**:
   - Live backend deployed at `https://upi-nd1p.onrender.com`.
   - Production Gunicorn start command with `--timeout 120 --keep-alive 5` to prevent startup worker timeouts during ML model initialization.

---

## 2. System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │             SentinelPay React Native App (Android)      │
   │                                                         │
   │  ┌───────────────────┐  ┌────────────────────────────┐  │
   │  │  UI Screens (TSX) │  │ Native Android Java        │  │
   │  │  - 28 Screens     │  │ - SmsReceiverModule        │  │
   │  │  - Unified DS     │  │ - SmsClassifier (TFLite)   │  │
   │  │  - UpiPinModal    │  │ - QrDecoderModule (ZXing)  │  │
   │  └─────────┬─────────┘  └──────────────┬─────────────┘  │
   └────────────┼───────────────────────────┼────────────────┘
                │ REST / WebSockets         │ Events / Native Bridge
                ▼                           ▼
   ┌─────────────────────────────────────────────────────────┐
   │               FastAPI Python Backend                    │
   │               (https://upi-nd1p.onrender.com)           │
   │                                                         │
   │  ┌───────────────────┐  ┌────────────────────────────┐  │
   │  │ REST & WS Routers │  │ 6-Engine Fraud Engine      │  │
   │  │ - Auth, P2P, QR   │  │ - LightGBM (45%)           │  │
   │  │ - Guardian, WS    │  │ - Rule Engine (25%)        │  │
   │  │ - SMS, Feedback   │  │ - Behavioral (20%)         │  │
   │  └─────────┬─────────┘  │ - Graph NetworkX (10%)     │  │
   │            │            │ - Isolation Forest         │  │
   │            │            │ - SHAP Explainer (XAI)     │  │
   │            │            └────────────────────────────┘  │
   │            └─────────────────────────────┐              │
   └──────────────────────────────────────────┼──────────────┘
                                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Persistent Layer: Supabase PostgreSQL + Redis (L1 Cache) │
   └─────────────────────────────────────────────────────────┘
```

### Technology Stack:
- **Mobile App**: React Native 0.74+, TypeScript, React Navigation v6, `Animated` API, `react-native-push-notification`, `react-native-vector-icons`, `react-native-svg-qrcode`.
- **Native Android Code**: Java (`SmsReceiverModule.java`, `SmsClassifier.java`, `SmsReaderModule.java`, `QrDecoderModule.java`), TensorFlow Lite NLClassifier, ZXing barcode decoder.
- **Backend API**: Python 3.11/3.13, FastAPI, Gunicorn (Uvicorn Workers), Pydantic v2, SQLAlchemy (Async `psycopg3`).
- **ML & Graph Infrastructure**: LightGBM, Scikit-learn (Isolation Forest), SHAP (TreeSHAP), NetworkX (Graph Analytics), NumPy, Pandas.
- **Database & Cache**: Supabase PostgreSQL, Redis (L1 feature cache and rate limiting).
- **Hosting**: Render.com Web Service (`upi-nd1p.onrender.com`).
- **Git Repository**: `https://github.com/SidReddy-24/upi.git` (`main` branch).

---

## 3. Detailed Breakdown of Key Modules

### A. Unified Design System (`src/theme/ds.ts`)
- **Single Source of Truth**: All 28 screens import tokens directly from `ds.ts`.
- **Spacing Grid**: 8-pt grid (`xs: 4`, `sm: 8`, `md: 12`, `base: 16`, `lg: 20`, `xl: 24`, `xxl: 32`).
- **Standard Heights**: Inputs and Buttons default to `52dp` height (`R.md` = 12).
- **Reusable Primitives**:
  - `metricGrid` & `metricCell`: 2×2 responsive analytics cards.
  - `segmentedBar` & `segmentTab`: Pill-shaped filter controls.
  - `emptyCard`, `emptyIcon`, `emptyTitle`, `emptySub`: High-polish empty state containers.
  - `PanicButton.tsx`: Floating action button fixed at `bottom: 100, right: 24` (56×56 Material FAB), preventing overlap with bottom tabs.

### B. Payment PIN & Processing Animation (`UpiPinModal.tsx`)
- **State Flow**: `ENTRY` → user enters 4-digit PIN → `PROCESSING` (2s delay with dual-ring spinner & 3 bouncing dots) → `DONE` (0.7s spring green tick circle) → `onSuccess()`.
- **UI Elements**: Prominent amount card (`₹X,XXX → payee@vpa`), NPCI 256-bit SSL security badge, and non-closable safe state.

### C. Guardian Approval & Synchronization Flow
- **Linking**: Ward enters guardian VPA/Phone → Backend `/guardian/add` generates 6-digit OTP code → Pushes `GUARDIAN_VERIFICATION_CODE` via WebSocket → Returns `verification_code` in JSON payload → Pre-filled in ward's verification modal.
- **Verification**: `/guardian/verify-code` casts ID safely as text (`id::text = %s`) → Status set to `ACTIVE` → Pushes `GUARDIAN_LINKED` event.
- **Threshold Gating**: Payment > Limit (`amount > guardianLimit`) triggers `/guardian/request-approval` → Payment pauses in `AWAITING_GUARDIAN_APPROVAL` → Guardian receives instant WS alert & approval feed item.
- **Resolution**:
  - If Guardian **Approves**: Status becomes `APPROVED`, `SendMoneyScreen` detects approval via 2s polling/WS, calls `finalizeApprovedPayment` **once**, and shows success.
  - If Guardian **Rejects**: Status becomes `REJECTED`, transaction cancelled, balance unchanged, ward notified with blocked warning notice.

### D. Real-Time SMS Fraud Tracker (Truecaller-Style)
- **Background Listener**: Native Java `SmsReceiverModule.java` intercepts incoming SMS.
- **Classification**: TFLite model `spam_classifier.tflite` scores text + bank whitelist check (HDFC, ICICI, SBI) + OTP detection.
- **Push Notification**: Fires system pop-up with DANGEROUS / SUSPICIOUS / LEGIT badges.
- **Tracker UI (`SmsTrackerScreen.tsx`)**: Descending timestamp order, filter tabs, manual re-scan, clear history.

### E. Dynamic QR Generator & Dual Scanner
- **Generator (`ReceiveMoneyScreen.tsx`)**: Generates clean SVG QR codes with custom embedded amounts.
- **Sharing**: 1-tap direct share via WhatsApp with formatted payment link payload.
- **Dual Scanner (`QRScannerScreen.tsx`)**: Live Camera Scanner + Gallery Photo Upload using native Java `QrDecoderModule.java` (ZXing).

---

## 4. Backend API Endpoints Reference

### Authentication Endpoints (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Register new user with phone, name, DOB |
| `POST` | `/api/v1/auth/login` | Login using phone number & PIN |
| `GET`  | `/api/v1/auth/profile/{phone}` | Fetch user profile by primary key (phone) |

### Fraud Scoring Engine (`/api/v1/score`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/score` | Scores transaction against 6 ML/Rule engines in <200ms |

### Guardian Endpoints (`/api/v1/guardian`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/guardian/list` | List active/pending guardians & wards |
| `POST` | `/api/v1/guardian/add` | Initiate guardian link (generates & returns 6-digit OTP) |
| `POST` | `/api/v1/guardian/verify-code` | Verify OTP code & activate relationship |
| `POST` | `/api/v1/guardian/set-limit` | Set max transaction spending limit |
| `GET`  | `/api/v1/guardian/get-limit` | Fetch spending limit & cumulative metrics |
| `POST` | `/api/v1/guardian/request-approval` | Submit high-value payment for guardian review |
| `POST` | `/api/v1/guardian/respond` | Guardian approves or rejects pending payment |
| `GET`  | `/api/v1/guardian/request-status/{id}` | Poll transaction approval status |
| `WS`   | `/api/v1/guardian/ws?token={jwt}` | Real-time WebSocket event channel |

### P2P & Analytics Endpoints (`/api/v1`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/p2p/transfer` | Execute P2P payment settlement |
| `GET`  | `/api/v1/transactions/history/{vpa}` | Get transaction history |
| `POST` | `/api/v1/feedback` | Submit analyst ground-truth labels (FRAUD/LEGIT) |
| `GET`  | `/api/v1/model` | Model registry status and accuracy metrics |

---

## 5. Database Schema Key Tables (PostgreSQL / Supabase)

1. **`auth_users`**: `id` (UUID, PK), `phone` (UNIQUE, Auth Primary Key), `vpa`, `name`, `dob`, `password_hash`, `balance`, `created_at`.
2. **`guardian_relationships`**: `id` (UUID, PK), `user_id`, `guardian_user_id`, `guardian_phone`, `guardian_vpa`, `status` (`PENDING`, `ACTIVE`, `REMOVED`), `invited_at`, `accepted_at`.
3. **`guardian_approval_requests`**: `id` (UUID, PK), `transaction_id`, `user_id`, `guardian_id`, `amount`, `recipient_vpa`, `fraud_score`, `risk_signals`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`), `expires_at`.
4. **`transactions`**: `transaction_id` (PK), `sender_vpa`, `receiver_vpa`, `amount`, `currency`, `status`, `decision`, `risk_score`, `created_at`.
5. **`graph_nodes` & `graph_edges`**: Graph persistence tables for PageRank and risk propagation.

---

## 6. Directory Structure & Key Files

```
upi/
├── Procfile                             # Gunicorn start command (--timeout 120)
├── render.yaml                          # Render.com cloud deployment config
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── api/v1/                      # REST & WebSocket Routers
│   │   │   ├── auth.py                  # Phone login & profile API
│   │   │   ├── guardian.py              # Guardian, OTP & WebSocket router
│   │   │   ├── scoring.py               # Main transaction scoring API
│   │   │   ├── p2p.py                   # P2P Transfer API
│   │   │   ├── feedback.py              # Analyst label submission
│   │   │   └── model.py                 # Model registry metadata
│   │   ├── core/
│   │   │   └── scoring_engine.py        # 6-Engine parallel orchestrator
│   │   ├── db/
│   │   │   └── schema_auth.sql          # Complete PostgreSQL database schema
│   │   ├── engines/                     # ML & Analytics Sub-Engines
│   │   │   ├── ml_engine.py             # LightGBM + Isolation Forest
│   │   │   ├── rule_engine.py           # Dynamic JSON-DSL evaluator
│   │   │   ├── behavioral_engine.py     # Z-score deviation model
│   │   │   ├── graph_engine.py          # NetworkX PageRank & hop count
│   │   │   └── xai_engine.py            # SHAP explainability engine
│   │   └── ml_models/                   # Serialized model pickles
│   │       ├── lgbm_model.pkl
│   │       ├── iso_forest_model.pkl
│   │       ├── shap_explainer.pkl
│   │       └── feature_cols.pkl
│   └── run.py                           # Backend local entrypoint
│
└── SentinelPayApp/                      # React Native Android Client
    ├── android/app/src/main/java/com/sentinelpay/
    │   ├── QrDecoderModule.java         # ZXing gallery image QR decoder
    │   ├── QrDecoderPackage.java        # React Native package wrapper
    │   ├── SmsClassifier.java           # Native TFLite SMS classifier
    │   ├── SmsReceiverModule.java       # BroadcastReceiver for SMS
    │   └── SmsReaderModule.java         # Batch SMS history reader
    ├── src/
    │   ├── theme/
    │   │   └── ds.ts                    # Single source of truth design system
    │   ├── components/
    │   │   ├── UpiPinModal.tsx          # PIN entry + animated payment processing
    │   │   ├── PanicButton.tsx          # Floating 56dp Siren FAB
    │   │   └── AppIcon.tsx              # Vector icon system
    │   ├── screens/                     # 28 Redesigned UI Screens
    │   │   ├── HomeScreen.tsx           # Main dashboard
    │   │   ├── SendMoneyScreen.tsx      # Payment screen & threshold gating
    │   │   ├── ReceiveMoneyScreen.tsx   # QR generator & preset amount
    │   │   ├── ScanQRScreen.tsx         # Dual camera/gallery QR scanner
    │   │   ├── GuardianManagementScreen.tsx # Guardian limits & OTP verification
    │   │   ├── GuardianApprovalScreen.tsx # Guardian approval review screen
    │   │   ├── AiRiskHistoryScreen.tsx  # 2x2 metric analytics & decision feed
    │   │   ├── ScamAssistantScreen.tsx  # AI scam analyzer & presets
    │   │   └── TransactionHistoryScreen.tsx # History feed
    │   └── services/                    # API & Native Bridge Services
    │       ├── guardianService.ts       # Guardian API & WS coordinator
    │       ├── smsReaderService.ts      # Native SMS listener coordinator
    │       ├── fraudShieldApi.ts        # Backend scoring API client
    │       └── notificationService.ts   # Local push notification engine
    └── App.tsx                          # App root navigation
```

---

## 7. Current Project Status & Recent Commits

- **Git Status**: Fully committed and pushed to `main` branch on GitHub (`https://github.com/SidReddy-24/upi.git`).
- **Cloud Backend**: Live at `https://upi-nd1p.onrender.com`.
- **Latest Commit**: `dc8dc9d3` (`fix(deploy): add --timeout 120 to gunicorn & add graph_nodes table to schema_auth.sql`).
- **Release Build**: Compiled APK located at `/Users/pranaykadam/Desktop/SentinelPay-GuardianFix.apk` (85 MB).
- **TypeScript Status**: `npx tsc --noEmit` exits with **0 errors**.

---

## 8. Summary Checklist for Gemini / AI Assistants

When taking over tasks on this repository:
1. **Phone number is the primary key** for all authentication and user lookup logic.
2. **Design system (`src/theme/ds.ts`)** MUST be imported by all UI screens (`C`, `S`, `T`, `R`, `shadow`, `DS`).
3. **Guardian thresholding** is enforced in `SendMoneyScreen.tsx` before executing `p2p/transfer`.
4. **SMS Fraud Classifier** uses native Android code (`SmsReceiverModule.java`) and `SmsReaderService.ts`.
5. **QR Code Gallery Reader** uses native Java `QrDecoderModule.java`.
6. **Backend Scoring** runs 6 engines concurrently via `asyncio.gather` in `backend/app/core/scoring_engine.py`.
7. **Cloud Deployment** runs on Render with `--timeout 120` to accommodate ML model initialization.
