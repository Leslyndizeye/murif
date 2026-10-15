from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class Voucher(Base):
	__tablename__ = "vouchers"

	id = Column(Integer, primary_key=True, index=True)
	ticket_number = Column(String, unique=True, index=True, nullable=False)
	title = Column(String, nullable=False)
	description = Column(Text, nullable=False)
	priority = Column(String, default="medium", nullable=False)
	status = Column(String, default="open", index=True, nullable=False)

	requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
	requester_name = Column(String, nullable=False)
	requester_station = Column(String, nullable=True)
	requester_department = Column(String, nullable=True)
	requester_role = Column(String, nullable=True)
	assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
	attachment_names = Column(Text, nullable=True)

	diagnosis = Column(Text, nullable=True)
	action_taken = Column(Text, nullable=True)

	created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
	updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
	resolved_at = Column(DateTime, nullable=True)
