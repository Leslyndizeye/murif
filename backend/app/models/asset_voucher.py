from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.db.session import Base


class AssetVoucher(Base):
    __tablename__ = "asset_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    voucher_number = Column(String, unique=True, index=True, nullable=False)

    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    issued_to = Column(String, nullable=False)
    issued_by = Column(String, nullable=False)
    date_issued = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_returned = Column(DateTime, nullable=True)
    status = Column(String, default="Issued", index=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
