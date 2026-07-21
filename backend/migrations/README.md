# Database Migrations

This directory contains SQL migration scripts for evolving the database schema.

## Overview

The migration system uses sequential SQL files that can be executed via the `run_migration.py` script. Each migration has a corresponding rollback script for reverting changes.

## Migration Files

| File | Description | Requirements |
|------|-------------|--------------|
| `001_create_auth_tables.sql` | Creates users_auth, otp_verifications, and refresh_tokens tables | 5.1, 5.19, 5.20 |
| `001_rollback_auth_tables.sql` | Rollback script for 001 | - |

## Usage

### Running a Specific Migration

```bash
cd backend
python migrations/run_migration.py 001_create_auth_tables.sql
```

### Running All Migrations

```bash
python migrations/run_migration.py all
```

### Listing Available Migrations

```bash
python migrations/run_migration.py list
```

### Rolling Back a Migration

```bash
python migrations/run_migration.py 001_rollback_auth_tables.sql
```

## Migration Script Features

### 001_create_auth_tables.sql

Creates the following tables:

1. **users_auth**
   - Primary authentication table
   - Stores phone, email, password hash, VPA
   - Unique constraints on phone, email, and VPA
   - Auto-updated `updated_at` timestamp via trigger

2. **otp_verifications**
   - Stores OTP codes for registration, login, and password reset
   - 5-minute expiration (enforced at application level)
   - Tracks verification status
   - Foreign key to users_auth (nullable for registration flow)

3. **refresh_tokens**
   - Manages JWT refresh tokens
   - 30-day expiration
   - Revocation support
   - Foreign key to users_auth with CASCADE delete

### Additional Features

- **Indexes**: Optimized for common query patterns
  - Phone, email, VPA lookups
  - Token validation
  - Active refresh tokens
  - Pending OTP verifications

- **Constraints**:
  - Phone format validation: `^\+?[0-9]{10,15}$`
  - Email format validation (optional field)
  - VPA format validation: `^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$`
  - OTP purpose enum: REGISTRATION, PASSWORD_RESET, LOGIN
  - OTP code format: 6 digits

- **Cleanup Functions**:
  - `cleanup_expired_otps()`: Remove OTPs older than 1 day
  - `cleanup_expired_refresh_tokens()`: Remove expired tokens older than 7 days
  - Should be called periodically via cron or scheduled task

- **Triggers**:
  - Auto-update `updated_at` on users_auth modifications

## Best Practices

1. **Always test migrations on a development database first**
2. **Back up production database before running migrations**
3. **Run migrations during low-traffic periods**
4. **Keep rollback scripts up-to-date**
5. **Document any manual steps required**

## Schema Validation

After running migrations, verify the schema:

```bash
# Connect to database
psql -h localhost -U fraudshield -d fraudshield

# List tables
\dt

# Describe users_auth table
\d users_auth

# Describe otp_verifications table
\d otp_verifications

# Describe refresh_tokens table
\d refresh_tokens
```

## Integration with Application

The SQLAlchemy ORM models in `app/models/auth.py` correspond to these tables:

- `User` → `users_auth`
- `OtpVerification` → `otp_verifications`
- `RefreshToken` → `refresh_tokens`

## Future Migrations

When creating new migrations:

1. Use sequential numbering: `002_`, `003_`, etc.
2. Include both forward and rollback scripts
3. Add comments documenting requirements
4. Test thoroughly before committing
5. Update this README with migration details

## Troubleshooting

### "relation already exists" error

The migrations use `IF NOT EXISTS` clauses, so they're safe to re-run. However, if you encounter errors:

1. Check which tables exist: `\dt` in psql
2. Run the rollback script if needed
3. Re-run the forward migration

### Foreign key constraint errors

Ensure migrations are run in order. The system creates tables with proper dependency ordering.

### Permission errors

Ensure the database user has CREATE, ALTER, and DROP privileges on the database.
