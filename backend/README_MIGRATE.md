# Migrating SQLite -> PostgreSQL

This repository includes a helper script to migrate existing data from the local SQLite database (`app.db`) into a PostgreSQL database.

WARNING: Always back up your databases before running migrations.

## Requirements
- Python virtualenv activated with project deps installed (`.venv`)
- PostgreSQL server running and reachable

## Usage
1. Create a `.env` in the repository root (you can copy from `.env.example`) and set `DATABASE_URL` for the target Postgres, or pass the URL as an argument.

2. Run the migration (dry-run first):

```powershell
cd ASM/backend
# Dry run: report counts without writing
python migrate_sqlite_to_postgres.py --sqlite ./app.db --postgres postgresql://asm_user:asm_password@localhost:5432/asm_db --dry-run
```

3. Run the real migration:

```powershell
python migrate_sqlite_to_postgres.py --sqlite ./app.db --postgres postgresql://asm_user:asm_password@localhost:5432/asm_db
```

4. If you'd like to drop and recreate the target tables before import (destructive):

```powershell
python migrate_sqlite_to_postgres.py --sqlite ./app.db --postgres postgresql://asm_user:asm_password@localhost:5432/asm_db --drop
```

## Notes
- The script will create missing tables on the target using the SQLAlchemy `Base.metadata` declared in the project models.
- The default table import order is: `users`, `vouchers`, `documents`, `disposals`, `notifications`. If you have additional tables, the script will skip unknown tables gracefully.
- After inserting rows the script attempts to reset PostgreSQL sequences for `id` columns so auto-increment values continue correctly.

If you want me to automate running this from the `deploy_production.ps1` pipeline or to support more tables, tell me and I will extend the script accordingly.
