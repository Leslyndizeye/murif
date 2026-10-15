from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db.session import Base


class Disposal(Base):
	__tablename__ = "disposals"

	id = Column(Integer, primary_key=True, index=True)
	request_number = Column(String, unique=True, index=True, nullable=False)

	station = Column(String, nullable=False)
	reason = Column(String, nullable=False)

	device_name = Column(String, nullable=False)
	serial_number = Column(String, nullable=False)
	device_type = Column(String, nullable=True)
	device_model = Column(String, nullable=True)
	rab_tag = Column(String, nullable=True)

	assigned_name = Column(String, nullable=True)
	assigned_position = Column(String, nullable=True)
	department = Column(String, nullable=True)
	guest_department = Column(String, nullable=True)

	condition = Column(String, nullable=True)
	disposal_date = Column(String, nullable=True)
	notes = Column(Text, nullable=True)

	requested_by_id = Column(Integer, nullable=True, index=True)
	requested_by_email = Column(String, nullable=True)

	document_id = Column(Integer, nullable=True, index=True)
	status = Column(String, default="pending", nullable=False, index=True)

	created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
	updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
