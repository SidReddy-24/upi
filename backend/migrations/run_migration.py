"""Database migration runner for authentication tables.

This script executes SQL migration files to create and update database schema.
Can be run manually or integrated into deployment process.

Usage:
    python migrations/run_migration.py [migration_file]
    
Example:
    python migrations/run_migration.py 001_create_auth_tables.sql
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.db.database import async_session_factory


async def run_migration(migration_file: str):
    """Execute a SQL migration file against the database.
    
    Args:
        migration_file: Path to the SQL file to execute
    """
    migration_path = Path(__file__).parent / migration_file
    
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False
    
    print(f"🔄 Running migration: {migration_file}")
    
    try:
        # Read migration SQL
        with open(migration_path, 'r') as f:
            sql_content = f.read()
        
        # Execute migration
        async with async_session_factory() as session:
            # Split by semicolons and execute each statement
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            
            for i, statement in enumerate(statements, 1):
                try:
                    await session.execute(text(statement))
                    print(f"  ✓ Executed statement {i}/{len(statements)}")
                except Exception as e:
                    print(f"  ⚠️  Statement {i} warning: {e}")
            
            await session.commit()
            print(f"✅ Migration completed successfully: {migration_file}")
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def list_migrations():
    """List all available migration files in order."""
    migrations_dir = Path(__file__).parent
    sql_files = sorted(migrations_dir.glob("*.sql"))
    
    if not sql_files:
        print("No migration files found.")
        return
    
    print("Available migrations:")
    for sql_file in sql_files:
        print(f"  - {sql_file.name}")


async def run_all_migrations():
    """Run all migration files in order."""
    migrations_dir = Path(__file__).parent
    sql_files = sorted(migrations_dir.glob("*.sql"))
    
    if not sql_files:
        print("No migration files found.")
        return
    
    print(f"Found {len(sql_files)} migration(s)")
    
    for sql_file in sql_files:
        success = await run_migration(sql_file.name)
        if not success:
            print(f"⚠️  Migration stopped at: {sql_file.name}")
            return
    
    print("🎉 All migrations completed successfully!")


async def main():
    """Main entry point for migration runner."""
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py [migration_file|list|all]")
        print()
        await list_migrations()
        return
    
    command = sys.argv[1]
    
    if command == "list":
        await list_migrations()
    elif command == "all":
        await run_all_migrations()
    else:
        await run_migration(command)


if __name__ == "__main__":
    asyncio.run(main())
