"""
Initialize authentication database tables.
Phase 9: SentinelPay Advanced Features

This script:
1. Creates authentication tables from schema_auth.sql
2. Verifies table creation
3. Sets up database constraints and indexes
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

import psycopg
from psycopg.rows import dict_row


def get_db_connection():
    """Create database connection."""
    return psycopg.connect(
        host='localhost',
        port=5432,
        dbname='fraudshield',
        user='fraudshield',
        password='fraudshield_dev',
        row_factory=dict_row
    )


def read_schema_file(filepath: str) -> str:
    """Read SQL schema file."""
    schema_path = Path(__file__).parent / filepath
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    
    with open(schema_path, 'r') as f:
        return f.read()


def execute_schema(conn, schema_sql: str):
    """Execute schema SQL statements."""
    with conn.cursor() as cursor:
        try:
            # Execute entire schema as one transaction
            cursor.execute(schema_sql)
            conn.commit()
            print("  ✓ Schema executed successfully")
        except Exception as e:
            conn.rollback()
            # Some statements might fail if already exists - try to continue
            if 'already exists' in str(e).lower():
                print(f"  ⚠ Some objects already exist (skipped)")
            else:
                print(f"  ✗ Schema execution failed: {e}")
                raise


def verify_tables(conn):
    """Verify that all auth tables were created."""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'auth_users', 
                'otp_verifications', 
                'refresh_tokens',
                'guardian_relationships',
                'guardian_approval_requests'
            )
            ORDER BY table_name
        """)
        
        tables = [row['table_name'] for row in cursor.fetchall()]
        
        expected_tables = [
            'auth_users',
            'otp_verifications', 
            'refresh_tokens',
            'guardian_relationships',
            'guardian_approval_requests'
        ]
        
        print("\n📊 Table Verification:")
        for table in expected_tables:
            if table in tables:
                print(f"  ✓ {table}")
            else:
                print(f"  ✗ {table} NOT FOUND")
        
        return set(expected_tables) == set(tables)


def verify_indexes(conn):
    """Verify that indexes were created."""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT 
                schemaname,
                tablename,
                indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN (
                'auth_users', 
                'otp_verifications', 
                'refresh_tokens',
                'guardian_relationships',
                'guardian_approval_requests'
            )
            ORDER BY tablename, indexname
        """)
        
        indexes = cursor.fetchall()
        
        print(f"\n🔍 Found {len(indexes)} indexes:")
        current_table = None
        for idx in indexes:
            if idx['tablename'] != current_table:
                current_table = idx['tablename']
                print(f"\n  {current_table}:")
            print(f"    - {idx['indexname']}")


def verify_constraints(conn):
    """Verify that constraints were created."""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT 
                tc.table_name,
                tc.constraint_name,
                tc.constraint_type
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public'
            AND tc.table_name IN (
                'auth_users', 
                'otp_verifications', 
                'refresh_tokens',
                'guardian_relationships',
                'guardian_approval_requests'
            )
            ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
        """)
        
        constraints = cursor.fetchall()
        
        print(f"\n🔐 Found {len(constraints)} constraints:")
        current_table = None
        for const in constraints:
            if const['table_name'] != current_table:
                current_table = const['table_name']
                print(f"\n  {current_table}:")
            print(f"    - {const['constraint_type']}: {const['constraint_name']}")


def main():
    """Main initialization function."""
    print("=" * 60)
    print("SentinelPay Authentication Database Initialization")
    print("=" * 60)
    
    try:
        # Connect to database
        print("\n1. Connecting to database...")
        conn = get_db_connection()
        print("  ✓ Connected to PostgreSQL")
        
        # Read schema file
        print("\n2. Reading schema file...")
        schema_sql = read_schema_file('schema_auth.sql')
        print("  ✓ Schema file loaded")
        
        # Execute schema
        print("\n3. Executing schema SQL...")
        execute_schema(conn, schema_sql)
        print("  ✓ Schema executed successfully")
        
        # Verify tables
        print("\n4. Verifying tables...")
        if verify_tables(conn):
            print("\n  ✓ All tables created successfully")
        else:
            print("\n  ⚠ Some tables missing - check output above")
        
        # Verify indexes
        print("\n5. Verifying indexes...")
        verify_indexes(conn)
        
        # Verify constraints
        print("\n6. Verifying constraints...")
        verify_constraints(conn)
        
        # Close connection
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Database initialization complete!")
        print("=" * 60)
        print("\nNext steps:")
        print("  1. Implement authentication API endpoints")
        print("  2. Test OTP generation and verification")
        print("  3. Test user registration and login")
        print("  4. Implement guardian management endpoints")
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
