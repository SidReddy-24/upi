# Design Document: SMS Tracker

## Overview

The SMS Tracker feature provides comprehensive fraud detection for SMS messages on Android devices through a multi-layered architecture. The system combines on-device machine learning, efficient local storage, real-time monitoring, and user-friendly visualization to protect users from SMS-based scams and phishing attempts.

### Architecture Principles

1. **Privacy-First**: All SMS processing occurs 100% on-device using TensorFlow Lite. No SMS content is ever transmitted to external servers.
2. **Progressive Enhancement**: The system gracefully handles permission denials, providing functionality based on granted permissions.
3. **Performance-Optimized**: Batch processing for historical scans with sub-200ms real-time classification ensures responsive user experience.
4. **Integration-Ready**: Seamlessly integrates with existing SmsReceiverModule, SmsClassifier, and payment fraud detection infrastructure.
5. **Resource-Conscious**: Efficient memory usage, background processing optimization, and minimal battery impact.

### Core Capabilities

- **Historical SMS Scanning**: One-time full device scan on first launch, processing messages in batches of 50
- **Real-Time Monitoring**: Continuous background SMS interception with immediate fraud classification
- **ML-Powered Classification**: TensorFlow Lite-based fraud detection returning scores from 0.0 (genuine) to 1.0 (fraud)
- **Local Storage**: AsyncStorage-based persistence for classified messages with efficient querying
- **Multi-View UI**: List view with filtering (All/Fraud/Suspicious/Genuine) and detailed message analysis
- **Intelligent Notifications**: Contextual alerts for high-risk messages with actionable responses
- **Integration Points**: Exposes fraud statistics to existing payment flow for enhanced transaction risk scoring


## Architecture

### System Components

The SMS Tracker is composed of five main subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                         SMS Tracker System                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐     ┌─────────────────────────────┐      │
│  │  Permission       │────▶│  Historical Scanner         │      │
│  │  Manager          │     │  (First Launch Batch)       │      │
│  └──────────────────┘     └─────────────────────────────┘      │
│           │                                                       │
│           │                ┌─────────────────────────────┐      │
│           └───────────────▶│  Real-Time Monitor          │      │
│                            │  (Background Receiver)       │      │
│                            └─────────────────────────────┘      │
│                                       │                          │
│                                       ▼                          │
│                            ┌─────────────────────────────┐      │
│                            │  SMS Classifier             │      │
│                            │  (TFLite on-device ML)      │      │
│                            └─────────────────────────────┘      │
│                                       │                          │
│                                       ▼                          │
│                            ┌─────────────────────────────┐      │
│                            │  SMS Database               │      │
│                            │  (AsyncStorage + Index)     │      │
│                            └─────────────────────────────┘      │
│                                       │                          │
│           ┌───────────────────────────┼────────────────┐        │
│           ▼                           ▼                ▼        │
│  ┌────────────────┐     ┌────────────────┐  ┌─────────────┐   │
│  │  SMS List UI   │     │  SMS Detail UI │  │ Notification│   │
│  │  (Filter/Sort) │     │  (Analysis)    │  │  Manager    │   │
│  └────────────────┘     └────────────────┘  └─────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```


### Component Responsibilities

#### 1. Permission Manager (`SmsPermissionManager`)
- **Purpose**: Centralized permission handling for READ_SMS and RECEIVE_SMS
- **Location**: TypeScript service (`src/services/smsPermissionService.ts`)
- **Responsibilities**:
  - Request READ_SMS permission with explanatory dialog
  - Request RECEIVE_SMS permission with explanatory dialog
  - Check current permission status
  - Provide system settings navigation for manual permission grants
  - Emit permission change events to trigger component initialization

#### 2. Historical Scanner (`HistoricalSmsScanner`)
- **Purpose**: One-time full device SMS scan on first launch
- **Location**: TypeScript service integrated into `src/services/smsTrackerService.ts`
- **Responsibilities**:
  - Read all messages from Android SMS content provider (`content://sms/inbox`)
  - Extract sender, body, timestamp, and message ID
  - Process messages in batches of 50 to prevent UI blocking
  - Delegate classification to SmsClassifier via native bridge
  - Store classified messages in SMS Database
  - Track scan progress and emit completion events
  - Handle errors gracefully and continue processing remaining messages


#### 3. Real-Time Monitor (`RealTimeSmsMonitor`)
- **Purpose**: Continuous background SMS interception and classification
- **Location**: Existing `SmsReceiverModule.java` with TypeScript coordinator
- **Responsibilities**:
  - Register Android BroadcastReceiver for `SMS_RECEIVED` intent
  - Extract SMS data (sender, body, timestamp) from broadcast
  - Classify message using SmsClassifier.java (target: <200ms)
  - Store classified message in SMS Database
  - Emit events to React Native layer via DeviceEventEmitter
  - Trigger notifications for high-risk messages (fraud score ≥ 0.7)
  - Persist across app restarts and device reboots
  - Unregister receiver on app destruction or permission revocation

#### 4. SMS Classifier (`SmsClassifier`)
- **Purpose**: On-device ML-based fraud detection
- **Location**: Existing `SmsClassifier.java` (reused)
- **Responsibilities**:
  - Load `spam_classifier.tflite` model from Android assets
  - Accept message body as input string
  - Return fraud score between 0.0 (genuine) and 1.0 (fraud)
  - Complete classification within 100ms per message
  - Handle model loading failures gracefully (return 0.0 default)
  - Perform inference without network requests
  - Support batch classification for historical scan optimization


#### 5. SMS Database (`SmsDatabase`)
- **Purpose**: Local persistent storage for classified messages
- **Location**: TypeScript utility (`src/utils/smsDb.ts`)
- **Responsibilities**:
  - Store messages with schema: `{id, sender, body, timestamp, fraudScore, classification, markedSafe}`
  - Use AsyncStorage for persistence (following existing walletDb pattern)
  - Generate unique message IDs: `${sender}_${timestamp}` combination
  - Implement efficient retrieval by classification type (fraud/suspicious/genuine)
  - Support date range queries for analytics
  - Provide pagination for large result sets (batches of 50)
  - Support CRUD operations: create, read, update (mark safe), delete (clear all)
  - Handle AsyncStorage failures with retry logic (3 attempts with exponential backoff)

#### 6. SMS List UI (`SmsListScreen`)
- **Purpose**: Main view for browsing all SMS messages with fraud indicators
- **Location**: React Native screen (`src/screens/SmsListScreen.tsx`)
- **Responsibilities**:
  - Display FlatList of messages with virtual scrolling
  - Show message preview (first 50 characters), sender, timestamp, fraud badge
  - Implement filter tabs: All, Fraud (≥0.7), Suspicious (0.4-0.7), Genuine (<0.4)
  - Sort messages by timestamp descending (newest first)
  - Implement infinite scroll pagination (load 50 at a time)
  - Navigate to detail view on message tap
  - Show stats bar: total scanned, fraud count, suspicious count, genuine count
  - Display permission prompt if READ_SMS not granted


#### 7. SMS Detail UI (`SmsDetailScreen`)
- **Purpose**: Full message analysis with fraud explanation
- **Location**: React Native screen (`src/screens/SmsDetailScreen.tsx`)
- **Responsibilities**:
  - Display complete message body (no truncation)
  - Show sender, full timestamp, fraud score as percentage
  - Display color-coded classification badge (red=fraud, orange=suspicious, green=genuine)
  - Show visual fraud score meter (0-100% with gradient)
  - Display fraud warning indicators for high-risk messages (score ≥ 0.7)
  - Provide "Report as Fraud" button linking to existing ReportScamScreen
  - Provide "Mark as Safe" button to override classification
  - Update classification in database when marked safe
  - Show fraud explanation text for educational purposes

#### 8. Notification Manager (`SmsNotificationManager`)
- **Purpose**: Alert system for high-risk SMS detection
- **Location**: TypeScript service (`src/services/smsNotificationService.ts`)
- **Responsibilities**:
  - Display in-app banner notifications for fraud messages (score ≥ 0.7)
  - Show sender, fraud percentage, and "View Details" action
  - Group notifications when multiple fraud messages arrive within 5 minutes
  - Auto-dismiss banner alerts after 5 seconds
  - Display Android system notifications for critical fraud (score ≥ 0.85) when app in background
  - Provide settings toggle to enable/disable notifications
  - Continue classification silently when notifications disabled
  - Handle notification taps to navigate to message detail view


### Data Flow

#### Historical Scan Flow (First Launch)

```
User launches app for first time
       │
       ▼
Permission Manager requests READ_SMS
       │
       ├─▶ Denied ───▶ Show limited functionality message
       │
       ▼ Granted
Historical Scanner initializes
       │
       ▼
Read all messages from content://sms/inbox
       │
       ▼
Split into batches of 50 messages
       │
       ▼
For each batch:
   │
   ├─▶ Extract (sender, body, timestamp, id)
   │
   ├─▶ Call SmsClassifier.classify(body) ───▶ Returns fraudScore
   │
   ├─▶ Determine classification:
   │      • fraudScore ≥ 0.7 → "fraud"
   │      • 0.4 ≤ fraudScore < 0.7 → "suspicious"
   │      • fraudScore < 0.4 → "genuine"
   │
   ├─▶ Store in SMS Database
   │
   └─▶ Update progress counter
       │
       ▼
Emit completion event with total count
       │
       ▼
Update UI with scan results
```


#### Real-Time Monitoring Flow

```
App launches or comes to foreground
       │
       ▼
Permission Manager checks RECEIVE_SMS
       │
       ├─▶ Denied ───▶ Show permission request dialog
       │
       ▼ Granted
Real-Time Monitor registers BroadcastReceiver
       │
       ▼
Listening for SMS_RECEIVED broadcasts...
       │
       ▼ (New SMS arrives)
SmsReceiverModule.onReceive() triggered
       │
       ▼
Extract SMS data:
   • sender = getOriginatingAddress()
   • body = getMessageBody()
   • timestamp = getTimestampMillis()
       │
       ▼
Call SmsClassifier.classify(body) ───▶ Returns fraudScore (< 200ms)
       │
       ▼
Create message object with fraudScore
       │
       ▼
Store in SMS Database
       │
       ▼
Emit 'onSmsReceived' event to React Native
       │
       ├─▶ Update SMS List UI if visible
       │
       └─▶ Check if fraudScore ≥ 0.7
              │
              ▼ Yes
           Notification Manager displays alert:
              • In-app banner if app active
              • System notification if app background & score ≥ 0.85
              • Include sender, fraud %, "View Details" action
```


#### Payment Integration Flow

```
User initiates payment in SendMoneyScreen
       │
       ▼
Payment flow requests SMS fraud statistics
       │
       ▼
SMS Database queries:
   • Count of fraud messages in last 24 hours
   • Highest fraud score in last 1 hour
       │
       ▼
Return statistics object: {
   fraudCount24h: number,
   maxFraudScore1h: number
}
       │
       ▼
Payment fraud engine incorporates SMS signals:
   • High fraud SMS activity → increase transaction risk
   • Recent high-fraud SMS → flag for review
       │
       ▼
Enhanced transaction risk score returned
```


## Components and Interfaces

### Native Android Components

#### SmsReceiverModule (Existing - Enhanced)

**File**: `android/app/src/main/java/com/sentinelpay/SmsReceiverModule.java`

**Current Capabilities**:
- BroadcastReceiver registration for SMS_RECEIVED
- SMS extraction and TFLite classification
- Event emission to React Native

**Enhancement Required**: None - already provides all needed functionality

**Interface**:
```java
@ReactMethod
public void startListening()

@ReactMethod
public void stopListening()

// Emits to React Native:
// Event: "onSmsReceived"
// Payload: {sender: string, body: string, timestamp: number, fraudScore: number}
```

#### SmsClassifier (Existing - Reused)

**File**: `android/app/src/main/java/com/sentinelpay/SmsClassifier.java`

**Current Capabilities**:
- Load spam_classifier.tflite from assets
- Classify text and return fraud probability 0.0-1.0

**Enhancement Required**: None - meets all requirements

**Interface**:
```java
public SmsClassifier(Context context)
public float classify(String text)
public void close()
```


#### SmsContentReader (New Native Module)

**File**: `android/app/src/main/java/com/sentinelpay/SmsContentReaderModule.java`

**Purpose**: Read historical SMS from device inbox

**Interface**:
```java
@ReactMethod
public void readAllSms(Promise promise)
// Returns: Promise<SmsMessage[]>
// where SmsMessage = {id: string, sender: string, body: string, timestamp: number}

@ReactMethod
public void readSmsInDateRange(double startTimestamp, double endTimestamp, Promise promise)
// Returns: Promise<SmsMessage[]>
```

**Implementation Details**:
- Query `content://sms/inbox` using ContentResolver
- Cursor columns: `_id`, `address`, `body`, `date`
- Cursor ordered by `date DESC` (newest first)
- Return array of message objects
- Handle permissions internally - throw if READ_SMS not granted
- Handle cursor pagination for large message counts


### TypeScript Services

#### SmsTrackerService

**File**: `src/services/smsTrackerService.ts`

**Purpose**: Main orchestrator for SMS tracking functionality

**Interface**:
```typescript
class SmsTrackerService {
  // Initialization and lifecycle
  async initialize(): Promise<void>
  async requestPermissions(): Promise<{readSms: boolean, receiveSms: boolean}>
  
  // Historical scanning
  async startHistoricalScan(): Promise<void>
  isScanning(): boolean
  getScanProgress(): {current: number, total: number, percentage: number}
  
  // Real-time monitoring
  startRealTimeMonitoring(): void
  stopRealTimeMonitoring(): void
  isMonitoring(): boolean
  
  // Event subscriptions
  onScanProgress(callback: (progress: ScanProgress) => void): UnsubscribeFn
  onScanComplete(callback: (result: ScanResult) => void): UnsubscribeFn
  onNewMessage(callback: (message: ClassifiedSms) => void): UnsubscribeFn
  
  // Integration with payment flow
  async getSmsStatistics(): Promise<SmsStatistics>
}

interface ScanProgress {
  current: number;
  total: number;
  percentage: number;
}

interface ScanResult {
  totalScanned: number;
  fraudCount: number;
  suspiciousCount: number;
  genuineCount: number;
  duration: number;
}

interface SmsStatistics {
  fraudCount24h: number;
  maxFraudScore1h: number;
}
```


#### SmsPermissionService

**File**: `src/services/smsPermissionService.ts`

**Purpose**: Centralized SMS permission management

**Interface**:
```typescript
class SmsPermissionService {
  async checkReadSmsPermission(): Promise<boolean>
  async checkReceiveSmsPermission(): Promise<boolean>
  
  async requestReadSmsPermission(): Promise<boolean>
  async requestReceiveSmsPermission(): Promise<boolean>
  async requestAllPermissions(): Promise<{readSms: boolean, receiveSms: boolean}>
  
  openAppSettings(): void
  
  onPermissionChange(callback: (permissions: PermissionStatus) => void): UnsubscribeFn
}

interface PermissionStatus {
  readSms: boolean;
  receiveSms: boolean;
}
```

**Implementation Notes**:
- Use `PermissionsAndroid` API from React Native
- Show rationale dialogs before requesting permissions
- Store permission status in memory (don't persist - check on demand)
- Emit events when permissions change (app resume, settings return)


#### SmsNotificationService

**File**: `src/services/smsNotificationService.ts`

**Purpose**: Fraud alert notification system

**Interface**:
```typescript
class SmsNotificationService {
  async sendFraudAlert(message: ClassifiedSms): Promise<void>
  async sendSuspiciousAlert(message: ClassifiedSms): Promise<void>
  
  isNotificationsEnabled(): boolean
  setNotificationsEnabled(enabled: boolean): Promise<void>
  
  clearAllNotifications(): void
}
```

**Implementation Notes**:
- Use `react-native-push-notification` (already installed)
- Channel ID: `sentinelpay-sms-fraud`
- In-app banner: custom React component with 5s auto-dismiss
- System notification: only when app in background AND fraudScore ≥ 0.85
- Notification grouping: track fraud messages within 5-minute window
- Action buttons: "View Details", "Mark as Safe", "Dismiss"


### Data Storage

#### SmsDatabase Utility

**File**: `src/utils/smsDb.ts`

**Purpose**: AsyncStorage wrapper for SMS data persistence

**Schema**:
```typescript
interface StoredSms {
  id: string;              // Format: `${sender}_${timestamp}`
  sender: string;          // Phone number or sender ID
  body: string;            // Full message content
  timestamp: number;       // Unix timestamp in milliseconds
  fraudScore: number;      // 0.0 to 1.0
  classification: 'fraud' | 'suspicious' | 'genuine';
  markedSafe: boolean;     // User override flag
  scannedAt: number;       // When message was classified
}

interface SmsDbStats {
  totalMessages: number;
  fraudCount: number;
  suspiciousCount: number;
  genuineCount: number;
  markedSafeCount: number;
}
```


**Interface**:
```typescript
// CRUD operations
async function storeSms(sms: StoredSms): Promise<void>
async function getAllSms(): Promise<StoredSms[]>
async function getSmsById(id: string): Promise<StoredSms | null>
async function updateSms(id: string, updates: Partial<StoredSms>): Promise<void>
async function deleteSms(id: string): Promise<void>
async function clearAllSms(): Promise<void>

// Query operations
async function getSmsByClassification(
  classification: 'fraud' | 'suspicious' | 'genuine',
  limit?: number,
  offset?: number
): Promise<StoredSms[]>

async function getSmsInDateRange(
  startTimestamp: number,
  endTimestamp: number
): Promise<StoredSms[]>

async function searchSms(query: string): Promise<StoredSms[]>

// Statistics
async function getSmsStats(): Promise<SmsDbStats>
async function getFraudCountInLast24Hours(): Promise<number>
async function getMaxFraudScoreInLastHour(): Promise<number>

// User actions
async function markSmsAsSafe(id: string): Promise<void>
async function unmarkSmsAsSafe(id: string): Promise<void>
```


**Storage Strategy**:

AsyncStorage keys:
- `sentinelpay_sms_messages`: Main message array (paginated loading)
- `sentinelpay_sms_index_fraud`: Array of IDs for fraud messages
- `sentinelpay_sms_index_suspicious`: Array of IDs for suspicious messages
- `sentinelpay_sms_index_genuine`: Array of IDs for genuine messages
- `sentinelpay_sms_stats`: Cached statistics object
- `sentinelpay_sms_scan_status`: First scan completion flag

**Performance Optimizations**:
1. **Lazy Loading**: Load messages in batches of 50 using offset/limit
2. **Index Arrays**: Maintain separate index arrays per classification for O(1) filtered queries
3. **Stats Caching**: Update stats incrementally on new messages instead of full recalculation
4. **Background Processing**: Use `InteractionManager.runAfterInteractions()` for heavy operations
5. **Retry Logic**: 3 attempts with exponential backoff (100ms, 200ms, 400ms) for AsyncStorage failures

**Memory Management**:
- Maximum 1000 messages in memory at once
- Pagination for large datasets
- Automatic memory release after screen unmount

