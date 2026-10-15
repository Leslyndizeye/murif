from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.disposal import Disposal
from app.models.document import Document
from app.models.user import User
from app.schemas.disposal_schema import DisposalCreateRequest, DisposalResponse

router = APIRouter()


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def _build_disposal_number(db: Session) -> str:
	date_part = datetime.utcnow().strftime("%Y%m%d")
	total = db.query(func.count(Disposal.id)).scalar() or 0
	return f"DSP-{date_part}-{total + 1:04d}"


def _build_document_ref(db: Session) -> str:
	year = datetime.utcnow().year
	total = db.query(func.count(Document.id)).scalar() or 0
	return f"RAB/TECH/{year}/{total + 1:03d}"


@router.post("/", response_model=DisposalResponse)
def create_disposal(payload: DisposalCreateRequest, db: Session = Depends(get_db)):
	requested_by = None
	requested_by_id = None
	if payload.requested_by_email:
		requested_by = db.query(User).filter(User.email == payload.requested_by_email).first()
		if not requested_by:
			raise HTTPException(status_code=404, detail="Requesting user not found")
		requested_by_id = requested_by.id

	disposal = Disposal(
		request_number=_build_disposal_number(db),
		station=payload.station,
		reason=payload.reason,
		device_name=payload.device_name,
		serial_number=payload.serial_number,
		device_type=payload.device_type,
		device_model=payload.device_model,
		rab_tag=payload.rab_tag,
		assigned_name=payload.assigned_name,
		assigned_position=payload.assigned_position,
		department=payload.department,
		guest_department=payload.guest_department,
		condition=payload.condition,
		disposal_date=payload.disposal_date,
		notes=payload.notes,
		requested_by_id=requested_by_id,
		requested_by_email=payload.requested_by_email,
		status="pending",
	)
	db.add(disposal)
	db.flush()

	linked_document = Document(
		document_ref=_build_document_ref(db),
		date=payload.disposal_date or datetime.utcnow().strftime("%Y-%m-%d"),
		name_of_staff=payload.assigned_name or (requested_by.full_name if requested_by else "Unknown Staff"),
		position=payload.assigned_position or "N/A",
		division=payload.department or payload.guest_department or "N/A",
		device_model=payload.device_model or payload.device_name,
		device_serial_number=payload.serial_number,
		rab_asset_code=payload.rab_tag,
		nature_of_problem=(
			f"Disposal request ({payload.reason}) submitted for device {payload.device_name}. "
			f"Condition: {payload.condition or 'not provided'}."
		),
		observation=payload.notes,
		key_recommendation=(
			"Recommend refurbishment and re-assignment." if payload.reason == "reuse" else "Recommend disposal approval and decommission process."
		),
		priority="medium",
		status="submitted",
		approval_status="pending",
		submitted_by_id=requested_by_id,
		disposal_id=disposal.id,
	)
	db.add(linked_document)
	db.flush()

	disposal.document_id = linked_document.id
	db.commit()
	db.refresh(disposal)
	return disposal


@router.get("/", response_model=list[DisposalResponse])
def list_disposals(db: Session = Depends(get_db)):
	return db.query(Disposal).order_by(Disposal.created_at.desc()).all()
