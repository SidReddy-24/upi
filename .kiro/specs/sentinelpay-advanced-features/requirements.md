# Requirements Document

SentinelPay Advanced Features Enhancement

## Introduction

This document defines the requirements for Phase 9 of the SentinelPay application, adding advanced security and production-readiness features. The enhancements include in-app transaction notifications, SMS reading with OTP scam detection, a Guardian approval system for high-risk transactions, a transaction hold period for user review, deployment infrastructure for production, and a complete authentication system. These features build upon the existing fraud detection engine and simulated wallet to provide enterprise-grade security controls and real-device deployment capability.

## Glossary

- **SentinelPay**: The React Native mobile wallet application with AI-powered fraud detection
- **FraudShield_Backend**: The FastAPI backend service providing fraud scoring and risk analysis
- **SMS_Reader_Service**: Component that monitors incoming SMS for OTP scams using ML classification
- **ML_Classifier**: On-device TensorFlow Lite model (spam_classifier.tflite) for message fraud detection
- **Guardian**: A trusted contact who can approve or reject high-risk transactions
- **Transaction_Hold**: A configurable time window during which users can review and cancel transactions
- **VPA**: Virtual Payment Address (UPI identifier, e.g., user@okhdfc)
- **OTP**: One-Time Password for verification
- **JWT**: JSON Web Token for session management
- **WebSocket**: Real-time bidirectional communication protocol
- **Fraud_Score**: Numerical risk assessment (0-1 scale) from FraudShield engine
- **SLA**: Service Level Agreement (target: <200ms for fraud scoring)
- **AsyncStorage**: React Native persistent key-value storage system
- **API_BASE_URL**: Backend endpoint URL (10.0.2.2 for emulator, real IP/domain for production)

## Requirements

### Requirement 1: In-App Transaction Notifications

**User Story:** As a user, I want to receive in-app notifications after completing P2P transactions, so that I have immediate confirmation and can detect unauthorized activity.

#### Acceptance Criteria

1. WHEN a P2P transaction reaches APPROVE or REJECT status, THE Notification_Service SHALL send a local notification to the sender
2. WHEN a P2P transaction reaches APPROVE status, THE Notification_Service SHALL send a local notification to the receiver (if they have the app)
3. THE Notification_Message SHALL include the transaction amount, counterparty VPA, transaction status, and timestamp
4. THE Notification_Message SHALL include the fraud score if the transaction was flagged as REVIEW or REJECT
5. THE Notification_Service SHALL use React Native local notifications (react-native-push-notification)
6. THE Notification_Service SHALL display notifications even when the app is in background
7. THE Notification SHALL be actionable with "View Details" action that opens transaction history
8. THE Notification_Service SHALL deliver notifications within 2 seconds of transaction completion
9. IF notification delivery fails, THEN THE Notification_Service SHALL log the failure without blocking transaction completion
10. THE Notification SHALL use appropriate icons and colors based on transaction status (green for approved, red for rejected, yellow for flagged)

### Requirement 2: Guardian System for High-Risk Transactions

**User Story:** As a user, I want to add trusted guardians to my account who can approve high-risk transactions, so that my family can protect me from fraud.

#### Acceptance Criteria

1. THE Guardian_Service SHALL allow users to add up to 5 trusted guardians by phone number or VPA
2. WHEN a guardian invitation is sent, THE Guardian_Service SHALL send a notification to the invited guardian
3. THE Guardian_Service SHALL require bidirectional approval (invitee must accept invitation)
4. THE Guardian_Service SHALL allow users to remove guardians from their account at any time
5. WHEN a transaction fraud score exceeds 0.7, THE Payment_Processor SHALL require guardian approval before execution
6. THE Guardian_Notification SHALL include transaction amount, recipient VPA, fraud score, and risk signals
7. THE Guardian SHALL be able to approve or reject the transaction via the mobile app
8. WHERE a guardian approves, THE Payment_Processor SHALL execute the transaction within 2 seconds
9. WHERE a guardian rejects, THE Payment_Processor SHALL cancel the transaction and notify the user
10. THE Guardian_Approval_Request SHALL expire after 5 minutes if no response is received
11. WHEN a guardian approval request expires, THE Payment_Processor SHALL cancel the transaction
12. THE Guardian_Service SHALL use WebSocket connections for real-time approval notifications
13. IF WebSocket is unavailable, THEN THE Guardian_Service SHALL fall back to HTTP polling every 3 seconds
14. THE Guardian_Service SHALL store guardian relationships in the backend database
15. THE Guardian_Service SHALL validate that guardians have active SentinelPay accounts

### Requirement 3: Transaction Hold Period (Recheck & Revert)

**User Story:** As a user, I want a configurable hold period after entering my UPI PIN, so that I can review transaction details and cancel if something looks suspicious.

#### Acceptance Criteria

1. THE Settings_Service SHALL allow users to configure hold duration between 10 and 30 seconds
2. THE Settings_Service SHALL allow users to configure a hold threshold amount (e.g., "hold all transactions above ₹5,000")
3. WHEN a transaction amount exceeds the hold threshold, THE Payment_Processor SHALL enter hold state after PIN entry
4. WHILE in hold state, THE Payment_Processor SHALL display transaction amount, recipient VPA, fraud score, and risk signals
5. WHILE in hold state, THE Payment_Processor SHALL display a countdown timer showing remaining review time
6. WHILE in hold state, THE User_Interface SHALL provide "Confirm" and "Cancel" buttons
7. WHEN the user clicks "Confirm" during hold period, THE Payment_Processor SHALL execute the transaction immediately
8. WHEN the user clicks "Cancel" during hold period, THE Payment_Processor SHALL cancel the transaction and return funds
9. WHEN the hold timer expires without user action, THE Payment_Processor SHALL automatically cancel the transaction
10. THE Payment_Processor SHALL ensure atomicity (no double-spend) using database transactions with row-level locking
11. THE Settings_Service SHALL persist hold configuration in AsyncStorage
12. THE Payment_Processor SHALL check hold configuration before every transaction

### Requirement 4: Backend Deployment Infrastructure

**User Story:** As a developer, I want to deploy FraudShield backend to a production server, so that real Android devices can connect over the internet.

#### Acceptance Criteria

1. THE Deployment_Guide SHALL provide step-by-step instructions for AWS EC2 deployment
2. THE Deployment_Guide SHALL provide step-by-step instructions for DigitalOcean Droplet deployment
3. THE Deployment_Guide SHALL include environment variable configuration for production
4. THE Deployment_Guide SHALL include PostgreSQL and Redis setup on the cloud server
5. THE Deployment_Guide SHALL include SSL/HTTPS certificate configuration using Let's Encrypt
6. THE Deployment_Guide SHALL include instructions for updating API_BASE_URL from 10.0.2.2 to production domain
7. THE Deployment_Guide SHALL include systemd service configuration for automatic backend startup
8. THE Deployment_Guide SHALL include firewall configuration (ports 80, 443, 5432, 6379)
9. THE Deployment_Guide SHALL include instructions for securing PostgreSQL and Redis with passwords
10. THE Deployment_Guide SHALL include performance tuning recommendations (Uvicorn workers, connection pooling)
11. THE Deployment_Guide SHALL include monitoring setup using logs and health endpoints
12. THE Backend_Configuration SHALL support environment-based configuration (development vs production)

### Requirement 5: Login and Authentication System

**User Story:** As a user, I want to register and login with secure authentication, so that my wallet and transactions are protected.

#### Acceptance Criteria

1. THE Registration_Service SHALL require phone number for user registration
2. WHEN a user registers, THE Registration_Service SHALL send an OTP to the provided phone number
3. THE Registration_Service SHALL verify the OTP before creating the account
4. THE Registration_Service SHALL require a password with minimum 8 characters, including uppercase, lowercase, and digit
5. THE Registration_Service SHALL hash passwords using bcrypt with salt rounds >= 12
6. THE Login_Service SHALL support login via phone number and password
7. THE Login_Service SHALL support login via email and password
8. THE Login_Service SHALL support biometric authentication after initial password login
9. WHEN login is successful, THE Login_Service SHALL generate a JWT token with 24-hour expiration
10. THE Login_Service SHALL return user profile and JWT token in the login response
11. THE Session_Manager SHALL store JWT token in AsyncStorage
12. THE Session_Manager SHALL include JWT token in Authorization header for all API requests
13. THE Session_Manager SHALL refresh JWT token when it expires (if refresh token is valid)
14. THE Logout_Service SHALL clear JWT token from AsyncStorage and invalidate the session on backend
15. THE Password_Reset_Service SHALL send an OTP to the user's registered phone number
16. WHEN OTP is verified, THE Password_Reset_Service SHALL allow the user to set a new password
17. THE Onboarding_Flow SHALL only display after successful authentication
18. THE User_Profile SHALL be linked to the user's VPA in the wallet system
19. THE Registration_Service SHALL validate that phone numbers are unique across all users
20. THE Registration_Service SHALL validate that email addresses are unique across all users
21. IF JWT token is invalid or expired, THEN THE API_Client SHALL redirect user to login screen

### Requirement 6: SMS Reading and OTP Scam Detection

**User Story:** As a user, I want the app to monitor my incoming SMS messages and warn me about potential OTP sharing scams, so that I don't fall victim to fraud.

#### Acceptance Criteria

1. THE SMS_Reader_Service SHALL request READ_SMS permission from the user during onboarding
2. WHEN a new SMS is received on the device, THE SMS_Reader_Service SHALL intercept and read the message content
3. THE SMS_Reader_Service SHALL extract the sender, message body, and timestamp from each incoming SMS
4. THE SMS_Reader_Service SHALL send the SMS content to the ML_Classifier for fraud analysis
5. THE ML_Classifier SHALL use the existing spam_classifier.tflite model to classify messages as SAFE, SUSPICIOUS, or DANGEROUS
6. WHEN ML_Classifier detects an OTP-related message, THE SMS_Reader_Service SHALL check if the sender is from a trusted bank/service
7. WHERE the message contains OTP keywords (e.g., "OTP", "verification code", "one-time password") AND the sender is suspicious, THE SMS_Reader_Service SHALL classify it as potential scam
8. WHEN a message is classified as SUSPICIOUS or DANGEROUS, THE SMS_Reader_Service SHALL send an in-app notification warning the user
9. THE Warning_Notification SHALL include the sender information, risk level, and advice not to share the OTP
10. THE Warning_Notification SHALL be actionable with "View Details" and "Mark as Safe" options
11. THE SMS_Reader_Service SHALL NOT block or delete SMS messages - only provide warnings
12. THE SMS_Reader_Service SHALL log all analyzed messages for audit purposes
13. THE SMS_Reader_Service SHALL respect user privacy - SMS content SHALL NOT be sent to external servers
14. THE ML_Classifier SHALL run on-device using TensorFlow Lite
15. THE SMS_Reader_Service SHALL run in background even when app is not active

### Requirement 7: SMS Notification Parser for Pretty Printing

**User Story:** As a developer, I want a message formatter that generates readable notification messages, so that users receive clear and professional transaction confirmations.

#### Acceptance Criteria

1. THE SMS_Formatter SHALL accept transaction amount, counterparty VPA, status, fraud score, and timestamp as input
2. THE SMS_Formatter SHALL generate a notification message conforming to 160-character limit
3. THE SMS_Formatter SHALL include transaction amount formatted with currency symbol (₹)
4. THE SMS_Formatter SHALL include counterparty VPA truncated if necessary (preserve domain)
5. THE SMS_Formatter SHALL include status as APPROVED, FLAGGED, or BLOCKED
6. WHERE fraud score exceeds 0.5, THE SMS_Formatter SHALL include the fraud score percentage
7. THE SMS_Formatter SHALL include timestamp formatted as "DD MMM, HH:MM" (e.g., "21 Jul, 14:30")
8. FOR ALL valid transaction objects, formatting the message and parsing it back SHALL preserve the essential information (round-trip property)

### Requirement 8: Guardian Notification Parser and Pretty Printer

**User Story:** As a developer, I want a message formatter for guardian approval requests, so that guardians receive clear and actionable notifications.

#### Acceptance Criteria

1. THE Guardian_Formatter SHALL accept transaction amount, recipient VPA, fraud score, risk signals, and requester name as input
2. THE Guardian_Formatter SHALL generate a notification message with all essential approval information
3. THE Guardian_Formatter SHALL highlight high-risk signals (e.g., "⚠️ BLACKLISTED_VPA", "⚠️ CALL_DURING_PAYMENT")
4. THE Guardian_Formatter SHALL format fraud score as percentage with color coding (green <0.3, yellow 0.3-0.7, red >0.7)
5. FOR ALL valid approval request objects, formatting and parsing SHALL preserve all risk signals and transaction details (round-trip property)

### Requirement 9: Authentication Token Parser

**User Story:** As a developer, I want a JWT parser and validator, so that the app can securely decode and verify authentication tokens.

#### Acceptance Criteria

1. THE JWT_Parser SHALL decode JWT tokens without signature verification (client-side display)
2. THE JWT_Parser SHALL extract user_id, phone, email, and expiration timestamp from token payload
3. THE JWT_Validator SHALL verify JWT signature using the backend public key
4. THE JWT_Validator SHALL check token expiration and reject expired tokens
5. FOR ALL valid JWT tokens, parsing and encoding SHALL produce a functionally equivalent token (round-trip property)

## Notes on Testing Strategy

This specification includes several parser/formatter requirements that are critical for system reliability. These components should be tested using property-based testing with round-trip properties:

- **SMS_Formatter**: Round-trip property ensures that formatted messages preserve essential transaction information when parsed back.
- **Guardian_Formatter**: Round-trip property ensures that all risk signals and approval details are preserved through format/parse cycle.
- **JWT_Parser**: Round-trip property ensures that token encoding/decoding preserves user identity and claims.

These are ideal candidates for property-based testing because:
1. Behavior varies meaningfully with input (different amounts, VPAs, risk scores)
2. Testing YOUR code (formatters/parsers), not external services
3. 100 iterations will find edge cases (boundary values, string truncation, special characters)
4. Low cost (pure functions, in-memory operations)
