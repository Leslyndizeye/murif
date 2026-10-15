from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def seed_lookup_tables(session: Session) -> None:
    # Backfills the new departments/stations tables from whatever free-text
    # values are already on existing users, so nothing already in use drops
    # out of the new dropdowns.
    from app.models.department import Department
    from app.models.station import Station
    from app.models.user import User

    existing_departments = {row[0] for row in session.query(Department.name).all()}
    for (value,) in session.query(User.department).filter(User.department.isnot(None), User.department != "").distinct():
        if value not in existing_departments:
            session.add(Department(name=value))
            existing_departments.add(value)

    existing_stations = {row[0] for row in session.query(Station.name).all()}
    for (value,) in session.query(User.station).filter(User.station.isnot(None), User.station != "").distinct():
        if value not in existing_stations:
            session.add(Station(name=value))
            existing_stations.add(value)

    session.commit()


def run_startup_migrations(engine) -> None:
    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}

    required_user_columns = {
        "username": "ALTER TABLE users ADD COLUMN username VARCHAR",
        "full_name": "ALTER TABLE users ADD COLUMN full_name VARCHAR",
        "department": "ALTER TABLE users ADD COLUMN department VARCHAR",
        "station": "ALTER TABLE users ADD COLUMN station VARCHAR",
        "updated_at": "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP",
    }

    document_columns = set()
    if "documents" in inspector.get_table_names():
        document_columns = {column["name"] for column in inspector.get_columns("documents")}

    required_document_columns = {
        "document_type": "ALTER TABLE documents ADD COLUMN document_type VARCHAR DEFAULT 'returning'",
        "recipient_email": "ALTER TABLE documents ADD COLUMN recipient_email VARCHAR",
        "source_of_computer": "ALTER TABLE documents ADD COLUMN source_of_computer VARCHAR",
        "acquisition_details": "ALTER TABLE documents ADD COLUMN acquisition_details VARCHAR",
        "receiving_comment": "ALTER TABLE documents ADD COLUMN receiving_comment TEXT",
        "user_signature": "ALTER TABLE documents ADD COLUMN user_signature VARCHAR",
        "user_signed_at": "ALTER TABLE documents ADD COLUMN user_signed_at TIMESTAMP",
        "signature_status": "ALTER TABLE documents ADD COLUMN signature_status VARCHAR DEFAULT 'not_required'",
        "asset_status": "ALTER TABLE documents ADD COLUMN asset_status VARCHAR DEFAULT 'active'",
        "approval_status": "ALTER TABLE documents ADD COLUMN approval_status VARCHAR DEFAULT 'pending'",
        "approved_by_id": "ALTER TABLE documents ADD COLUMN approved_by_id INTEGER",
        "approved_at": "ALTER TABLE documents ADD COLUMN approved_at TIMESTAMP",
        "approval_note": "ALTER TABLE documents ADD COLUMN approval_note TEXT",
        "disposal_id": "ALTER TABLE documents ADD COLUMN disposal_id INTEGER",
    }

    voucher_columns = set()
    if "vouchers" in inspector.get_table_names():
        voucher_columns = {column["name"] for column in inspector.get_columns("vouchers")}

    required_voucher_columns = {
        "requester_name": "ALTER TABLE vouchers ADD COLUMN requester_name VARCHAR DEFAULT ''",
        "requester_station": "ALTER TABLE vouchers ADD COLUMN requester_station VARCHAR",
        "requester_department": "ALTER TABLE vouchers ADD COLUMN requester_department VARCHAR",
        "requester_role": "ALTER TABLE vouchers ADD COLUMN requester_role VARCHAR",
        "attachment_names": "ALTER TABLE vouchers ADD COLUMN attachment_names TEXT",
    }

    disposal_columns = set()
    if "disposals" in inspector.get_table_names():
        disposal_columns = {column["name"] for column in inspector.get_columns("disposals")}

    required_disposal_columns = {
        "request_number": "ALTER TABLE disposals ADD COLUMN request_number VARCHAR",
        "document_id": "ALTER TABLE disposals ADD COLUMN document_id INTEGER",
        "status": "ALTER TABLE disposals ADD COLUMN status VARCHAR DEFAULT 'pending'",
    }

    with engine.begin() as connection:
        for column_name, ddl in required_user_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))

        # Normalize legacy role casing (e.g., it, It) to uppercase for consistent auth/assignment behavior.
        connection.execute(text("UPDATE users SET role = UPPER(role) WHERE role IS NOT NULL AND role != UPPER(role)"))

        # The "virtual" role was renamed to "voucher" (it now owns the asset-voucher dashboard).
        connection.execute(text("UPDATE users SET role = 'VOUCHER' WHERE role = 'VIRTUAL'"))

        for column_name, ddl in required_document_columns.items():
            if document_columns and column_name not in document_columns:
                connection.execute(text(ddl))

        for column_name, ddl in required_voucher_columns.items():
            if voucher_columns and column_name not in voucher_columns:
                connection.execute(text(ddl))

        for column_name, ddl in required_disposal_columns.items():
            if disposal_columns and column_name not in disposal_columns:
                connection.execute(text(ddl))
