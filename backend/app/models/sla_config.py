from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.db.session import Base


class SLAConfig(Base):
    __tablename__ = "sla_configs"

    id = Column(Integer, primary_key=True, index=True)
    low_hours = Column(Integer, default=72, nullable=False)
    medium_hours = Column(Integer, default=48, nullable=False)
    high_hours = Column(Integer, default=24, nullable=False)
    critical_hours = Column(Integer, default=8, nullable=False)
    at_risk_ratio_percent = Column(Integer, default=70, nullable=False)
    escalation_target_email = Column(String, nullable=True)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
