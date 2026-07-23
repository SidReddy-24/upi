# Requirements Document

## Introduction

The SMS Tracker feature provides comprehensive SMS fraud detection for the SentinelPay Android app. The system reads all historical SMS messages on first launch, continuously monitors incoming messages in real-time, and uses on-device TensorFlow Lite machine learning to classify each message as fraud or genuine. The feature integrates with the existing SmsClassifier.java and provides a dedicated UI for viewing all SMS with their fraud scores. All processing occurs 100% on-device to preserve user privacy.

## Glossary

- **SMS_Tracker**: The comprehensive SMS monitoring and fraud detection system
- **Historical_Scanner**: Component that reads all existing SMS messages from the device on first launch
- **Real_Time_Monitor**: Component that listens for and processes incoming SMS messages continuously
- **SMS_Classifier**: Existing TensorFlow Lite-based fraud detection algorithm (SmsClassifier.java)
- **SMS_Database**: Local AsyncStorage database storing SMS records with fraud scores
- **SMS_UI**: User interface screens for viewing and managing tracked SMS messages
- **Fraud_Score**: Numerical value (0.0-1.0) indicating likelihood of SMS being fraudulent
- **Classification_Result**: Object containing fraud_score, classification (fraud/genuine), and timestamp
- **SMS_Permission_Manager**: Component handling READ_SMS and RECEIVE_SMS Android permissions
- **Notification_Manager**: Component displaying in-app notifications for fraud detection results
- **First_Launch**: Initial app installation or first time SMS tracker feature is enabled

## Requirements

### Requirement 1: Historical SMS Scanning on First Launch

**User Story:** As a user, I want the app to scan all my existing SMS messages when I first install it, so that I can see fraud detection results for my entire SMS history.

#### Acceptance Criteria

1. WHEN First_Launch occurs AND READ_SMS permission is granted, THE Historical_Scanner SHALL read all existing SMS messages from the device inbox
2. WHEN Historical_Scanner reads existing messages, THE Historical_Scanner SHALL extract sender, body, and timestamp for each message
3. FOR EACH historical SMS message, THE SMS_Classifier SHALL compute a Fraud_Score between 0.0 and 1.0
4. WHEN a historical message is classified, THE SMS_Tracker SHALL store the message with its Classification_Result in SMS_Database
5. WHEN Historical_Scanner processes messages, THE SMS_Tracker SHALL process messages in batches of 50 to prevent UI blocking
6. WHEN Historical_Scanner completes processing, THE SMS_Tracker SHALL emit a completion event with total message count
7. IF Historical_Scanner encounters an error reading messages, THEN THE SMS_Tracker SHALL log the error and continue with remaining messages

### Requirement 2: Real-Time SMS Monitoring

**User Story:** As a user, I want the app to automatically detect and analyze incoming SMS messages in real-time, so that I can be immediately alerted to potential fraud.

#### Acceptance Criteria

1. WHEN the app launches AND RECEIVE_SMS permission is granted, THE Real_Time_Monitor SHALL register a broadcast receiver for incoming SMS
2. WHEN an SMS is received, THE Real_Time_Monitor SHALL extract sender, body, and timestamp immediately
3. WHEN Real_Time_Monitor receives a new SMS, THE SMS_Classifier SHALL classify the message within 200 milliseconds
4. WHEN a new SMS is classified, THE SMS_Tracker SHALL store the message with its Classification_Result in SMS_Database
5. WHEN a new SMS is classified as fraud (Fraud_Score >= 0.7), THE Notification_Manager SHALL display an in-app notification
6. WHEN Real_Time_Monitor is active, THE SMS_Tracker SHALL continue monitoring until the app is destroyed or permissions are revoked
7. IF Real_Time_Monitor encounters an error processing a message, THEN THE SMS_Tracker SHALL log the error and continue monitoring

### Requirement 3: SMS Permission Management

**User Story:** As a user, I want clear permission requests for SMS access, so that I understand why the app needs these permissions and can grant them appropriately.

#### Acceptance Criteria

1. WHEN the SMS tracker feature is accessed for the first time, THE SMS_Permission_Manager SHALL request READ_SMS permission with explanatory dialog
2. WHEN READ_SMS permission is granted, THE SMS_Permission_Manager SHALL request RECEIVE_SMS permission with explanatory dialog
3. WHEN both permissions are granted, THE SMS_Tracker SHALL enable Historical_Scanner and Real_Time_Monitor
4. IF READ_SMS permission is denied, THEN THE SMS_Permission_Manager SHALL display a message explaining limited functionality and SHALL NOT enable Historical_Scanner
5. IF RECEIVE_SMS permission is denied, THEN THE SMS_Permission_Manager SHALL display a message explaining real-time monitoring will not work and SHALL NOT enable Real_Time_Monitor
6. WHEN permissions are granted after initial denial, THE SMS_Tracker SHALL automatically initialize enabled components
7. THE SMS_Permission_Manager SHALL provide a settings link for users to manage permissions in system settings

### Requirement 4: SMS Classification with TFLite Model

**User Story:** As a user, I want accurate fraud detection using machine learning, so that I can trust the fraud scores shown for my messages.

#### Acceptance Criteria

1. WHEN SMS_Classifier is initialized, THE SMS_Classifier SHALL load the spam_classifier.tflite model from device assets
2. WHEN SMS_Classifier receives a message body for classification, THE SMS_Classifier SHALL return a Fraud_Score between 0.0 and 1.0
3. WHEN Fraud_Score is computed, THE SMS_Classifier SHALL complete classification within 100 milliseconds per message
4. WHEN Fraud_Score is >= 0.7, THE SMS_Tracker SHALL mark the message as "fraud" classification
5. WHEN Fraud_Score is < 0.7 AND >= 0.4, THE SMS_Tracker SHALL mark the message as "suspicious" classification
6. WHEN Fraud_Score is < 0.4, THE SMS_Tracker SHALL mark the message as "genuine" classification
7. THE SMS_Classifier SHALL perform all classification on-device without network requests
8. IF SMS_Classifier fails to load the model, THEN THE SMS_Tracker SHALL log the error and assign default Fraud_Score of 0.0

### Requirement 5: Local SMS Data Storage

**User Story:** As a user, I want my SMS data and fraud scores stored locally on my device, so that my privacy is protected and I can access results offline.

#### Acceptance Criteria

1. WHEN a message is classified, THE SMS_Database SHALL store sender, body, timestamp, Fraud_Score, and classification
2. WHEN storing messages, THE SMS_Database SHALL use AsyncStorage for persistence
3. WHEN storing messages, THE SMS_Database SHALL index messages by unique message ID (sender + timestamp combination)
4. WHEN SMS_Database stores messages, THE SMS_Database SHALL support efficient retrieval by classification type (fraud/suspicious/genuine)
5. WHEN SMS_Database stores messages, THE SMS_Database SHALL support efficient retrieval by date range
6. THE SMS_Database SHALL store all data locally without cloud synchronization
7. WHEN the user clears app data, THE SMS_Database SHALL remove all stored SMS records
8. WHEN SMS_Database queries exceed 1000 records, THE SMS_Database SHALL return results in paginated batches of 50

### Requirement 6: SMS List View UI

**User Story:** As a user, I want to view all my SMS messages with their fraud scores in an organized list, so that I can review suspicious messages and take action.

#### Acceptance Criteria

1. WHEN the SMS tracker screen opens, THE SMS_UI SHALL display a list of all stored SMS messages
2. WHEN displaying messages, THE SMS_UI SHALL show sender, message preview (first 50 characters), timestamp, and fraud badge
3. WHEN displaying fraud badges, THE SMS_UI SHALL use red badge for fraud, orange badge for suspicious, green badge for genuine
4. WHEN displaying the list, THE SMS_UI SHALL sort messages by timestamp descending (newest first)
5. WHEN the message list contains more than 50 messages, THE SMS_UI SHALL implement infinite scroll pagination
6. THE SMS_UI SHALL provide filter tabs for "All", "Fraud", "Suspicious", and "Genuine" messages
7. WHEN a filter tab is selected, THE SMS_UI SHALL update the list to show only matching messages within 100 milliseconds
8. WHEN the user taps a message in the list, THE SMS_UI SHALL navigate to the detailed message view

### Requirement 7: SMS Detail View UI

**User Story:** As a user, I want to see the full details of an SMS message including the complete fraud analysis, so that I can make informed decisions about suspicious messages.

#### Acceptance Criteria

1. WHEN the detail view opens, THE SMS_UI SHALL display the complete message body
2. WHEN displaying message details, THE SMS_UI SHALL show sender, full timestamp, and Fraud_Score as percentage
3. WHEN displaying fraud analysis, THE SMS_UI SHALL show fraud classification (fraud/suspicious/genuine) with color-coded badge
4. WHEN Fraud_Score is >= 0.7, THE SMS_UI SHALL display warning indicators and fraud explanation text
5. THE SMS_UI SHALL provide a "Report as Fraud" button that links to the existing ReportScamScreen
6. THE SMS_UI SHALL provide a "Mark as Safe" button that allows user to override classification
7. WHEN the user marks a message as safe, THE SMS_Tracker SHALL update the Classification_Result in SMS_Database
8. WHEN displaying details, THE SMS_UI SHALL show a visual fraud score meter (0-100%) with color gradient

### Requirement 8: Fraud Detection Notifications

**User Story:** As a user, I want to receive immediate notifications when a fraudulent SMS is detected, so that I can be alerted to potential scams in real-time.

#### Acceptance Criteria

1. WHEN a new SMS is classified with Fraud_Score >= 0.7, THE Notification_Manager SHALL display an in-app notification
2. WHEN displaying notifications, THE Notification_Manager SHALL show sender, fraud score percentage, and "View Details" action
3. WHEN the user taps the notification, THE SMS_UI SHALL navigate to the detailed view of the fraud message
4. WHEN multiple fraud messages are detected within 5 minutes, THE Notification_Manager SHALL group notifications
5. THE Notification_Manager SHALL display notifications as banner alerts that auto-dismiss after 5 seconds
6. WHEN the app is in the background, THE Notification_Manager SHALL display Android system notifications for high-risk fraud (Fraud_Score >= 0.85)
7. THE Notification_Manager SHALL provide a notification settings option to enable/disable fraud alerts
8. WHEN notification settings are disabled, THE SMS_Tracker SHALL continue classification but SHALL NOT display alerts

### Requirement 9: Background SMS Processing

**User Story:** As a user, I want SMS fraud detection to continue working even when the app is closed, so that I receive continuous protection.

#### Acceptance Criteria

1. WHEN the app is in the background, THE Real_Time_Monitor SHALL continue listening for incoming SMS
2. WHEN an SMS is received in the background, THE SMS_Classifier SHALL classify the message on-device
3. WHEN a fraud message is detected in the background, THE Notification_Manager SHALL display an Android system notification
4. WHEN the device restarts, THE SMS_Tracker SHALL automatically re-register the SMS broadcast receiver
5. THE SMS_Tracker SHALL operate without keeping the app process alive continuously
6. WHEN battery optimization is enabled, THE SMS_Tracker SHALL request exclusion from battery optimization for reliable operation
7. IF the system terminates the broadcast receiver, THEN THE SMS_Tracker SHALL re-register when the app next launches

### Requirement 10: SMS Tracker Settings and Controls

**User Story:** As a user, I want to control SMS tracker behavior and view statistics, so that I can customize the feature to my preferences.

#### Acceptance Criteria

1. THE SMS_UI SHALL provide a settings screen accessible from the SMS tracker main view
2. WHEN the settings screen opens, THE SMS_UI SHALL display toggle for enabling/disabling real-time monitoring
3. WHEN real-time monitoring is disabled, THE Real_Time_Monitor SHALL unregister the SMS broadcast receiver
4. WHEN the settings screen opens, THE SMS_UI SHALL display toggle for enabling/disabling fraud notifications
5. THE SMS_UI SHALL display statistics showing total messages scanned, fraud count, and genuine count
6. THE SMS_UI SHALL provide a "Re-scan All Messages" button that triggers Historical_Scanner
7. WHEN re-scan is triggered, THE SMS_Tracker SHALL clear existing classifications and re-process all messages
8. THE SMS_UI SHALL provide a "Clear All Data" button that removes all stored SMS records from SMS_Database
9. WHEN sensitivity settings are changed, THE SMS_Tracker SHALL apply new thresholds to future classifications without re-scanning

### Requirement 11: Integration with Existing Payment Flow

**User Story:** As a developer, I want the SMS tracker to integrate with the existing payment fraud detection, so that payment-related SMS analysis contributes to transaction risk scoring.

#### Acceptance Criteria

1. WHEN a payment transaction is initiated, THE SMS_Tracker SHALL provide recent SMS fraud statistics to the payment flow
2. WHEN providing statistics, THE SMS_Tracker SHALL include count of fraud SMS in the last 24 hours
3. WHEN providing statistics, THE SMS_Tracker SHALL include highest Fraud_Score from last 1 hour
4. THE SMS_Tracker SHALL expose a method for the existing SmsReceiverModule to query fraud history
5. WHEN the existing payment flow detects an OTP SMS, THE SMS_Tracker SHALL also classify and store the OTP message
6. THE SMS_Tracker SHALL coexist with the existing SmsReceiverModule without conflicts
7. THE SMS_Tracker SHALL use the same SMS_Classifier instance as the existing fraud detection infrastructure

### Requirement 12: Error Handling and Resilience

**User Story:** As a user, I want the SMS tracker to handle errors gracefully without crashing the app, so that I have a reliable experience.

#### Acceptance Criteria

1. WHEN SMS_Classifier fails to load the TFLite model, THE SMS_Tracker SHALL log the error and display a user-friendly error message
2. IF AsyncStorage operations fail, THEN THE SMS_Tracker SHALL retry the operation up to 3 times with exponential backoff
3. WHEN permission errors occur, THE SMS_Permission_Manager SHALL display clear instructions for granting permissions
4. IF the device has insufficient storage, THEN THE SMS_Database SHALL stop storing new messages and display a storage warning
5. WHEN processing large message batches, THE SMS_Tracker SHALL monitor memory usage and reduce batch size if needed
6. IF the broadcast receiver crashes, THEN THE SMS_Tracker SHALL log the crash and attempt to re-register the receiver
7. THE SMS_Tracker SHALL provide detailed error logs for debugging without exposing sensitive SMS content
8. WHEN errors occur during background processing, THE SMS_Tracker SHALL notify the user on next app launch

### Requirement 13: Performance and Resource Management

**User Story:** As a user, I want the SMS tracker to operate efficiently without draining my battery or consuming excessive resources, so that my device performance remains optimal.

#### Acceptance Criteria

1. WHEN Historical_Scanner processes messages, THE SMS_Tracker SHALL process messages in background thread to prevent UI blocking
2. WHEN Real_Time_Monitor classifies messages, THE SMS_Classifier SHALL complete processing within 200 milliseconds
3. THE SMS_Tracker SHALL limit memory usage to less than 50MB during batch processing operations
4. WHEN the app is in the background, THE SMS_Tracker SHALL minimize CPU usage by processing only incoming messages
5. THE SMS_Database SHALL implement efficient indexing to ensure query response time under 100 milliseconds
6. WHEN displaying large message lists, THE SMS_UI SHALL virtualize the list to render only visible items
7. THE SMS_Tracker SHALL not impact device battery life by more than 2% per day during normal usage
8. WHEN TFLite model inference occurs, THE SMS_Classifier SHALL use GPU acceleration if available on the device
