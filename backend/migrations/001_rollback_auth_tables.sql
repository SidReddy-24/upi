-- Migration Rollback: 001_rollback_auth_tables.sql
-- Description: Rollback authentication system tables
-- Date: 2024-01-XX
-- Author: SentinelPay Development Team

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_users_auth_updated_at ON users_auth;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_otps CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_refresh_tokens CASCADE;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS users_auth CASCADE;

-- Drop indexes (these are dropped automatically with tables, but being explicit)
-- No need to explicitly drop indexes as they cascade with table drops

COMMENT ON SCHEMA public IS 'Rolled back authentication system tables';
