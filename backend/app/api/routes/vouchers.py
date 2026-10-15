from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.notification import TicketNotification
from app.models.user import User
from app.models.voucher import Voucher
from app.schemas.voucher_schema import VoucherCreateRequest, VoucherResponse, VoucherStatus, VoucherUpdateRequest

router = APIRouter()

ACTIVE_TICKET_STATUSES = ["open", "assigned", "in_progress"]


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def _build_ticket_number(db: Session) -> str:
	date_part = datetime.utcnow().strftime("%Y%m%d")
	total = db.query(func.count(Voucher.id)).scalar() or 0
	return f"TKT-{date_part}-{total + 1:04d}"


def _pick_it_personnel(db: Session) -> User | None:
	it_users = db.query(User).filter(func.lower(User.role) == "it", User.is_active.is_(True)).all()
	if not it_users:
		return None

	selected_user = None
	minimum_load = None
	for it_user in it_users:
		workload = (
			db.query(func.count(Voucher.id))
			.filter(
				Voucher.assigned_to_id == it_user.id,
				Voucher.status.in_(ACTIVE_TICKET_STATUSES),
			)
			.scalar()
			or 0
		)

		if minimum_load is None or workload < minimum_load:
			minimum_load = workload
			selected_user = it_user

	return selected_user


@router.post("/", response_model=VoucherResponse)
def create_voucher(payload: VoucherCreateRequest, db: Session = Depends(get_db)):
	requester = db.query(User).filter(User.email == payload.requester_email).first()
	if not requester:
		raise HTTPException(status_code=404, detail="Requester user not found")

	selected_it_user = _pick_it_personnel(db)
	status = "assigned" if selected_it_user else "open"

	voucher = Voucher(
		ticket_number=_build_ticket_number(db),
		title=payload.title,
		description=payload.description,
		priority=payload.priority,
		status=status,
		requester_id=requester.id,
		requester_name=payload.requester_name or requester.full_name or requester.username or requester.email,
		requester_station=payload.requester_station or requester.station,
		requester_department=payload.requester_department or requester.department,
		requester_role=payload.requester_role or requester.role,
		assigned_to_id=selected_it_user.id if selected_it_user else None,
		attachment_names=json.dumps(payload.attachment_names or []),
	)

	db.add(voucher)
	db.flush()

	if selected_it_user:
		notification = TicketNotification(
			voucher_id=voucher.id,
			category="ticket_assigned",
			severity="medium",
			message=f"New ticket {voucher.ticket_number} assigned to you: {voucher.title}",
			target_email=selected_it_user.email,
		)
		db.add(notification)
	else:
		# Broadcast open-ticket alerts so any IT dashboard can pick it up.
		notification = TicketNotification(
			voucher_id=voucher.id,
			category="ticket_open",
			severity="medium",
			message=f"New open ticket {voucher.ticket_number}: {voucher.title}",
			target_email=None,
		)
		db.add(notification)

	db.commit()
	db.refresh(voucher)
	return voucher


@router.get("/", response_model=list[VoucherResponse])
def list_vouchers(
	status: VoucherStatus | None = Query(default=None),
	assigned_to_id: int | None = Query(default=None),
	db: Session = Depends(get_db),
):
	query = db.query(Voucher)

	if status:
		query = query.filter(Voucher.status == status)
	if assigned_to_id is not None:
		query = query.filter(Voucher.assigned_to_id == assigned_to_id)

	return query.order_by(Voucher.created_at.desc()).all()


@router.patch("/{voucher_id}", response_model=VoucherResponse)
def update_voucher(voucher_id: int, payload: VoucherUpdateRequest, db: Session = Depends(get_db)):
	voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
	if not voucher:
		raise HTTPException(status_code=404, detail="Voucher not found")

	update_data = payload.model_dump(exclude_unset=True)
	previous_assigned_to_id = voucher.assigned_to_id
	assignee = None

	if "assigned_to_id" in update_data and update_data["assigned_to_id"] is not None:
		assignee = (
			db.query(User)
			.filter(User.id == update_data["assigned_to_id"], User.role == "IT", User.is_active.is_(True))
			.first()
		)
		if not assignee:
			raise HTTPException(status_code=400, detail="Assigned user must be an active IT personnel")

	for key, value in update_data.items():
		setattr(voucher, key, value)

	if voucher.status in ["resolved", "closed"] and voucher.resolved_at is None:
		voucher.resolved_at = datetime.utcnow()

	if (
		"assigned_to_id" in update_data
		and voucher.assigned_to_id is not None
		and voucher.assigned_to_id != previous_assigned_to_id
	):
		if not assignee:
			assignee = db.query(User).filter(User.id == voucher.assigned_to_id).first()
		if assignee:
			notification = TicketNotification(
				voucher_id=voucher.id,
				category="ticket_assigned",
				severity="medium",
				message=f"Ticket {voucher.ticket_number} assigned to you: {voucher.title}",
				target_email=assignee.email,
			)
			db.add(notification)

	db.commit()
	db.refresh(voucher)
	return voucher
