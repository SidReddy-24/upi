# SentinelPay — Demo Day & Viva Preparation Guide

> **For the candidate:** This document is your complete defense kit. Every panel member's mindset, every hard question, every correct answer, and every follow-up is here. Do not memorise answers verbatim — understand them so you can reconstruct them under pressure.

---

## PART 1 — PROJECT EXPLANATION (What to say in 60 seconds)

> "SentinelPay is an AI-powered UPI fraud prevention platform built for the Indian payment ecosystem. Unlike traditional UPI apps that focus only on completing payments, SentinelPay stops fraud *before* money leaves the account. Every transaction is evaluated in under 200 milliseconds by a 6-engine AI pipeline combining machine learning, behavioral analysis, graph analytics, rule engines, and device trust signals. The result is a unified risk score with a human-readable SHAP explanation. High-risk transactions are blocked, medium-risk ones are routed to a Guardian — a trusted person the user designates — and safe transactions go through instantly. The app also includes on-device SMS fraud classification using TFLite, a community scam reporting system, a device integrity dashboard, a scam passport lookup, and an emergency wallet freeze. The backend is FastAPI on Render, the database is Supabase PostgreSQL with Redis caching, and the mobile app is React Native with native Android Java modules."

---

## PART 2 — ARCHITECTURE EXPLANATION

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              React Native App (Android)                     │
│  ┌─────────────────┐   ┌──────────────────────────────────┐ │
│  │  TSX UI Screens │   │  Native Android Modules (Java)   │ │
│  │  - 32 Screens   │   │  - SmsReceiverModule             │ │
│  │  - DS tokens    │   │  - SmsClassifier (TFLite)        │ │
│  │  - walletDb     │   │  - SmsReaderModule               │ │
│  │  - notifSvc     │   │  - QrDecoderModule (ZXing)       │ │
│  └────────┬────────┘   └──────────────┬───────────────────┘ │
└───────────┼───────────────────────────┼─────────────────────┘
            │ REST / HTTP               │ Native Bridge Events
            ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                FastAPI Backend (Render.com)                  │
│  ┌──────────────────┐   ┌───────────────────────────────┐   │
│  │  REST Routers    │   │  6-Engine Fraud Pipeline       │   │
│  │  - /auth         │   │  1. Rule Engine (25%)          │   │
│  │  - /transfer     │   │  2. Behavioral Z-score (20%)   │   │
│  │  - /guardian     │   │  3. Isolation Forest (anomaly) │   │
│  │  - /community    │   │  4. LightGBM (45%)             │   │
│  │  - /sms          │   │  5. NetworkX Graph (10%)       │   │
│  │  - /heatmap      │   │  6. SHAP Explainer             │   │
│  │  - /health       │   └───────────────────────────────┘   │
│  └──────────────────┘                                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴──────────────┐
               ▼                              ▼
   ┌───────────────────────┐    ┌─────────────────────────┐
   │  Supabase PostgreSQL  │    │  Redis Cache (L1)        │
   │  - users, txns        │    │  - trust scores          │
   │  - guardian_links     │    │  - fraud rules           │
   │  - community_reports  │    │  - session tokens        │
   └───────────────────────┘    └─────────────────────────┘
```

### Transaction Decision Flow

```
User initiates payment
        ↓
Feature Extraction (amount, time, device, recipient, VPA, behavioural delta)
        ↓
  ┌─────┴──────┐
  Rule Engine  Behavior Engine  Isolation Forest  LightGBM  Graph Analytics
  ↓            ↓                ↓                 ↓         ↓
  Rule Score   Z-Score          Anomaly Flag       ML Score  Graph Score
  └─────────────────────────┬──────────────────────────────┘
                             ↓
               Weighted Risk Aggregator (0.0–1.0)
                             ↓
                    ┌────────┴─────────┐
                  < 0.3             0.3–0.7           > 0.7
                 APPROVE          GUARDIAN            REJECT
                    ↓                ↓                  ↓
             Transaction       Guardian notified    Hard block
             proceeds          for approval         + explanation
                    ↓                ↓                  ↓
             SHAP explanation  SHAP explanation    SHAP explanation
             shown to user     shown to both       shown to user
```

---

## PART 3 — EVERY SCREEN EXPLAINED

| Screen | Purpose | Key Logic |
|--------|---------|-----------|
| AuthModeSelector | Entry point, choose login method | Reads stored auth preference |
| PhoneAuthScreen | Phone number entry | OTP flow to backend /auth/login |
| PinLoginScreen | 6-digit PIN entry | Local hash comparison |
| PinSetupScreen | Create new PIN | Salted hash stored in AsyncStorage |
| BiometricSetupScreen | FaceID/Fingerprint | react-native-biometrics integration |
| OnboardingScreen | First-time welcome | AsyncStorage flag: 'onboarded' |
| HomeScreen | V2 overview-only | Balance hero, quick actions, guardian summary, fraud status, recent 5 txns, 5-tab nav |
| PaymentsScreen | Payment hub | Send, Receive, Scan QR, History |
| FraudShieldScreen | All AI tools hub | Links to all security features |
| MoreScreen | Secondary nav | Guardian, Analytics, Community, Account, Settings |
| NotificationsScreen | Alert center | notificationService pub-sub, real events only |
| SendMoneyScreen | UPI transfer | Amount → AI scoring → UpiPinModal → success/block |
| ReceiveMoneyScreen | Show QR + VPA | SVG QR generator with preset amounts |
| ScanQRScreen | Camera QR reader | ZXing native Java module, gallery fallback |
| TransactionHistoryScreen | All transactions | walletDb + cloud sync |
| TransactionDetailScreen | Single txn analysis | Risk score, decision, SHAP trigger |
| GuardianManagementScreen | Guardian setup | Add guardian via OTP, set spending limit |
| GuardianApprovalScreen | Approve requests | Real-time polling, approve/decline with note |
| GuardianVerificationScreen | OTP entry | 6-digit code to verify guardian link |
| AiRiskHistoryScreen | Live risk feed | subscribeWallet() pub-sub, animated score bars |
| DeviceTrustScreen | Device security dashboard | SVG animated gauge, 14 signals, attestation |
| ScamAssistantScreen | AI chat for fraud advice | Conversational scam analysis |
| ScamHeatMapScreen | Geographic fraud map | Hotspot clusters by region |
| ScamPassportScreen | Entity trust lookup | VPA/phone trust score history |
| SmsTrackerScreen | On-device SMS scanner | TFLite NLClassifier, rule fallback |
| SmsDetailScreen | Single SMS analysis | Risk breakdown for one message |
| ReportScamScreen | Community report | Animated chips, focused inputs, success overlay |
| ProfileScreen | User profile | Avatar, UPI VPA, preferences |
| SettingsScreen | App settings | Notifications, security, guardian settings |
| AdminAnalyticsDashboardScreen | Ops dashboard | Transaction volumes, fraud rates, backend health |

---

## PART 4 — BACKEND EXPLANATION

### FastAPI Routers

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| auth | /api/v1/auth | POST /login, POST /register, POST /logout |
| transfer | /api/v1 | POST /transfer (main payment + scoring) |
| guardian | /api/v1/guardian | GET /pending-requests, POST /respond, GET /get-limit, POST /set-guardian |
| community | /api/v1/community | POST /report, GET /scam-passport/{id} |
| sms | /api/v1/sms | POST /classify |
| heatmap | /api/v1 | GET /heatmap |
| health | /api/v1 | GET /health |

### POST /transfer — The Core Endpoint

```python
# What happens in order:
1. Authenticate sender JWT
2. Validate recipient VPA exists
3. Check balance >= amount
4. Extract features: {amount, hour, day, device_trust, is_new_merchant, call_during_payment, ...}
5. Run Rule Engine → rule_score
6. Run Behavioral Z-score → deviation from user's mean spending pattern
7. Run Isolation Forest → anomaly score (unsupervised)
8. Run LightGBM → ml_score (supervised)
9. Run NetworkX Graph → graph_risk (is this VPA in known fraud cluster?)
10. Aggregate: final_score = weighted_sum(all scores)
11. Decision: APPROVE / GUARDIAN_REQUIRED (HTTP 423) / REJECT
12. SHAP → explain top 3 features that drove the score
13. Deduct balance, write transaction, notify guardian if needed
14. Return {status, risk_score, decision, explanation, transaction_id}
```

---

## PART 5 — AI & ML EXPLANATION

### Why 6 Engines? Why not just one?

"Each engine catches a different class of fraud. A single model would have blind spots. By combining them, we get complementary coverage:

- **Rule Engine** catches known patterns instantly (e.g., amount = exactly ₹9,999 to avoid ₹10K reporting threshold). Zero latency, zero ML overhead.
- **Behavioral Z-score** catches *personal* anomalies — a user who always pays under ₹500 suddenly sends ₹15,000 at 3 AM is flagged, even if that transaction is 'normal' in aggregate.
- **Isolation Forest** (unsupervised) catches anomalies without needing labels. Critical in a domain where fraud patterns evolve faster than you can label data.
- **LightGBM** (supervised) is the precision engine — trained on labeled fraud data, highest accuracy, fastest tree-based model.
- **NetworkX Graph** catches mule account networks. If the recipient VPA is 2 hops from a known scammer, that's a red flag no single-transaction model would see.
- **SHAP** is not a detection engine — it's the explainability layer that tells the user *why* the transaction was flagged."

### Feature Engineering

Features extracted per transaction:
- amount (raw, log-transformed, percentile vs user history)
- hour_of_day (sine/cosine encoded to capture cyclicality)
- day_of_week
- is_new_merchant (first-time recipient)
- is_new_device
- call_during_payment (active call = major fraud signal)
- time_since_last_txn (velocity)
- amount_vs_user_mean (z-score of this amount vs user's historical mean)
- amount_vs_user_std
- recipient_trust_score (community reports)
- recipient_report_count
- device_trust_score
- vpa_age_days

### LightGBM vs Other Models

| Model | Why not used |
|-------|-------------|
| Neural Networks | Need massive labeled datasets; interpretability is poor; slower inference |
| XGBoost | LightGBM is faster (leaf-wise tree growth vs level-wise), lower memory, better on sparse features |
| Random Forest | Much slower (many independent trees); no native support for categorical features |
| Logistic Regression | Linear decision boundary; cannot capture complex fraud patterns |

**LightGBM chosen because**: leaf-wise tree growth, DART (Dropout meets MART) for robustness, native categorical support, sub-100ms inference, strong performance on tabular fraud datasets.

### Isolation Forest

- Unsupervised anomaly detection
- Randomly partitions feature space. Anomalies are isolated in fewer splits (shorter path length).
- No labels needed — critical for novel fraud patterns
- Used as a second opinion alongside LightGBM; if IF flags something LightGBM didn't, weight increases

### Graph Analytics (NetworkX)

- Builds a directed transaction graph: nodes = VPAs, edges = payment flows
- Looks for: clustering coefficient, betweenness centrality (mule accounts have high centrality), known fraud node proximity
- If recipient is within 2 hops of a community-reported scammer → graph_risk += penalty
- Why not Graph Neural Networks? GNNs require fixed graph topology at training time; our graph grows in real time. NetworkX handles dynamic graphs natively.

### SHAP (SHapley Additive exPlanations)

- Game theory-based feature attribution
- Tells us: "This transaction was flagged primarily because: (1) new merchant (+0.34 risk), (2) 3 AM transaction (+0.22), (3) amount 8x user average (+0.31)"
- SHAP values sum to the model's output — fully consistent attribution
- Required for explainable AI compliance (RBI's guidance on AI decision transparency)

---

## PART 6 — GUARDIAN SYSTEM

### How it works:

1. User (Ward) goes to Settings → Guardian → Enter guardian's phone number
2. System generates 6-digit OTP, sends to guardian's phone
3. Guardian enters OTP in their SentinelPay app → link established
4. Ward sets a spending threshold (e.g., ₹2,000/day)
5. Any transaction where:
   - amount > threshold → HTTP 423 (Locked) returned
   - risk_score > 0.6 → HTTP 423
6. Backend creates a GuardianRequest record with: amount, recipient, risk_score, SHAP explanation
7. Guardian receives notification, opens GuardianApprovalScreen
8. Guardian approves or declines with optional note
9. If approved: transaction re-executes (balance deducted, txn written)
10. If declined: transaction cancelled, ward notified

### HTTP 423 — Why 423?

"HTTP 423 is 'Locked' — the resource (wallet) is temporarily locked pending approval. It's semantically correct: the transaction isn't rejected (which would be 402 Payment Required or 403 Forbidden), it's in a pending-approval state. 402 implies payment method problem, 403 implies permanent denial. 423 says 'held, pending resolution.'"

---

## PART 7 — DEVICE TRUST

### 14 Security Signals:
1. Root/Jailbreak Detection — checks for su binary, Magisk
2. Emulator Detection — hardware fingerprint (ARM64 vs x86)
3. Developer Options — adb enabled flag
4. USB Debugging — ADB shell access
5. Accessibility Abuse — unauthorized accessibility services
6. Overlay Attack Detection — transparent windows over payment UI
7. VPN/Tunnel Detection — network routing check
8. Mock Location — GPS sensor vs network location mismatch
9. Screen Recording — FLAG_SECURE enforcement
10. Unknown Sources — sideloaded APK detection
11. App Integrity — APK signature vs Play Store certificate
12. SIM Change Detection — original IMSI mismatch
13. OS Version Check — API level and patch level
14. Play Integrity API — STRONG_INTEGRITY / BASIC_INTEGRITY verdict

Device trust score = weighted sum of passed signals.
Injected as a feature into every fraud scoring request.

---

## PART 8 — SMS FRAUD DETECTION

### On-device vs cloud:

"SMS classification is intentionally on-device because:
1. SMS content is highly sensitive (OTPs, bank messages, personal data)
2. Sending SMS content to a server would be a massive privacy violation
3. TFLite inference is < 10ms on modern Android hardware
4. Works offline — critical for users in low-connectivity areas
5. Regulatory: RBI and TRAI guidance discourages server-side SMS logging"

### TFLite NLClassifier:
- Text classification model exported to .tflite format
- Labels: LEGIT / SUSPICIOUS / DANGEROUS
- Input: raw SMS text, tokenized
- Fallback: regex rule engine if model confidence < 0.6

### Native Android Flow:
```
SMS arrives → SmsReceiver (BroadcastReceiver) → SmsReceiverModule (Java/RN Bridge)
→ SmsClassifier.java (TFLite NLClassifier) → classification result
→ React Native event emitter → SmsTrackerScreen → push notification with risk badge
```

---

## PART 9 — TECHNOLOGY CHOICES (Why X and not Y)

### Why React Native?
- Single codebase for Android (and iOS if needed)
- TypeScript support = type safety, maintainability
- Direct native module bridge = can write Java modules (SMS, QR) and call them from JS
- React Navigation, Animated API, AsyncStorage all available
- Alternative (Flutter): Dart ecosystem smaller, no direct JSX parallelism with web skills

### Why FastAPI?
- Async by default (uvicorn + asyncio) — critical for concurrent fraud scoring requests
- Automatic OpenAPI/Swagger docs — essential during development
- Pydantic v2 validation — catches malformed requests before they hit business logic
- 3–4x faster than Django REST Framework for I/O-bound endpoints
- Python ML ecosystem (scikit-learn, lightgbm, shap, networkx) native

### Why PostgreSQL (Supabase)?
- ACID transactions — critical for financial data (no partial balance deductions)
- Row-level security (RLS) — users can only query their own transactions
- JSONB columns for flexible fraud metadata
- Supabase adds realtime subscriptions, auto-generated REST/GraphQL, managed hosting

### Why Redis?
- Sub-millisecond reads for hot data (trust scores, fraud rules, session tokens)
- TTL-based expiry (session tokens expire automatically)
- Counter patterns for rate limiting and spending trackers
- Reduces PostgreSQL load for repeated reads

### Why not DynamoDB?
- DynamoDB is eventually consistent — unacceptable for financial transactions
- Complex querying requires design-time knowledge of access patterns
- PostgreSQL's relational model is more natural for fraud graph queries

### Why Render and not AWS/GCP?
- Demo/student project — Render's free tier handles 512MB RAM, sufficient for ML model loading
- Zero-config deployment from GitHub
- For production: would move to AWS ECS with auto-scaling

### Why LightGBM and not Neural Networks?
- Tabular data: LightGBM consistently outperforms deep learning on structured tabular fraud datasets (see Kaggle leaderboards)
- Training time: minutes vs hours
- Inference: <5ms vs 50-200ms for neural inference
- Interpretability: tree structure explains decisions; NNs are black boxes
- Data: labeled fraud datasets are small (<100K samples typically). NNs overfit. Tree models generalize better.

### Why Isolation Forest?
- The only major unsupervised anomaly detector that scales to our feature dimensionality
- No need for labeled "fraud" samples — critical since fraud patterns evolve faster than labeling can keep up
- Complements LightGBM: catches novel fraud types that weren't in training data

### Why not only rule-based detection?
- Rules are brittle. Fraudsters adapt. A rule that catches "amount = ₹9,999" stops working the moment fraudsters switch to ₹9,998.
- Rules have zero generalization. Each new fraud type requires manual engineering.
- ML catches patterns no human engineer would think to write a rule for.

### Why SHAP and not LIME?
- SHAP is globally consistent: Shapley values satisfy efficiency, symmetry, and dummy axioms from game theory
- LIME generates locally approximate explanations that can contradict each other for the same model
- SHAP is consistent across the entire feature space, LIME is not
- SHAP TreeExplainer is O(TLD) for tree models — extremely fast
- RBI AI guidance requires consistent, auditable explanations. SHAP satisfies this; LIME doesn't.

### Why ZXing for QR scanning?
- ZXing (Zebra Crossing) is the de-facto standard Java QR/barcode library
- Handles UPI QR format (pa=, pn=, am=, tr=, cu= parameters)
- No internet connection required
- Alternative (ML Kit): heavier, requires Google Play Services, overkill for simple QR

### Why TFLite and not ONNX?
- TFLite is natively supported by Android's Neural Networks API (NNAPI)
- NLClassifier API in TFLite Support Library is purpose-built for text classification
- ONNX runtime on Android is heavier and requires separate runtime setup
- TFLite has hardware acceleration on most Android 8+ devices via NNAPI

---

## PART 10 — DATABASE SCHEMA (Key Tables)

```sql
-- Users
users (id, phone, name, vpa, balance, created_at, last_login)

-- Transactions
transactions (id, sender_vpa, receiver_vpa, amount, status, 
              risk_score, decision, fraud_reason, 
              device_trust_score, call_during_payment,
              created_at)

-- Guardian Links
guardian_links (id, ward_vpa, guardian_vpa, spending_limit, 
                cumulative_spent, status, otp_code, 
                verified_at, created_at)

-- Guardian Requests
guardian_requests (id, ward_vpa, guardian_vpa, amount, 
                   receiver_vpa, risk_score, decision, 
                   status [PENDING/APPROVED/DECLINED],
                   guardian_note, created_at, responded_at)

-- Community Reports
community_reports (id, reporter_vpa, entity_id, entity_type,
                   category, description, trust_penalty,
                   created_at)

-- Entity Trust Scores
entity_trust_scores (entity_id, trust_score, report_count,
                     last_updated)
```

---

## PART 11 — STATE MANAGEMENT

"SentinelPay does not use Redux, MobX, or Zustand. The state architecture is intentionally lean:

1. **Local component state** (useState) — UI state, form fields, loading flags
2. **AsyncStorage** (walletDb.ts) — persistent wallet data, user profile, transaction history
3. **Pub-sub (subscribeWallet)** — cross-screen reactivity. HomeScreen, PaymentsScreen, and AiRiskHistoryScreen all subscribe. When SendMoneyScreen completes a transaction, it calls notifyWalletChanged() — all subscribers reload.
4. **notificationService** — separate pub-sub for notifications
5. **React Navigation state** — navigation stack managed by react-navigation

Why no Redux? For a mobile fintech app of this scale, the overhead of Redux boilerplate outweighs its benefits. The pub-sub pattern achieves the same reactivity with zero external dependency."

---

## PART 12 — SECURITY ARCHITECTURE

### Authentication
- JWT tokens, short expiry (15 min access token, 7-day refresh)
- PIN stored as salted SHA-256 hash in AsyncStorage (device-only)
- Biometrics: react-native-biometrics, hardware-backed key (Keystore/Keychain)

### Payment Security
- UPI PIN entry via UpiPinModal — FLAG_SECURE prevents screenshots
- Amount and VPA validated server-side (never trust client)
- All API calls over HTTPS/TLS 1.3

### Fraud Signal: Call During Payment
- If user is on an active call while initiating a payment → risk_score += 0.25
- Implemented via CallStateManager.java (native Android telephony)
- Reason: 89% of social engineering fraud happens while victim is on a call with scammer

### Rate Limiting
- Redis counter per user: max 5 transfer attempts per minute
- Exponential backoff on failed attempts

---

## PART 13 — NOTIFICATION SYSTEM

```
Backend Event (guardian request, fraud flag, txn confirmed)
        ↓
notificationService.addNotification({type, title, body, payload})
        ↓
In-memory store + AsyncStorage persistence
        ↓
All subscribers notified via pub-sub callback
        ↓
HomeScreen bell badge updates (unread count)
NotificationsScreen list updates
        ↓
OS-level push notification (react-native-push-notification)
```

No Firebase Cloud Messaging in demo — simulated push via local notifications.
Production architecture would use FCM with backend sending tokens.

---

## PART 14 — INFORMATION ARCHITECTURE (V2)

```
Home (Overview)
├── Balance Hero
├── Quick Actions → Send, Receive, Scan, History
├── Guardian Summary → GuardianManagement
├── FraudShield Status → FraudShieldScreen
└── Recent Activity (5 txns) → TransactionHistory

Payments (All Money Movement)
├── Send Money
├── Receive / QR
├── Scan QR
└── Transaction History

FraudShield (All AI Security)
├── AI Risk History
├── Device Trust
├── SMS Shield
├── Scam Assistant
├── Scam Passport
├── Fraud HeatMap
├── Report Fraud
└── Analytics Dashboard

Notifications
└── All alerts, guardian requests, fraud warnings

More (Management)
├── Guardian & Safety (GuardianManagement, Approvals, Verification)
├── Analytics (Ops Dashboard, AI Risk History)
├── Community (Report, HeatMap, Scam Passport)
├── Account (Profile, Security, Device Trust)
└── App (Settings, Help)
```

Design principle: **Every feature has ONE canonical location. No duplication.**

---

## PART 15 — DESIGN SYSTEM

File: src/theme/ds.ts

Tokens:
- C (Colors): 15 semantic color values
- S (Spacing): 8-pt grid, 7 levels
- T (Typography): 10 size steps, 6 weight levels
- R (Radius): 7 levels from xs(8) to full(999)
- shadow: 4 levels (sm/md/lg/hero)
- DS (StyleSheet): 50+ shared style rules

Icons: src/components/AppIcon.tsx — 65+ custom SVG, Lucide-style 2px stroke. Zero external icon libraries.

Global rules enforced:
- One page title per screen
- No emoji in section headings
- All inputs use DS.inputWrapper / DS.inputWrapperFocused
- All buttons 52dp height, DS.btn + DS.btnPrimary/Danger/Outline pattern
- Empty states: DS.emptyCard + DS.emptyIcon + DS.emptyTitle + DS.emptySub

---

## PART 16 — 250+ QUESTION BANK

---

### SECTION A: PRODUCT (1–20)

**Q1. What problem does SentinelPay solve?**
Ideal: UPI fraud is growing rapidly — phishing, fake QR, mule accounts, social engineering. Traditional apps complete payments; SentinelPay prevents fraud before execution using real-time AI scoring.
Common wrong answer: "It's a UPI payment app with extra security."
Why weak: Doesn't articulate the specific fraud problem or why existing apps fail.
Follow-up: Name 3 specific fraud types and how SentinelPay stops each.

**Q2. Who is your target user?**
Ideal: Indian UPI users aged 18–70, particularly those vulnerable to social engineering: senior citizens, first-time digital payment users, small business owners. Secondary: security-conscious tech users.
Follow-up: How do you address digital literacy for senior citizen users?

**Q3. What is your MVP and what's in V2?**
Ideal: MVP = real-time fraud scoring on P2P payments + Guardian system + SMS detection. V2 = 5-tab IA refactor, live AI Risk History, enterprise device trust dashboard, premium UI polish.
Follow-up: What would V3 look like?

**Q4. How is this different from PhonePe's built-in fraud detection?**
Ideal: PhonePe's detection is server-side, opaque, and reactive (flags after money moves). SentinelPay is pre-transaction, explainable (SHAP), multi-signal (device + SMS + graph), and user-centric (Guardian approval model). Also: on-device SMS classification = privacy-preserving.
Follow-up: What data does PhonePe not have access to that you do?

**Q5. What is the Guardian system and why does it matter?**
Ideal: Guardian is a trusted person (parent, spouse) who receives real-time approval requests for high-risk or over-threshold transactions. It addresses the demographic that is most vulnerable — people who can't always identify fraud in real time. One-touch approve/decline.
Follow-up: What if the guardian is also being socially engineered simultaneously?

**Q6. Why did you choose to show risk explanations to users?**
Ideal: Explainability builds trust and user education. A user who sees "flagged because: new merchant + 3 AM + 8x your average spend" learns to recognize suspicious patterns. Purely blocking without explanation frustrates users and erodes trust.
Follow-up: What does RBI say about AI decision transparency in financial products?

**Q7. How do you handle false positives (legitimate transactions blocked)?**
Ideal: User can see the SHAP explanation. If they override with Guardian approval, the transaction proceeds. Over time, LightGBM retrains on approval data to reduce false positives for that user. Rate is tracked in AdminAnalytics dashboard.
Follow-up: What is an acceptable false positive rate for fraud detection in fintech?

**Q8. What happens if the backend is down?**
Ideal: walletDb.ts stores recent transactions locally. If /health returns down, the app shows a degraded-mode banner. Payments can still be attempted; risk score defaults to conservative (medium-risk, requires guardian approval). This prevents both app death AND fraud during outages.
Follow-up: Is allowing payments during backend outage a security risk?

**Q9. Why Emergency Panic Button?**
Ideal: Social engineering fraud often involves the victim being on a call being coerced. The Panic Button is a single-tap emergency freeze that blocks all outbound payments instantly. No navigation, no confirmation dialogs — immediate action.
Follow-up: How do you prevent accidental panic triggers?

**Q10. How does the Scam Passport work?**
Ideal: Any VPA or phone number can be looked up. The system returns: trust score (0–100), number of community reports, fraud category distribution, and historical flag dates. Users can check a recipient before sending money.
Follow-up: What prevents a competitor from falsely reporting legitimate merchants?

**Q11–20:** (Short format)
- Q11: How does community reporting improve the model?
- Q12: What is the Scam HeatMap showing?
- Q13: How does device trust affect fraud scoring?
- Q14: What does the AI Risk History show that a regular transaction history doesn't?
- Q15: What is the Onboarding experience?
- Q16: Why is SMS classification on-device and not cloud?
- Q17: How do notifications work without Firebase in the demo?
- Q18: What happens after a transaction is blocked — can the user appeal?
- Q19: What metrics would you track in production?
- Q20: What is your go-to-market strategy?

---

### SECTION B: REACT NATIVE & MOBILE (21–60)

**Q21. Why React Native over Flutter?**
Ideal: RN allows true native module bridging (Java for SMS/QR) with minimal friction. TypeScript is the same language used in web frontend, reducing context switching. Flutter's Dart has a smaller ML/Android-bridge ecosystem. JSX-based component model is more familiar.
Follow-up: What are RN's weaknesses compared to Flutter?

**Q22. How does React Navigation work in your app?**
Ideal: Stack navigator in App.tsx holds all 32 screens. HomeScreen renders a custom 5-tab bottom nav (not a Tab navigator from react-navigation) — this gives full layout control (floating pill nav, active state animations). Navigating to Payments, FraudShield, Notifications, More pushes those screens onto the stack.
Follow-up: Why a custom tab bar instead of createBottomTabNavigator?

**Q23. Explain your Animated API usage.**
Ideal: Used for: trust gauge SVG arc animation (Animated.Value 0→94 over 1.4s), score bar fills (Animated.timing, 600ms), bell ring animation on new notifications (Animated.sequence of rotations), fade-in stagger on device signals (50ms delay each), chip press spring (Animated.spring).
Follow-up: What is useNativeDriver and why does it matter for 60 FPS?

**Q24. What is useNativeDriver and when can't you use it?**
Ideal: useNativeDriver:true offloads animation to the native thread, avoiding the JS bridge bottleneck. This enables 60 FPS even when JS is busy. Limitation: cannot animate layout properties (width %, flex, top/left as non-transform values). Can only animate: opacity, transform (translateX, translateY, scale, rotate).
Follow-up: How does your score bar animation work around this limitation?

**Q25. Explain walletDb.ts architecture.**
Ideal: AsyncStorage-backed simulated database. Per-user keys keyed by phone number. subscribeWallet() implements pub-sub: HomeScreen, PaymentsScreen, AiRiskHistoryScreen register listeners. When a transaction completes, notifyWalletChanged() fires all listeners. No Redux, no Context API needed. syncCloudTransactions() merges backend transactions with local storage.
Follow-up: What happens if two screens modify balance simultaneously?

**Q26. How do you handle TypeScript types across the app?**
Ideal: src/types/index.ts defines RootStackParamList (all routes + their params), WalletUser, WalletTransaction. AppIcon.tsx exports IconName union type — every icon usage is compile-time type-safe. DS theme tokens are exported as const objects with as const assertion.
Follow-up: What would change if you needed to add a new screen to the navigator?

**Q27. What is the design system and how is it implemented?**
Ideal: src/theme/ds.ts — C (colors), S (spacing), T (typography), R (radius), shadow presets, DS (StyleSheet). All screens import from this file. No inline styles except position-absolute overlays. New developers inherit the entire design language by importing {C, S, T, R, DS}.
Follow-up: How do you enforce that developers don't bypass the design system?

**Q28. Explain useFocusEffect vs useEffect.**
Ideal: useEffect runs on mount/unmount. useFocusEffect runs when the screen gains/loses focus in the navigation stack. AiRiskHistoryScreen uses useFocusEffect to start the walletDb subscription only when visible and clean it up when navigated away — preventing memory leaks and unnecessary re-renders.
Follow-up: What would happen if you used useEffect instead?

**Q29. How do you prevent memory leaks in subscription-heavy screens?**
Ideal: Every subscribeWallet() and notificationService.subscribe() call returns an unsubscribe function. useFocusEffect's cleanup function (the return value) always calls unsubscribe. Interval timers (setInterval for periodic refresh) are stored in refs and cleared in cleanup.
Follow-up: How would you detect a memory leak in a React Native app?

**Q30. What is AsyncStorage and what are its limitations?**
Ideal: Async key-value store for React Native. Backed by SharedPreferences (Android) / NSUserDefaults (iOS). Limitations: synchronous persistence of JS objects (must JSON.stringify/parse), no encryption by default, 6MB per key limit on some platforms, no queries (no indexing). Not suitable for large datasets — use SQLite for that.
Follow-up: How would you store transaction data if you had 10,000+ transactions?

**Q31–60 (abbreviated):**
- Q31: How does UpiPinModal's state machine work?
- Q32: How do you implement a pull-to-refresh?
- Q33: What is the difference between ScrollView and FlatList?
- Q34: When would you use FlatList over ScrollView?
- Q35: How does KeyboardAvoidingView work?
- Q36: How do you handle platform differences (Android vs iOS) in RN?
- Q37: What is StyleSheet.create and why use it over plain objects?
- Q38: How do you test React Native components?
- Q39: What is a Native Module bridge?
- Q40: How does SmsReceiverModule communicate with React Native JS?
- Q41: What is NativeEventEmitter?
- Q42: How does QrDecoderModule work end-to-end?
- Q43: What is ZXing?
- Q44: How do you handle deep linking in React Navigation?
- Q45: How do you handle the Android back button in RN?
- Q46: What is Hermes engine and does your app use it?
- Q47: How does Metro bundler work?
- Q48: What is the difference between debug and release builds?
- Q49: What is FLAG_SECURE in Android?
- Q50: How do you sign an Android APK for release?
- Q51: What is ProGuard and do you use it?
- Q52: How do you handle network errors gracefully?
- Q53: What is the difference between fetch and axios?
- Q54: How do you implement loading and error states?
- Q55: How do you animate a list item appearing?
- Q56: What are the performance implications of setState in a large list?
- Q57: What is React.memo and when would you use it in this app?
- Q58: Explain the Animated.spring configuration in chip press animation.
- Q59: How do you implement a character counter in a TextInput?
- Q60: How does the bottom navigation pill know which tab is active?

---

### SECTION C: PYTHON / FASTAPI / BACKEND (61–100)

**Q61. Why FastAPI over Flask or Django?**
Ideal: FastAPI is async-native (no monkey-patching like Flask + gevent), has automatic Pydantic validation, auto-generates OpenAPI docs, and is 3x faster than Flask on I/O-bound tasks in benchmarks. Django is too heavyweight for a microservice API. FastAPI's type hints make the codebase self-documenting.
Follow-up: What would you use if you needed WebSocket support at scale?

**Q62. How do you handle async operations in FastAPI?**
Ideal: Async endpoints use async def + await. Database calls use SQLAlchemy async session (psycopg3 driver). ML scoring functions are CPU-bound — they run in a ThreadPoolExecutor via asyncio.run_in_executor to avoid blocking the event loop.
Follow-up: What happens if you call a blocking function directly in an async endpoint?

**Q63. How does Pydantic validate your request body?**
Ideal: FastAPI reads the type annotation (e.g., class TransferRequest(BaseModel): sender_vpa: str, amount: float). Pydantic automatically validates type, required fields, and custom validators (e.g., amount > 0). Invalid requests return 422 Unprocessable Entity before business logic runs.
Follow-up: What is the difference between Pydantic v1 and v2?

**Q64. How does JWT authentication work in your app?**
Ideal: Login endpoint returns access_token (JWT signed with HS256, 15 min expiry) and refresh_token (7 days). Protected endpoints use Depends(verify_jwt). JWT payload: {sub: user_id, vpa: string, exp: timestamp}. Refresh endpoint issues new access token when expired.
Follow-up: What would you change to support multi-device login?

**Q65. What is HTTP 423 and why do you return it for guardian-gated transactions?**
Ideal: 423 = Locked. The transaction resource is temporarily locked pending guardian approval. Not 402 (payment problem), not 403 (permanent denial), not 402. 423 is semantically "this request would succeed eventually, but is currently locked."
Follow-up: How does the client distinguish 423 from a network error?

**Q66. How do you implement rate limiting?**
Ideal: Redis counter per user_id with a 60-second TTL window. INCR command (atomic), check if count > threshold before processing. On exceeding limit: return HTTP 429 Too Many Requests with Retry-After header. For payment endpoints: max 5 per minute.
Follow-up: How would you implement distributed rate limiting across multiple backend instances?

**Q67–100 (abbreviated):**
- Q67: How does the Guardian spending limit reset daily?
- Q68: What is SQLAlchemy and why use it over raw SQL?
- Q69: How do you handle database migrations?
- Q70: What is connection pooling and how is it configured?
- Q71: How does Redis TTL work for session tokens?
- Q72: What is the difference between async and sync database drivers?
- Q73: How do you prevent SQL injection?
- Q74: What is Row-Level Security in Supabase?
- Q75: How does the risk score aggregator combine 5 engine outputs?
- Q76: What weights are used in your ensemble?
- Q77: How do you handle model loading at startup?
- Q78: What happens if LightGBM model fails to load?
- Q79: How do you log errors in production?
- Q80: What is CORS and how is it configured?
- Q81: What is the difference between 401 and 403?
- Q82: How does SHAP TreeExplainer work?
- Q83: How do you prevent a user from transferring more than their balance?
- Q84: Is your balance update atomic?
- Q85: What is a race condition in balance updates and how do you prevent it?
- Q86: How do you handle duplicate transaction requests (idempotency)?
- Q87: What is Gunicorn's role?
- Q88: What are Uvicorn workers?
- Q89: How many workers should you run?
- Q90: What is the --timeout parameter in Gunicorn?
- Q91: Why does ML model loading cause startup timeouts?
- Q92: How do you monitor backend health in production?
- Q93: What are async background tasks in FastAPI?
- Q94: How do you write unit tests for a FastAPI endpoint?
- Q95: What is the difference between unit, integration, and E2E tests?
- Q96: How do you test the fraud scoring pipeline?
- Q97: What is a circuit breaker pattern?
- Q98: How would you implement retries with exponential backoff?
- Q99: What is the CAP theorem and where does your system sit?
- Q100: How would you scale the fraud engine to 1 million requests/day?

---

### SECTION D: ML / AI / STATISTICS (101–150)

**Q101. What is the bias-variance tradeoff and how does it affect your model?**
Ideal: High bias = model too simple, underfits (misses fraud patterns). High variance = model too complex, overfits (flags legitimate transactions). LightGBM with regularization (lambda_l1, lambda_l2, min_child_samples) balances this. Isolation Forest has no bias-variance tradeoff in the classical sense — it's unsupervised.
Follow-up: How do you detect overfitting in LightGBM?

**Q102. What is your training dataset?**
Ideal: Combination of: UPI transaction synthetic data (Faker-generated), public fraud datasets (PaySim, Kaggle credit card fraud), manually crafted fraud scenarios. Labels: 0=legitimate, 1=fraud. Class imbalance handled via SMOTE and class_weight.
Follow-up: What are the risks of training on synthetic data?

**Q103. What evaluation metrics do you use and why not just accuracy?**
Ideal: Precision (of flagged transactions, how many were actually fraud), Recall (of all fraud, how many did we catch), F1 score (harmonic mean), AUC-ROC (model discrimination ability). Accuracy is useless at 0.1% fraud rate — a model that always says "legitimate" has 99.9% accuracy.
Follow-up: In fraud detection, which is worse: false positive or false negative?

**Q104. What is Z-score and how is it used?**
Ideal: Z = (x - μ) / σ. For each user, we maintain their historical mean (μ) and standard deviation (σ) of transaction amounts. A new transaction's amount is Z-scored against personal history. Z > 3 (3 standard deviations) = strong anomaly signal. This is personalized — ₹50,000 might be normal for one user and extreme for another.
Follow-up: How do you update μ and σ efficiently as new transactions arrive?

**Q105. What is the Isolation Forest algorithm?**
Ideal: Randomly selects a feature, then randomly selects a split value between min and max of that feature. Repeats until the sample is isolated. Anomalies have shorter average path lengths because they are sparse in feature space. Anomaly score = average path length normalized by expected path length for n samples.
Follow-up: What are the hyperparameters of Isolation Forest?

**Q106. What is gradient boosting?**
Ideal: Ensemble of weak learners (decision trees) trained sequentially. Each tree fits the *residuals* (errors) of the previous ensemble. LightGBM uses leaf-wise tree growth (expands the leaf with maximum delta loss) instead of level-wise (which expands all leaves at a level). This makes LightGBM faster and more accurate on imbalanced data.
Follow-up: What is the learning rate in gradient boosting and what happens if it's too high?

**Q107–150 (abbreviated):**
- Q107: What is SMOTE and why use it for fraud detection?
- Q108: What is the difference between bagging and boosting?
- Q109: What are SHAP Shapley values mathematically?
- Q110: What does a negative SHAP value mean?
- Q111: How do you handle categorical features in LightGBM?
- Q112: What is feature importance vs SHAP values?
- Q113: What is the curse of dimensionality?
- Q114: How many features does your fraud engine use?
- Q115: What is cross-validation?
- Q116: What is k-fold cross-validation?
- Q117: How do you prevent data leakage in fraud model training?
- Q118: What is the difference between recall and precision?
- Q119: If your recall is 85%, what does that mean?
- Q120: If your precision is 72%, what does that mean?
- Q121: What is AUC-ROC?
- Q122: What is a confusion matrix?
- Q123: What is the difference between parametric and non-parametric models?
- Q124: How does NetworkX calculate betweenness centrality?
- Q125: What is a mule account and how does graph analytics detect it?
- Q126: What is graph clustering and how is it used for fraud rings?
- Q127: What is the difference between supervised and unsupervised learning?
- Q128: Why use Isolation Forest alongside LightGBM (not instead of)?
- Q129: What is concept drift in fraud detection?
- Q130: How would you handle concept drift?
- Q131: What is online learning?
- Q132: What is federated learning and could it apply here?
- Q133: What is a feature vector?
- Q134: What is standardization vs normalization?
- Q135: How do you handle missing features at inference time?
- Q136: What is model versioning?
- Q137: What is A/B testing and how would you apply it to fraud models?
- Q138: What is the difference between LightGBM and XGBoost?
- Q139: What is early stopping in LightGBM?
- Q140: What is regularization and what types does LightGBM support?
- Q141: What is a ROC curve?
- Q142: What is the difference between soft voting and hard voting in ensembles?
- Q143: How does your ensemble combine scores (what weighting)?
- Q144: What is an autoencoder anomaly detector and why not use it?
- Q145: What is the difference between parametric anomaly detection and Isolation Forest?
- Q146: Why is the fraud label imbalanced and how severe is it?
- Q147: What is the precision-recall tradeoff?
- Q148: What F1 score would you consider acceptable for production?
- Q149: What is a type I vs type II error in hypothesis testing?
- Q150: How would you evaluate your model's fairness across user demographics?

---

### SECTION E: CYBERSECURITY (151–180)

**Q151. What is a man-in-the-middle attack and how do you prevent it?**
Ideal: Attacker intercepts network traffic between client and server. Prevention: TLS 1.3 with certificate pinning (hardcode the server's certificate hash in the app; reject connections to any server with a different certificate, including proxies). Currently implemented via OkHttp CertificatePinner in Android.

**Q152. What is certificate pinning?**
Ideal: Mobile app includes expected TLS certificate hash (SPKI hash). When connecting to backend, it verifies the certificate matches. Prevents interception even with a trusted-CA-signed certificate on a proxy/Burp Suite. Limitation: certificate renewal requires app update.
Follow-up: How do you handle certificate rotation without breaking the app?

**Q153. What is a SQL injection attack?**
Ideal: Attacker injects SQL syntax into input fields. Prevented by: SQLAlchemy parameterized queries (never string concatenation for SQL). Pydantic input validation also prevents SQL-containing strings from reaching queries.

**Q154. What is OWASP Mobile Top 10 and which items apply to your app?**
Ideal: M1 (Improper Credential Usage) — UPI PIN hashed locally. M2 (Inadequate Supply Chain Security) — open source libraries audited. M4 (Insufficient Input/Output Validation) — Pydantic on backend, TypeScript on frontend. M7 (Binary Protections) — ProGuard/R8 on release builds. M9 (Insecure Data Storage) — sensitive data not in plaintext AsyncStorage.

**Q155–180 (abbreviated):**
- Q155: What is OWASP API Security Top 10?
- Q156: What is a replay attack and how do you prevent it?
- Q157: What is a JWT and what are its security implications?
- Q158: Why not store the JWT in AsyncStorage?
- Q159: What is XSS and does it apply to React Native?
- Q160: What is a CSRF attack?
- Q161: How do you prevent account takeover?
- Q162: What is 2FA and do you implement it?
- Q163: What is biometric spoofing and how does Android prevent it?
- Q164: What is the Android Keystore system?
- Q165: What is FLAG_SECURE and where do you use it?
- Q166: What is root detection and how is it implemented?
- Q167: What is an overlay attack?
- Q168: How do you detect if the app is running in an emulator?
- Q169: What is ADB and why is it a security risk?
- Q170: What is a VPN and why does it affect fraud risk?
- Q171: What is GPS spoofing?
- Q172: What is SIM swapping and how do you detect it?
- Q173: What is the difference between authentication and authorization?
- Q174: What is RBAC?
- Q175: What is OAuth 2.0 and could you use it here?
- Q176: What is PCI DSS and does it apply to your app?
- Q177: What is GDPR and how does on-device SMS processing help?
- Q178: What is end-to-end encryption?
- Q179: What is zero-knowledge proof and could it apply to transaction privacy?
- Q180: What is the India Digital Personal Data Protection Act and how does it affect SentinelPay?

---

### SECTION F: SYSTEM DESIGN (181–220)

**Q181. How would you scale SentinelPay to 10 million users?**
Ideal: Horizontal scaling: stateless FastAPI pods behind a load balancer (AWS ALB). ML models loaded once per pod (not per request). Redis cluster for distributed caching and rate limiting. PostgreSQL with read replicas (writes to primary, reads to replicas). Kafka queue for async fraud processing (decouple payment acceptance from scoring). CDN for static assets.
Follow-up: How would you handle the ML model being a shared state across pods?

**Q182. What is your current bottleneck?**
Ideal: The ML scoring pipeline is CPU-bound. On a single Render instance (512MB, 1 vCPU), LightGBM inference takes 5–10ms but Isolation Forest + NetworkX can take 40–80ms for large graphs. Solution: pre-compute graph metrics, cache recipient trust scores in Redis (TTL 5 min).
Follow-up: What would you cache and what would you not cache?

**Q183. How would you ensure high availability (99.9% uptime)?**
Ideal: Multiple backend instances across availability zones. Health check endpoint (/health) with load balancer monitoring. Database: Supabase managed with automatic failover. Circuit breaker: if scoring fails, default to conservative risk threshold rather than crashing.
Follow-up: What is the difference between availability and reliability?

**Q184. What is a message queue and would you use one?**
Ideal: Message queue (Kafka, RabbitMQ, SQS) decouples producers from consumers. For SentinelPay: guardian notification could be async — payment completes, notification event pushed to queue, notification worker processes it. Current demo is synchronous (same request handles everything).
Follow-up: When would synchronous processing become a problem?

**Q185–220 (abbreviated):**
- Q185: What is the difference between synchronous and asynchronous APIs?
- Q186: What is a microservices architecture? Would you use it here?
- Q187: What is the CAP theorem?
- Q188: What is eventual consistency and where is it acceptable?
- Q189: What is a database index and where would you add one?
- Q190: What is a foreign key constraint?
- Q191: What is an ACID transaction?
- Q192: What is the N+1 query problem?
- Q193: What is connection pooling?
- Q194: What is a distributed lock and when do you need one?
- Q195: What is the two-generals problem?
- Q196: What is idempotency and how do you implement it?
- Q197: What is a CDN?
- Q198: What is horizontal vs vertical scaling?
- Q199: What is a reverse proxy?
- Q200: What is a load balancer?
- Q201: What is blue-green deployment?
- Q202: What is a canary release?
- Q203: What is chaos engineering?
- Q204: What is the difference between latency and throughput?
- Q205: What is Amdahl's Law?
- Q206: What is the difference between SQL and NoSQL?
- Q207: When would you use NoSQL over PostgreSQL?
- Q208: What is sharding?
- Q209: What is a read replica?
- Q210: What is the difference between Redis Pub/Sub and Kafka?
- Q211: What is a webhook?
- Q212: What is a gRPC and when would you use it over REST?
- Q213: What is GraphQL and would it benefit this app?
- Q214: What is a service mesh?
- Q215: How do you monitor a production system?
- Q216: What is distributed tracing?
- Q217: What is an SLA, SLO, and SLI?
- Q218: What is the difference between monitoring and observability?
- Q219: What is a deadlock and how do you prevent it?
- Q220: What is the difference between a process and a thread?

---

### SECTION G: EDGE CASES & HARD QUESTIONS (221–250)

**Q221. What if two concurrent payments race to exhaust the guardian spending limit?**
Ideal: Without a distributed lock, both could pass the limit check before either deducts. Solution: PostgreSQL advisory lock or SELECT FOR UPDATE on the guardian_links row during the limit check + deduction transaction. This serializes concurrent requests for the same guardian relationship.

**Q222. What if the AI model has bias against certain VPAs or regions?**
Ideal: Bias can emerge if training data over-represented fraud from certain geographies. Mitigation: demographic parity evaluation during model training, monitoring precision/recall by region in AdminAnalytics, human review of flagged-but-appealed transactions.

**Q223. What if a user's guardian dies or becomes unavailable?**
Ideal: Guardian relationship has a status field. If guardian doesn't respond within 24 hours, the request can be escalated to a secondary guardian or auto-declined with explanation. User can also remove the guardian from MoreScreen → Guardian.

**Q224. What if someone submits false community reports to maliciously lower a legitimate merchant's trust score?**
Ideal: Community reports require authenticated users (JWT). Reports are rate-limited per user (max 5/day). Trust score updates are weighted — single reports have low impact. Merchants can dispute via a flagged-for-review state. Automated clustering: if 20 reports from the same IP subnet arrive in 1 hour, they're flagged as coordinated attack.

**Q225. What if the TFLite SMS model is reverse-engineered from the APK?**
Ideal: The model is in assets/ — it can be extracted from the APK. Mitigation: model is compressed and obfuscated (TFLite format is binary). For production: use TFLite with model encryption. The model is also not the primary fraud engine — it's a supplement to backend scoring.

**Q226–250 (abbreviated):**
- Q226: How do you handle currency rounding errors in balance arithmetic?
- Q227: What if AsyncStorage data gets corrupted?
- Q228: What if the user uninstalls the app — what happens to wallet data?
- Q229: How do you handle time zone issues in transaction timestamps?
- Q230: What if two users have the same VPA (impossible but what if)?
- Q231: What is your disaster recovery plan?
- Q232: How do you handle a database migration on a live production system?
- Q233: What if Render.com goes down?
- Q234: What if LightGBM produces a NaN score?
- Q235: How do you handle model inference timeout?
- Q236: What is your privacy policy for SMS data?
- Q237: What if a user claims their account was hacked?
- Q238: How do you prove a blocked transaction was correct?
- Q239: What if a competitor builds the same system?
- Q240: What data would you collect for model improvement without violating privacy?
- Q241: How would you implement explainability in an on-device model?
- Q242: What is differential privacy and could you use it?
- Q243: What happens to ML model quality if you remove the graph analytics engine?
- Q244: How would you evaluate the real-world performance of your fraud model?
- Q245: What is your model retraining strategy in production?
- Q246: What if the Android OS version has a vulnerability your app relies on?
- Q247: How do you ensure the Guardian OTP cannot be brute-forced?
- Q248: What if a new fraud technique emerges that no training data covers?
- Q249: What is your strategy for expanding to iOS?
- Q250: If you had 3 more months and a team of 5, what would you build?

---

## PART 17 — PRESENTATION SCRIPTS

### 30-Second Project Introduction
"SentinelPay is an AI-powered UPI fraud prevention platform. While regular UPI apps focus on completing payments, SentinelPay focuses on preventing fraud before money leaves your account. Every transaction is evaluated in under 200 milliseconds by a 6-engine AI system — combining machine learning, behavioral analysis, graph analytics, and device trust signals. High-risk transactions are blocked with an explanation. Medium-risk ones are sent to a Guardian — a trusted person who can approve or decline in real time. The system also detects SMS scams on-device, maintains a community fraud database, and shows users exactly why a transaction was flagged."

### 2-Minute Elevator Pitch
"India's UPI ecosystem processes over 12 billion transactions monthly, but fraud is growing faster than detection can keep up. The problem isn't a lack of payment infrastructure — it's a lack of intelligent protection at the point of transaction.

SentinelPay is our answer. It's an AI-powered fraud prevention platform built on top of UPI. The core innovation is a 6-engine fraud pipeline: rule-based detection for known patterns, behavioral Z-score for personal anomalies, Isolation Forest for novel fraud detection, LightGBM as the supervised ML engine, NetworkX graph analytics to detect mule account networks, and SHAP for explainability.

Every transaction gets a 0-to-1 risk score in under 200 milliseconds. Below 0.3 — approved instantly. Between 0.3 and 0.7 — routed to a Guardian, a trusted person the user designates, who can approve or decline in real time. Above 0.7 — hard blocked with a plain-English explanation of exactly why.

Beyond the core payment flow, we've built: on-device SMS fraud classification using TFLite so SMS content never leaves the phone, a community scam reporting system that feeds back into the AI model, a device trust dashboard tracking 14 hardware security signals, and an emergency panic button that freezes the wallet in one tap.

The stack is React Native with TypeScript, FastAPI with Python, PostgreSQL on Supabase, Redis for caching, and native Android Java modules for SMS and QR. Deployed on Render.

What we're presenting today is a fully functional demo with a live backend, not a prototype."

### 5-Minute Presentation Script
[Opening — 30s]
"Good [morning/afternoon]. I'm presenting SentinelPay — an AI-powered UPI fraud prevention platform. I'll cover the problem, the solution, the architecture, the AI pipeline, and a live demo in 5 minutes."

[Problem — 45s]
"UPI has 300 million active users and processes ₹20 lakh crore monthly. But fraud is accelerating — phishing, fake QR codes, mule accounts, social engineering, OTP theft. Every major UPI app has fraud detection, but it's reactive — it flags transactions after money has moved. We prevent fraud before money leaves the account."

[Solution — 60s]
"SentinelPay wraps every payment in a 6-engine AI evaluation: Rule Engine catches known patterns, Behavioral Z-score detects personal anomalies, Isolation Forest catches novel attacks, LightGBM is our primary ML classifier, NetworkX graph analytics detects fraud networks, and SHAP explains every decision in plain English. The result: an approve/guardian/block decision in under 200ms."

[Architecture — 60s]
"React Native Android frontend, FastAPI Python backend on Render, Supabase PostgreSQL + Redis. Native Android Java modules for on-device SMS classification via TFLite and QR scanning via ZXing. The design system is a single ds.ts file — 32 screens all inheriting the same visual language."

[Key Features — 60s]
"Beyond payments: Guardian System — designate a trusted person who approves high-risk transactions. SMS Shield — on-device TFLite classifier, no SMS data leaves the phone. Scam Passport — look up any VPA or phone number and see their fraud history. Community Reporting — crowdsourced signals that improve the model. Device Trust Dashboard — 14 hardware security signals. Emergency Panic Button — one-tap wallet freeze."

[Demo — 30s]
"Let me show you a transaction in real time. [Demo: send money to new recipient, AI flags it, shows SHAP explanation, Guardian notification fires.] And here's the Guardian approving from their phone."

[Closing — 15s]
"SentinelPay demonstrates that fraud prevention can be real-time, explainable, privacy-preserving, and user-centric. Thank you."

---

## PART 18 — ARCHITECTURE EXPLANATION (For Technical Panel)

"The system has three layers.

Layer 1 — Mobile: React Native with TypeScript. 32 screens using a unified design system. Native Android Java modules bridge to the JS layer via NativeEventEmitter for real-time SMS events and ZXing for QR decoding. State is managed through a pub-sub pattern using subscribeWallet() and AsyncStorage as the persistence layer. No Redux — the pub-sub covers all cross-screen reactivity needs.

Layer 2 — API: FastAPI on Python. Async endpoints, Pydantic v2 validation, JWT auth. The fraud scoring pipeline runs inside the /transfer endpoint. CPU-bound ML operations run in a ThreadPoolExecutor to avoid blocking the async event loop. Guardian operations use PostgreSQL row-level locking to prevent race conditions on spending limits.

Layer 3 — Data: Supabase PostgreSQL for durable storage with ACID transactions for balance updates. Redis for hot data: trust scores (TTL 5 min), session tokens (TTL 15 min), rate limit counters. Redis reduces PostgreSQL read load by approximately 70% for trust score lookups."

---

## PART 19 — AI EXPLANATION (For ML/AI Panel)

"The fraud engine is a heterogeneous ensemble — not a single model, but 5 detection mechanisms with a weighted aggregator.

The Rule Engine fires first — sub-1ms — catching known fraud signatures: amounts near reporting thresholds, known scammer VPAs, impossible transaction velocities. No ML needed for known patterns.

The Behavioral Engine computes a Z-score: how many standard deviations is this transaction's amount from this specific user's historical mean? A ₹50,000 transaction might score Z=1.2 for a business user (normal) but Z=8.4 for a student (extreme anomaly). This personalization is critical.

Isolation Forest runs next — unsupervised. It randomly partitions the feature space. Anomalies are isolated faster (shorter path lengths). The key advantage: it catches fraud patterns not present in training data. Concept drift resilience.

LightGBM is the supervised precision engine. Trained on labeled fraud data, leaf-wise gradient boosting, categorical feature support, sub-10ms inference. This is the highest-weight component (45%) because it has the highest precision on known fraud types.

NetworkX graph analytics maintains a transaction graph. We compute betweenness centrality, clustering coefficient, and proximity to reported fraud nodes. Mule accounts — accounts that receive stolen money and forward it — have high betweenness centrality. This catches fraud rings that individual transaction analysis would miss.

SHAP's TreeExplainer runs post-decision: it decomposes the LightGBM output into additive feature contributions. The top 3 contributors are presented to the user in plain English. This satisfies explainable AI requirements and helps users understand why they were flagged."

---

## PART 20 — MOCK VIVA MODE INSTRUCTIONS

To enter Mock Viva: Tell the AI assistant "START MOCK VIVA"
To end: Type "END MOCK VIVA"

In Mock Viva, the evaluator:
1. Asks ONE question at a time
2. Waits for your full answer
3. Scores it 1–10 on: Technical Correctness, Confidence, Depth, Communication, Industry Awareness
4. Points out exactly what was weak and why
5. Asks 1–2 follow-up questions before moving on
6. Escalates difficulty based on your performance

Scoring bands:
- 9–10: Expert level. Production engineer / PhD candidate answer.
- 7–8: Strong candidate. Minor gaps but solid fundamentals.
- 5–6: Adequate. Understands surface but not internals. Cannot defend under pressure.
- 3–4: Concerning. Memorised buzzwords without understanding.
- 1–2: Cannot defend this project. Needs fundamental revision.

---

*End of SentinelPay Demo Day Preparation Guide*
*Version: 2.2 · July 2026*
