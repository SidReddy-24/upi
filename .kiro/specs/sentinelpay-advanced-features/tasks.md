# Implementation Plan: SentinelPay Advanced Features Enhancement

## Overview

This implementation plan breaks down the seven major feature enhancements into discrete coding tasks. The features build upon existing React Native mobile app (TypeScript) and FastAPI backend (Python 3.13) infrastructure to add production-ready authentication, real-time guardian approval, SMS scam detection, transaction hold mechanisms, push notifications, and comprehensive deployment guides.

## Tasks

- [ ] 1. Set up core infrastructure and dependencies
  - Install and configure react-native-push-notification library
  - Add fast-check library for property-based testing
  - Create utility directories for parsers, formatters, and services
  - Set up TypeScript type definitions for all new interfaces
  - _Requirements: 1.5, 7.1, 8.1, 9.1_

- [ ] 2. Implement parser and formatter utilities with property-based tests
  - [ ] 2.1 Create SMS notification formatter and parser
    - Implement `formatTransactionNotification()` with 160-char limit
    - Implement `parseTransactionNotification()` with round-trip support
    - Add currency formatting, VPA truncation, and timestamp formatting
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ]* 2.2 Write property test for message length constraint
    - **Property 1: Message Length Constraint**
    - **Validates: Requirements 7.2**
  
  - [ ]* 2.3 Write property test for currency symbol presence
    - **Property 2: Currency Symbol Presence**
    - **Validates: Requirements 7.3**
  
  - [ ]* 2.4 Write property test for VPA domain preservation
    - **Property 3: VPA Domain Preservation**
    - **Validates: Requirements 7.4**
  
  - [ ]* 2.5 Write property test for status value inclusion
    - **Property 4: Status Value Inclusion**
    - **Validates: Requirements 7.5**
  
  - [ ]* 2.6 Write property test for conditional fraud score inclusion
    - **Property 5: Conditional Fraud Score Inclusion**
    - **Validates: Requirements 7.6**
  
  - [ ]* 2.7 Write property test for timestamp format compliance
    - **Property 6: Timestamp Format Compliance**
    - **Validates: Requirements 7.7**
  
  - [ ]* 2.8 Write property test for transaction notification round-trip
    - **Property 7: Transaction Notification Round-Trip**
    - **Validates: Requirements 7.8**
  
  - [ ] 2.9 Create guardian approval formatter and parser
    - Implement `formatGuardianApprovalRequest()` with emoji indicators
    - Implement `parseGuardianApprovalRequest()` with round-trip support
    - Add risk signal formatting and color coding (🟢🟡🔴)
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ]* 2.10 Write property test for all fields presence
    - **Property 8: All Fields Presence**
    - **Validates: Requirements 8.2**
  
  - [ ]* 2.11 Write property test for risk signal warning formatting
    - **Property 9: Risk Signal Warning Formatting**
    - **Validates: Requirements 8.3**
  
  - [ ]* 2.12 Write property test for fraud score color coding
    - **Property 10: Fraud Score Color Coding**
    - **Validates: Requirements 8.4**
  
  - [ ]* 2.13 Write property test for guardian approval round-trip
    - **Property 11: Guardian Approval Round-Trip**
    - **Validates: Requirements 8.5**
  
  - [ ] 2.14 Create JWT parser and validator utilities
    - Implement `parseJwt()` for client-side token decoding
    - Implement `encodeJwt()` and `verifyJwt()` for backend
    - Add expiration checking logic
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 2.15 Write property test for payload extraction
    - **Property 12: Payload Extraction**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ]* 2.16 Write property test for signature validation
    - **Property 13: Signature Validation**
    - **Validates: Requirements 9.3**
  
  - [ ]* 2.17 Write property test for expiration validation
    - **Property 14: Expiration Validation**
    - **Validates: Requirements 9.4**
  
  - [ ]* 2.18 Write property test for JWT round-trip
    - **Property 15: JWT Round-Trip**
    - **Validates: Requirements 9.5**

- [ ] 3. Checkpoint - Ensure all formatter/parser tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement notification service
  - [ ] 4.1 Create NotificationService class with configuration
    - Set up react-native-push-notification channel configuration for Android API 26+
    - Implement `configure()` method with notification channel setup
    - Implement `requestPermissions()` method
    - _Requirements: 1.5, 1.6_
  
  - [ ] 4.2 Implement transaction notification delivery
    - Create `sendTransactionNotification()` method using formatters from 2.1
    - Add color coding logic (green #4ade80, red #ef4444, yellow #fbbf24)
    - Implement "View Details" action with deep linking
    - Add 2-second timeout and error logging
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8, 1.9, 1.10_
  
  - [ ]* 4.3 Write integration tests for notification service
    - Test notification delivery for APPROVE, REJECT, REVIEW statuses
    - Test permission denied scenarios
    - Test timeout and failure handling
    - _Requirements: 1.9_

- [ ] 5. Implement SMS reader service
  - [ ] 5.1 Create SmsReaderService TypeScript coordinator
    - Implement `requestPermissions()` for READ_SMS permission
    - Implement `startMonitoring()` and `stopMonitoring()` lifecycle methods
    - Create event listener for native SmsReceiverModule events
    - _Requirements: 6.1, 6.2_
  
  - [ ] 5.2 Implement SMS classification logic
    - Create `classifyMessage()` method calling existing SmsClassifier native module
    - Implement `checkTrustedSender()` with bank pattern matching (e.g., `[A-Z]{2}-[A-Z]{6}`)
    - Implement `containsOtpKeywords()` with keyword detection ("OTP", "verification code", etc.)
    - Add risk level determination logic (SAFE, SUSPICIOUS, DANGEROUS)
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.14_
  
  - [ ] 5.3 Integrate SMS warning notifications
    - Send warning notifications via NotificationService when messages are SUSPICIOUS/DANGEROUS
    - Include sender info, risk level, and advice in warning
    - Add "View Details" and "Mark as Safe" actions
    - _Requirements: 6.8, 6.9, 6.10_
  
  - [ ]* 5.4 Write integration tests for SMS reader service
    - Test permission handling
    - Test classification for safe, suspicious, and dangerous messages
    - Test trusted sender detection
    - Test warning notification delivery
    - _Requirements: 6.11, 6.13, 6.15_

- [ ] 6. Checkpoint - Ensure notification and SMS services work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement backend authentication system
  - [ ] 7.1 Create database models for users and OTP
    - Create SQLAlchemy models for `users`, `otp_verifications`, `refresh_tokens` tables
    - Add database migration scripts
    - Set up unique constraints for phone and email
    - _Requirements: 5.1, 5.19, 5.20_
  
  - [ ] 7.2 Implement OTP generation and verification endpoints
    - Create `/api/v1/auth/send-otp` endpoint (for registration and password reset)
    - Implement 6-digit OTP generation with 5-minute expiration
    - Create `/api/v1/auth/verify-otp` endpoint
    - Store OTPs in database with purpose field (REGISTRATION, PASSWORD_RESET, LOGIN)
    - Log OTPs to console for demo purposes
    - _Requirements: 5.2, 5.3, 5.15_
  
  - [ ] 7.3 Implement user registration endpoint
    - Create `/api/v1/auth/register` endpoint
    - Validate password format (min 8 chars, uppercase, lowercase, digit)
    - Hash passwords with bcrypt (12 rounds minimum)
    - Create user record with phone, email (optional), VPA
    - _Requirements: 5.1, 5.4, 5.5_
  
  - [ ] 7.4 Implement login endpoints
    - Create `/api/v1/auth/login` endpoint accepting phone/email + password
    - Verify password with bcrypt
    - Generate JWT access token (24h expiration) and refresh token (30d expiration)
    - Return user profile and tokens
    - _Requirements: 5.6, 5.7, 5.9, 5.10_
  
  - [ ] 7.5 Implement JWT token management
    - Create JWT encoding function with HS256 signing
    - Create token verification middleware for protected endpoints
    - Create `/api/v1/auth/refresh` endpoint for token refresh
    - Create `/api/v1/auth/logout` endpoint to revoke refresh tokens
    - _Requirements: 5.13, 5.14, 5.21_
  
  - [ ] 7.6 Implement password reset endpoint
    - Create `/api/v1/auth/reset-password` endpoint
    - Verify OTP before allowing password change
    - Hash new password with bcrypt
    - _Requirements: 5.16_
  
  - [ ]* 7.7 Write unit tests for authentication backend
    - Test password hashing and verification
    - Test JWT encoding, decoding, and expiration
    - Test OTP generation and verification
    - Test duplicate phone/email validation
    - _Requirements: 5.5, 5.9, 5.19, 5.20_

- [ ] 8. Implement frontend authentication system
  - [ ] 8.1 Create AuthService class
    - Implement `sendRegistrationOtp()` method
    - Implement `verifyOtp()` method
    - Implement `register()` method
    - Implement `login()` method with password
    - Implement `logout()` method
    - _Requirements: 5.2, 5.3, 5.4, 5.6_
  
  - [ ] 8.2 Implement session management
    - Create `getStoredToken()` to read JWT from AsyncStorage
    - Create `refreshAccessToken()` for token refresh
    - Create `getCurrentUser()` for profile retrieval
    - Set up API client interceptor to add Authorization header
    - Add 401 error handler to trigger token refresh
    - _Requirements: 5.11, 5.12, 5.13, 5.21_
  
  - [ ] 8.3 Create registration and login screens
    - Build RegisterScreen with phone input, OTP verification, and password entry
    - Build LoginScreen with phone/email input and password entry
    - Add password validation UI with format requirements
    - Implement error handling and user feedback
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [ ] 8.4 Implement biometric authentication
    - Add biometric prompt after initial login
    - Store encrypted credentials in device keystore
    - Implement `loginWithBiometric()` method
    - _Requirements: 5.8_
  
  - [ ] 8.5 Integrate authentication with app navigation
    - Update navigation to show login screen before main app
    - Show onboarding flow only after successful authentication
    - Redirect to login on JWT expiration
    - Link user profile to VPA in wallet system
    - _Requirements: 5.17, 5.18_
  
  - [ ]* 8.6 Write integration tests for authentication frontend
    - Test registration flow end-to-end
    - Test login flow with correct and incorrect credentials
    - Test token refresh on expiration
    - Test logout functionality
    - _Requirements: 5.6, 5.13, 5.14_

- [ ] 9. Checkpoint - Ensure authentication system works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement backend guardian system
  - [ ] 10.1 Create database models for guardian relationships
    - Create SQLAlchemy models for `guardian_relationships` and `guardian_approval_requests` tables
    - Add database migration scripts
    - Add constraint for maximum 5 active guardians per user
    - _Requirements: 2.1, 2.14_
  
  - [ ] 10.2 Implement guardian management endpoints
    - Create `/api/v1/guardian/add` endpoint (with phone or VPA)
    - Create `/api/v1/guardian/remove` endpoint
    - Create `/api/v1/guardian/list` endpoint
    - Create `/api/v1/guardian/accept-invitation` endpoint
    - Validate bidirectional approval flow
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.15_
  
  - [ ] 10.3 Implement approval request creation
    - Create `/api/v1/guardian/request-approval` endpoint
    - Check if transaction fraud score > 0.7
    - Create approval request with 5-minute expiration
    - Send notification to guardian via NotificationService
    - _Requirements: 2.5, 2.6, 2.10_
  
  - [ ] 10.4 Implement approval response handling
    - Create `/api/v1/guardian/respond` endpoint (approve/reject)
    - Update approval request status
    - Notify user of guardian decision
    - Execute or cancel transaction based on response
    - _Requirements: 2.7, 2.8, 2.9_
  
  - [ ] 10.5 Set up WebSocket server for real-time notifications
    - Create WebSocket endpoint at `/api/v1/guardian/ws`
    - Implement connection management with user_id authentication
    - Send approval requests via WebSocket when created
    - Use Redis for pub/sub to notify connected guardians
    - _Requirements: 2.12_
  
  - [ ] 10.6 Implement approval request expiration logic
    - Create background task to check for expired requests (5-minute timeout)
    - Automatically cancel transactions on expiration
    - Send expiration notification to user
    - _Requirements: 2.10, 2.11_
  
  - [ ]* 10.7 Write integration tests for guardian backend
    - Test guardian CRUD operations
    - Test approval request creation and response
    - Test WebSocket connection and notifications
    - Test expiration logic
    - _Requirements: 2.5, 2.10, 2.11, 2.12_

- [ ] 11. Implement frontend guardian system
  - [ ] 11.1 Create GuardianService class
    - Implement guardian management methods (add, remove, list, accept)
    - Create `requestApproval()` method for high-risk transactions
    - Create `respondToRequest()` method for guardians
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.7_
  
  - [ ] 11.2 Implement WebSocket connection with polling fallback
    - Create `connectWebSocket()` method to establish connection
    - Implement `subscribeToApprovalRequests()` for real-time updates
    - Create polling fallback calling `/api/v1/guardian/pending-requests` every 3 seconds
    - Add connection health check and automatic fallback
    - _Requirements: 2.12, 2.13_
  
  - [ ] 11.3 Create guardian management screens
    - Build GuardianListScreen showing current guardians
    - Build AddGuardianScreen with phone/VPA input
    - Build GuardianApprovalScreen for pending approvals
    - Display guardian approval requests with formatted messages (use formatter from 2.9)
    - _Requirements: 2.1, 2.2, 2.4, 2.6_
  
  - [ ] 11.4 Integrate guardian approval into payment flow
    - Check fraud score after payment analysis
    - If score > 0.7, block payment execution and request guardian approval
    - Display waiting state with approval request details
    - Execute payment on approval, cancel on rejection or expiration
    - _Requirements: 2.5, 2.8, 2.9, 2.11_
  
  - [ ]* 11.5 Write integration tests for guardian frontend
    - Test adding and removing guardians
    - Test WebSocket connection and fallback to polling
    - Test approval request display and response
    - Test high-risk transaction blocking
    - _Requirements: 2.12, 2.13_

- [ ] 12. Checkpoint - Ensure guardian system works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement transaction hold mechanism
  - [ ] 13.1 Create TransactionHoldManager class
    - Implement `getConfiguration()` to read from AsyncStorage
    - Implement `updateConfiguration()` to persist hold settings
    - Create hold configuration interface (enabled, durationSeconds 10-30, thresholdAmount)
    - _Requirements: 3.1, 3.2, 3.11_
  
  - [ ] 13.2 Implement hold decision logic
    - Create `shouldHold()` method checking amount against threshold
    - Integrate hold check into payment flow before execution
    - _Requirements: 3.2, 3.3, 3.12_
  
  - [ ] 13.3 Implement hold session management
    - Create `startHold()` method to initiate hold state
    - Implement countdown timer with 100ms update interval
    - Create `confirmHold()` to execute payment immediately
    - Create `cancelHold()` to abort payment
    - Add automatic cancellation on timeout
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  
  - [ ] 13.4 Create hold review screen UI
    - Display transaction amount, recipient VPA, fraud score, risk signals
    - Show countdown timer
    - Add "Confirm" and "Cancel" buttons
    - Update UI every 100ms during countdown
    - _Requirements: 3.4, 3.5, 3.6_
  
  - [ ] 13.5 Add backend atomicity protection
    - Implement PostgreSQL row-level locking with `SELECT ... FOR UPDATE NOWAIT`
    - Add double-spend prevention logic in payment execution endpoint
    - _Requirements: 3.10_
  
  - [ ]* 13.6 Write integration tests for transaction hold
    - Test hold trigger based on threshold
    - Test countdown timer
    - Test confirm, cancel, and timeout scenarios
    - Test configuration persistence
    - _Requirements: 3.1, 3.7, 3.8, 3.9, 3.11_

- [ ] 14. Extend backend deployment guide
  - [ ] 14.1 Add AWS EC2 deployment section
    - Document EC2 instance selection (t3.medium recommended)
    - Add step-by-step SSH access and initial server setup
    - Document security group configuration (ports 80, 443, 22)
    - _Requirements: 4.1, 4.8_
  
  - [ ] 14.2 Add DigitalOcean Droplet deployment section
    - Document Droplet creation (4GB RAM, 2 vCPUs)
    - Add SSH access and initial server configuration
    - Document firewall setup with ufw
    - _Requirements: 4.2, 4.8_
  
  - [ ] 14.3 Document PostgreSQL and Redis setup
    - Add installation instructions for PostgreSQL 16
    - Add installation instructions for Redis
    - Document password configuration and security hardening
    - Add connection pooling configuration
    - _Requirements: 4.4, 4.9, 4.10_
  
  - [ ] 14.4 Document Nginx and SSL configuration
    - Add Nginx installation and reverse proxy configuration
    - Document Let's Encrypt SSL certificate setup with Certbot
    - Add auto-renewal cron job configuration
    - _Requirements: 4.5_
  
  - [ ] 14.5 Document systemd service setup
    - Create systemd unit file template for backend service
    - Add automatic startup and restart configuration
    - Document log management
    - _Requirements: 4.7_
  
  - [ ] 14.6 Document environment configuration
    - Create production environment variables template
    - Document API_BASE_URL update in mobile app
    - Add environment-based configuration switching
    - _Requirements: 4.3, 4.6, 4.12_
  
  - [ ] 14.7 Add monitoring and backup section
    - Document health endpoint configuration
    - Add log aggregation setup
    - Document PostgreSQL backup strategy to S3/Spaces
    - _Requirements: 4.11_

- [ ] 15. Integration and wiring
  - [ ] 15.1 Wire all services together in main app
    - Initialize NotificationService on app startup
    - Initialize SmsReaderService after permission grant
    - Initialize GuardianService with WebSocket connection
    - Initialize TransactionHoldManager with AsyncStorage config
    - Initialize AuthService and set up API interceptors
    - _Requirements: 1.1, 2.12, 3.11, 5.12, 6.1_
  
  - [ ] 15.2 Update payment flow with all enhancements
    - Add authentication check before payment
    - Add fraud score check for guardian approval
    - Add hold period check for review
    - Add notification on payment completion
    - _Requirements: 1.1, 2.5, 3.3_
  
  - [ ] 15.3 Update app permissions and manifest
    - Add READ_SMS permission to AndroidManifest.xml
    - Add notification permissions
    - Add biometric permission
    - Request permissions during onboarding
    - _Requirements: 1.6, 5.8, 6.1_
  
  - [ ]* 15.4 Write end-to-end integration tests
    - Test complete transaction flow with notifications
    - Test high-risk transaction with guardian approval
    - Test transaction hold with confirmation
    - Test registration and login flow
    - Test SMS scam detection and warning
    - _Requirements: 1.1, 2.5, 3.3, 5.6, 6.8_

- [ ] 16. Final checkpoint - Ensure all components work together
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with 100+ iterations per property
- The design uses TypeScript for frontend/mobile and Python for backend
- Existing native modules (`SmsReceiverModule`, `SmsClassifier`) are reused for SMS functionality
- WebSocket implementation includes polling fallback for reliability
- All SMS content remains on-device for privacy
- Deployment guide extends existing `BACKEND_DEPLOYMENT_GUIDE.md`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.9", "2.14"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.10", "2.11", "2.12", "2.13", "2.15", "2.16", "2.17", "2.18", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "7.1"] },
    { "id": 4, "tasks": ["5.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["5.2", "7.4", "7.5"] },
    { "id": 6, "tasks": ["5.3", "5.4", "7.6", "7.7", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "10.1"] },
    { "id": 8, "tasks": ["8.4", "8.5", "8.6", "10.2"] },
    { "id": 9, "tasks": ["10.3", "10.4", "10.5"] },
    { "id": 10, "tasks": ["10.6", "10.7", "11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "13.1"] },
    { "id": 12, "tasks": ["11.4", "11.5", "13.2", "13.3"] },
    { "id": 13, "tasks": ["13.4", "13.5", "13.6", "14.1", "14.2"] },
    { "id": 14, "tasks": ["14.3", "14.4"] },
    { "id": 15, "tasks": ["14.5", "14.6", "14.7"] },
    { "id": 16, "tasks": ["15.1", "15.2"] },
    { "id": 17, "tasks": ["15.3", "15.4"] }
  ]
}
```
