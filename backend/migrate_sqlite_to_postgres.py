"""
Migration helper: copy data from a SQLite file to a PostgreSQL database.

Usage:
  python migrate_sqlite_to_postgres.py --sqlite ./app.db --postgres postgresql://user:pass@host:5432/dbname

Options:
  --sqlite   Path to the source SQLite file (default: ./app.db)
  --postgres Destination SQLAlchemy URL (default: read from env DATABASE_URL)
  --drop     If provided, drop and recreate target tables before importing
  --dry-run  Print counts only; do not write to target

This script:
- Reflects tables from the source SQLite database
- Creates missing tables on the target (using app models metadata)
- Copies rows table-by-table in a safe order (users -> vouchers -> documents -> disposals -> notifications)
- Resets PostgreSQL sequences for id columns

Notes:
- Ensure the target PostgreSQL server is running and reachable.
- Back up both databases before running in production.
"""

import argparse
import os
import sys
from sqlalchemy import create_engine, MetaData, Table, select, text
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
# Importing the model modules registers their tables on Base.metadata.
# Without this, Base.metadata is empty and create_all() creates nothing.
from app.models import user, voucher, document, disposal, sla_config, notification

ORDERED_TABLES = [
    "users",
    "vouchers",
    "documents",
    "disposals",
    "notifications",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Migrate SQLite -> PostgreSQL")
    parser.add_argument("--sqlite", default="./app.db", help="Path to source SQLite file")
    parser.add_argument("--postgres", default=os.getenv("DATABASE_URL"), help="Destination PostgreSQL URL")
    parser.add_argument("--drop", action="store_true", help="Drop and recreate target tables before import")
    parser.add_argument("--dry-run", action="store_true", help="Do not write any data; just report counts")
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.postgres:
        print("ERROR: No destination PostgreSQL URL provided. Use --postgres or set DATABASE_URL env var.")
        sys.exit(1)

    sqlite_path = args.sqlite
    if not os.path.exists(sqlite_path):
        print(f"ERROR: SQLite file not found: {sqlite_path}")
        sys.exit(1)

    sqlite_url = f"sqlite:///{os.path.abspath(sqlite_path)}"
    print(f"Source (SQLite): {sqlite_url}")
    print(f"Target (Postgres): {args.postgres}")

    source_engine = create_engine(sqlite_url)
    target_engine = create_engine(args.postgres)

    # Reflect source metadata
    source_meta = MetaData()
    source_meta.reflect(bind=source_engine)

    # Ensure target tables exist (create using models metadata)
    if args.drop:
        print("Dropping and recreating target tables (use with care)...")
        Base.metadata.drop_all(bind=target_engine)

    print("Creating missing tables on target using models metadata...")
    Base.metadata.create_all(bind=target_engine)

    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    summary = {}

    # target_engine.begin() commits automatically on a clean exit (and rolls
    # back on error) — a plain .connect() does neither, which silently
    # discarded every inserted row on close.
    with source_engine.connect() as s_conn, target_engine.begin() as t_conn:
        for table_name in ORDERED_TABLES:
            if table_name not in source_meta.tables:
                print(f"Skipping missing source table: {table_name}")
                continue

            src_table = source_meta.tables[table_name]
            tgt_table = target_meta.tables.get(table_name)
            if tgt_table is None:
                print(f"Target table {table_name} not found on target; skipping")
                continue

            count = s_conn.execute(select([src_table.c]).count()).scalar() if False else None
            # fetch rows
            rows = s_conn.execute(select(src_table)).mappings().all()
            row_count = len(rows)
            summary[table_name] = row_count
            print(f"Table '{table_name}': {row_count} rows found in source")

            if args.dry_run:
                continue

            if row_count == 0:
                continue

            # Insert rows into target in batches
            BATCH = 500
            inserted = 0
            for i in range(0, row_count, BATCH):
                batch = rows[i : i + BATCH]
                # Convert rows to plain dicts and remove unsupported fields if needed
                dicts = [dict(r) for r in batch]
                try:
                    t_conn.execute(tgt_table.insert(), dicts)
                    inserted += len(dicts)
                except Exception as e:
                    print(f"Error inserting batch into {table_name}: {e}")
                    # Try row-by-row to identify problematic records
                    for d in dicts:
                        try:
                            t_conn.execute(tgt_table.insert(), d)
                            inserted += 1
                        except Exception as e2:
                            print(f"  Failed to insert row into {table_name}: {e2}\n  Row: {d}")
            print(f"Inserted {inserted}/{row_count} rows into target.{table_name}")

        # Reset Postgres sequences for tables with 'id' serial
        print("Resetting Postgres sequences for serial id columns...")
        for table_name in ORDERED_TABLES:
            if table_name not in target_meta.tables:
                continue
            try:
                seq_sql = text(
                    "SELECT pg_get_serial_sequence(:tbl, 'id') as seq"
                )
                seq_res = t_conn.execute(seq_sql, {"tbl": table_name}).fetchone()
                seq = seq_res and seq_res[0]
                if seq:
                    max_id = t_conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")).scalar()
                    t_conn.execute(text(f"SELECT setval('{seq}', {max_id}, true)"))
                    print(f"Sequence for {table_name} set to {max_id}")
            except Exception:
                # ignore tables without sequences
                pass

    print("Migration summary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    print("Done.")


if __name__ == '__main__':
    main()
