from sqlalchemy import Column, Integer, String, Boolean, DateTime, false
from datetime import datetime
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True)

    username = Column(String, nullable=True, unique=True)

    full_name = Column(String, nullable=True)

    department = Column(String, nullable=True)

    station = Column(String, nullable=True)

    password = Column(String)
    must_change_password = Column(Boolean, nullable=False, default=False, server_default=false())

    role = Column(String, default="USER")

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
