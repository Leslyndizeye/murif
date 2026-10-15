from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db.session import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
