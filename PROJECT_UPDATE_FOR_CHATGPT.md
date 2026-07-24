# SentinelPay (UPI + AI Fraud Protection) — Complete Project Update for ChatGPT

> **Note for AI / ChatGPT:** This document contains a comprehensive, production-grade technical summary of the entire **SentinelPay** repository. Read this file to instantly understand the architecture, tech stack, features implemented, backend endpoints, database schema, native Android modules, ML pipeline, and current status.

---

## 1. Project Overview & Context

**SentinelPay** is an AI-powered, enterprise-grade UPI Payment & Real-Time Fraud Prevention Application. It combines a **React Native (Android)** mobile client with a **FastAPI (Python)** scoring and backend engine.

### Key Objectives Achieved:
1. **Mandatory Phone Authentication**: Primary key for all user accounts across devices is their **Phone Number**. Flow: Phone Login → Name/DOB → UPI PIN & Biometrics setup.
2. **Real-Time SMS Fraud Tracker (Truecaller-style)**: Background monitoring of incoming SMS messages using an on-device TensorFlow Lite model (`spam_classifier.tflite`) + rule-based classifier. Sends real-time pop-up push notifications flagging messages as **LEGIT**, **SUSPICIOUS**, or **DANGEROUS**.
3. **Guardian Approval System**: Allows users to link a trusted guardian (already registered on SentinelPay) using a 6-digit OTP verification code. Users configure a maximum transaction spending limit (e.g. ₹5,000). Any payment exceeding the limit is automatically held, sending a real-time approval request to the guardian.
4. **Dynamic QR Code System with Amount & Gallery Upload**:
   - Generate UPI QR codes with custom preset amounts.
   - Direct 1-tap sharing to WhatsApp and other messaging apps.
   - Dual-mode QR Scanner: Camera scanner + **Gallery Photo Upload** scanner backed by a native Java module (`QrDecoderModule.java`).
   - Cross-profile compatibility (reads SentinelPay app QRs and standard UPI QRs).
5. **Real-Time Transaction History & Latency Fixes**: Instant cloud synchronization and 3.5s polling loop to eliminate transaction history latency.
6. **Multi-Engine Fraud Scoring Backend (FraudShield AI)**: 6 parallel engines (LightGBM, Isolation Forest, Rule DSL, Behavioral Analytics, Graph NetworkX, XAI SHAP explanations) processing risk in under 200ms.

---

## 2. System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │             SentinelPay React Native App (Android)      │
   │                                                         │
   │  ┌───────────────────┐  ┌────────────────────────────┐  │
   │  │  UI Screens (TSX) │  │ Native Android Java        │  │
   │  │  - Home, Auth,    │  │ - SmsReceiverModule        │  │
   │  │    Send, Guardian │  │ - SmsClassifier (TFLite)   │  │
   │  │    SMS Tracker    │  │ - QrDecoderModule (ZXing)  │  │
   │  └─────────┬─────────┘  └──────────────┬─────────────┘  │
   └────────────┼───────────────────────────┼────────────────┘
                │ REST / WebSockets         │ Events / Native Bridge
                ▼                           ▼
   ┌─────────────────────────────────────────────────────────┐
   │               FastAPI Python Backend                    │
   │                                                         │
   │  ┌───────────────────┐  ┌────────────────────────────┐  │
   │  │ REST APIs         │  │ 6-Engine Fraud Engine      │  │
   │  │ - Auth, P2P, QR   │  │ - LightGBM (45%)           │  │
   │  │ - Guardian, SMS   │  │ - Rule Engine (25%)        │  │
   │  │ - Feedback        │  │ - Behavioral (20%)         │  │
   │  └─────────┬─────────┘  │ - Graph NetworkX (10%)     │  │
   │            │            │ - Isolation Forest         │  │
   │            │            │ - SHAP Explainer (XAI)     │  │
   │            │            └────────────────────────────┘  │
   └────────────┼────────────────────────────────────────────┘
                ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Persistent Layer: Supabase PostgreSQL + Redis (L1 Cache) │
   └─────────────────────────────────────────────────────────┘
```

### Technology Stack:
- **Mobile Client**: React Native 0.74+, TypeScript, React Navigation v6, `react-native-push-notification`, `react-native-vector-icons`, `react-native-svg-qrcode`.
- **Native Android Code**: Java (`SmsReceiverModule.java`, `SmsClassifier.java`, `SmsReaderModule.java`, `QrDecoderModule.java`), TensorFlow Lite NLClassifier, ZXing barcode decoder.
- **Backend API**: Python 3.11/3.13, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy (Async `psycopg3`).
- **ML & Data Science**: LightGBM, Scikit-learn (Isolation Forest), SHAP (TreeSHAP), NetworkX (Graph Analytics), NumPy, Pandas.
- **Database & Cache**: Supabase PostgreSQL, Redis (L1 feature cache and rate limiting).
- **Git Repo**: `https://github.com/SidReddy-24/upi.git` (`main` branch).

---

## 3. Detailed Breakdown of Implemented Features

### A. Phone-First Authentication & User Profile
- **Primary Key**: Phone number (e.g. `+919876543210`).
- **Onboarding Flow**:
  1. Phone input with OTP verification / simulation.
  2. Profile setup: Name, Date of Birth (DOB).
  3. Security setup: 4/6-digit UPI PIN & Biometric device registration (`react-native-biometrics`).
  4. Local encrypted storage (`AsyncStorage` + Keychain) maintains persistent session mapped to the phone number across device restarts.

### B. Guardian Approval System
- **Linking Flow**:
  1. User inputs a guardian's registered phone number.
  2. Backend generates a 6-digit verification OTP and broadcasts it to the guardian's SentinelPay app via WebSockets / notification feed.
  3. Guardian shares code → User enters code in interactive OTP modal → Status becomes `ACTIVE`.
- **Spending Threshold Gating**:
  1. User sets a maximum transaction limit (e.g., ₹5,000) in **Guardian Management Screen**.
  2. During payment (`SendMoneyScreen.tsx`), if `amount > limit` and active guardians exist:
     - Payment execution is paused.
     - Backend status changes to `AWAITING_GUARDIAN_APPROVAL`.
     - Request sent to guardian's app showing Amount, Recipient VPA, and Risk Score.
     - 2-second polling loop checks approval response.
     - If Approved → Payment executes automatically (`finalizeApprovedPayment`).
     - If Rejected → Transaction blocked with alert: *"🚨 Transaction Blocked: Your guardian rejected this payment request"*.

### C. Real-Time SMS Fraud Tracker (Truecaller-Style)
- **Native Android Listener**: `SmsReceiverModule.java` listens to `android.provider.Telephony.SMS_RECEIVED`.
- **TFLite Classifier**: `SmsClassifier.java` uses `spam_classifier.tflite` + keyword fallback (phishing links, job scams, lottery scams).
- **Trusted Bank Whitelist**: Detects bank sender IDs (e.g., `HD-HDFCBK`, `IC-ICICI`) and legitimate banking keywords (`debited`, `credited`, `UPI REF`).
- **Pop-Up Push Notifications**: Fires instant system notifications with risk level badges:
  - 🚨 **DANGEROUS**: High ML score (>0.7) or OTP from untrusted sender.
  - ⚠️ **SUSPICIOUS**: Medium ML score (0.3–0.7).
  - ✅ **LEGIT**: Verified bank message or low score (<0.3).
- **SMS Tracker Screen (`SmsTrackerScreen.tsx`)**: Filter tabs (All, Fraud, Suspicious, Genuine), strictly sorted descending by timestamp, batch historical scanner, manual re-scan, clear data options.

### D. Dynamic QR Code Generator & Dual Scanner
- **Receive Money Screen**: Generates clean SVG QR codes. Supports setting custom amounts (e.g., ₹250) embedded in standard UPI URI scheme (`upi://pay?pa=user@upi&am=250`).
- **Social Sharing**: "Share via WhatsApp" button formats direct payment link and QR image payload.
- **Scanner Screen**:
  - Live Camera Scanner (`react-native-camera` / vision-camera).
  - **Upload QR Image from Gallery**: Uses native `QrDecoderModule.java` with ZXing library to extract UPI string from any selected image file.

### E. Transaction Latency & History Engine
- **Cloud Polling**: `HomeScreen.tsx` and `TransactionHistoryScreen.tsx` run background sync loops every 3.5s to ensure zero latency between sender and recipient history feeds.

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
| `POST` | `/api/v1/guardian/add` | Initiate guardian link (generates 6-digit OTP) |
| `POST` | `/api/v1/guardian/verify-code` | Verify OTP code & activate relationship |
| `POST` | `/api/v1/guardian/set-limit` | Set max transaction spending limit |
| `GET`  | `/api/v1/guardian/get-limit` | Get user's spending limit |
| `POST` | `/api/v1/guardian/request-approval` | Submit high-value payment for guardian review |
| `POST` | `/api/v1/guardian/respond` | Guardian approves or rejects pending payment |
| `GET`  | `/api/v1/guardian/request-status/{id}` | Poll transaction approval status |

### P2P & Feedback Endpoints (`/api/v1`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/p2p/transfer` | Execute P2P payment |
| `GET`  | `/api/v1/transactions/history/{vpa}` | Get user transaction history |
| `POST` | `/api/v1/feedback` | Submit analyst ground-truth labels (FRAUD/LEGIT) |
| `GET`  | `/api/v1/model` | Model registry status and accuracy metrics |

---

## 5. Database Schema Key Tables (PostgreSQL / Supabase)

1. **`users`**: `vpa` (PK), `phone_number` (UNIQUE, Primary Key for Auth), `name`, `dob`, `upi_pin_hash`, `biometric_pubkey`, `fraud_flag`, `created_at`.
2. **`guardian_relationships`**: `id`, `user_phone`, `guardian_phone`, `status` (`PENDING_VERIFICATION`, `ACTIVE`, `REJECTED`), `verification_code`, `created_at`.
3. **`guardian_limits`**: `user_phone` (PK), `spending_limit`, `updated_at`.
4. **`guardian_approval_requests`**: `request_id`, `transaction_id`, `user_phone`, `guardian_phone`, `amount`, `receiver_vpa`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `created_at`.
5. **`transactions`**: `transaction_id` (PK), `sender_vpa`, `receiver_vpa`, `amount`, `status`, `risk_score`, `decision`, `scored_at`.
6. **`risk_scores`**: `transaction_id`, `ml_score`, `iso_score`, `rule_risk`, `behavioral_score`, `graph_risk`, `composite_risk`, `confidence`, `rule_flags`, `shap_values`.

---

## 6. Directory Map & Core Files

```
upi/
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── api/v1/                      # REST Routers
│   │   │   ├── auth.py                  # Phone login & profile API
│   │   │   ├── guardian.py              # Guardian & OTP verification API
│   │   │   ├── scoring.py               # Main transaction scoring API
│   │   │   ├── p2p.py                   # P2P Transfer API
│   │   │   ├── feedback.py              # Analyst label submission
│   │   │   └── model.py                 # Model registry metadata
│   │   ├── core/
│   │   │   └── scoring_engine.py        # 6-Engine parallel orchestrator
│   │   ├── engines/                     # Individual Sub-Engines
│   │   │   ├── ml_engine.py             # LightGBM + Isolation Forest
│   │   │   ├── rule_engine.py           # Dynamic JSON-DSL evaluator
│   │   │   ├── behavioral_engine.py     # Z-score deviation model
│   │   │   ├── graph_engine.py          # NetworkX PageRank & hop count
│   │   │   └── xai_engine.py            # SHAP explainability engine
│   │   ├── features/
│   │   │   └── feature_store.py         # 26-feature Redis extractor
│   │   └── ml_models/                   # Serialized pickle model files
│   │       ├── lgbm_model.pkl
│   │       ├── iso_forest_model.pkl
│   │       ├── shap_explainer.pkl
│   │       └── feature_cols.pkl
│   └── run.py                           # Backend entrypoint (Port 8000)
│
└── SentinelPayApp/                      # React Native Android Client
    ├── android/app/src/main/java/com/sentinelpay/
    │   ├── QrDecoderModule.java         # ZXing gallery image QR decoder
    │   ├── QrDecoderPackage.java        # React Native package wrapper
    │   ├── SmsClassifier.java           # Native TFLite SMS classifier
    │   ├── SmsReceiverModule.java       # BroadcastReceiver for SMS
    │   └── SmsReaderModule.java         # Batch SMS history reader
    ├── src/
    │   ├── screens/                     # Application UI Screens
    │   │   ├── HomeScreen.tsx           # Dashboard & fast actions
    │   │   ├── SendMoneyScreen.tsx      # Payment screen & threshold gating
    │   │   ├── ReceiveMoneyScreen.tsx   # QR generator & preset amount
    │   │   ├── QRScannerScreen.tsx      # Dual camera/gallery QR scanner
    │   │   ├── GuardianManagementScreen.tsx # OTP modal & limit config
    │   │   ├── SmsTrackerScreen.tsx     # Real-time SMS tracker & filters
    │   │   └── TransactionHistoryScreen.tsx # Polled history view
    │   ├── services/                    # API & Native Bridge Services
    │   │   ├── guardianService.ts       # Guardian API client
    │   │   ├── smsReaderService.ts      # SMS listener coordinator
    │   │   ├── fraudShieldApi.ts        # Backend scoring API client
    │   │   └── notificationService.ts   # Local push notification engine
    │   └── utils/
    │       ├── smsDb.ts                 # Local SMS SQLite/AsyncStorage DB
    │       └── settingsDb.ts            # Local app settings storage
    └── App.tsx                          # App root navigation
```

---

## 7. Current Project Status & Recent Commits

- **Git Status**: Fully committed and pushed to `main` branch on GitHub (`https://github.com/SidReddy-24/upi.git`).
- **Release Build**: Pre-compiled release APK located at `/Users/pranaykadam/Desktop/SentinelPay-v1.2.0-guardian-release.apk` (84 MB).
- **Test Coverage**: 169/169 unit & integration tests passing cleanly.
- **Backend Task**: Running on port `8000` via FastAPI (`run.py`).

---

## 8. Summary Checklist for ChatGPT / Next AI Assistant

When picking up work on this codebase:
1. **Phone number is the primary key** for all authentication and user lookup logic.
2. **Guardian thresholding** is enforced in `SendMoneyScreen.tsx` before executing `p2p/transfer`.
3. **SMS Fraud Classifier** uses native Android code (`SmsReceiverModule.java`) and `SmsReaderService.ts`.
4. **QR Code Gallery Reader** uses native Java `QrDecoderModule.java`.
5. **Backend Scoring** runs 6 engines concurrently via `asyncio.gather` in `backend/app/core/scoring_engine.py`.
