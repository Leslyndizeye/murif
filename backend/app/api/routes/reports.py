from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.models.notification import TicketNotification
from app.models.sla_config import SLAConfig
from app.models.user import User
from app.models.voucher import Voucher
from app.schemas.sla_schema import (
	SLAConfigResponse,
	SLAConfigUpdateRequest,
	SLAEvaluationResponse,
	TicketNotificationResponse,
)
from app.schemas.voucher_schema import ITWorkloadItem, VoucherOverviewResponse

router = APIRouter()


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def get_or_create_sla_config(db: Session) -> SLAConfig:
	config = db.query(SLAConfig).first()
	if config:
		return config

	config = SLAConfig()
	db.add(config)
	db.commit()
	db.refresh(config)
	return config


def resolve_limit_hours(config: SLAConfig, priority: str) -> int:
	priority_key = (priority or "medium").lower()
	mapping = {
		"low": config.low_hours,
		"medium": config.medium_hours,
		"high": config.high_hours,
		"critical": config.critical_hours,
	}
	return mapping.get(priority_key, config.medium_hours)


def ensure_notification(
	db: Session,
	voucher: Voucher,
	category: str,
	severity: str,
	message: str,
	target_email: str | None,
) -> bool:
	window_start = datetime.utcnow() - timedelta(hours=24)
	exists = (
		db.query(TicketNotification)
		.filter(
			TicketNotification.voucher_id == voucher.id,
			TicketNotification.category == category,
			TicketNotification.created_at >= window_start,
		)
		.first()
	)
	if exists:
		return False

	notification = TicketNotification(
		voucher_id=voucher.id,
		category=category,
		severity=severity,
		message=message,
		target_email=target_email,
	)
	db.add(notification)
	return True


def evaluate_sla_and_create_notifications(db: Session) -> tuple[int, int]:
	config = get_or_create_sla_config(db)
	active_tickets = (
		db.query(Voucher)
		.filter(Voucher.status.in_(["open", "assigned", "in_progress"]))
		.order_by(Voucher.created_at.desc())
		.all()
	)

	created = 0
	for ticket in active_tickets:
		created_at = ticket.created_at or datetime.utcnow()
		age_hours = max(0, (datetime.utcnow() - created_at).total_seconds() / 3600)
		limit_hours = resolve_limit_hours(config, ticket.priority)
		at_risk_limit = limit_hours * (config.at_risk_ratio_percent / 100)

		if age_hours >= limit_hours:
			message = (
				f"Ticket {ticket.ticket_number} breached SLA at {int(age_hours)}h "
				f"(limit {limit_hours}h)."
			)
			if config.notifications_enabled and config.escalation_target_email:
				message += f" Email hook queued to {config.escalation_target_email}."

			if ensure_notification(
				db,
				ticket,
				category="sla_breached",
				severity="high",
				message=message,
				target_email=config.escalation_target_email,
			):
				created += 1
		elif age_hours >= at_risk_limit:
			message = (
				f"Ticket {ticket.ticket_number} is at SLA risk at {int(age_hours)}h "
				f"(limit {limit_hours}h)."
			)
			if ensure_notification(
				db,
				ticket,
				category="sla_at_risk",
				severity="medium",
				message=message,
				target_email=config.escalation_target_email if config.notifications_enabled else None,
			):
				created += 1

	db.commit()
	return len(active_tickets), created


@router.get("/overview", response_model=VoucherOverviewResponse)
def vouchers_overview(db: Session = Depends(get_db)):
	total = db.query(func.count(Voucher.id)).scalar() or 0
	open_count = db.query(func.count(Voucher.id)).filter(Voucher.status == "open").scalar() or 0
	assigned_count = db.query(func.count(Voucher.id)).filter(Voucher.status == "assigned").scalar() or 0
	in_progress_count = db.query(func.count(Voucher.id)).filter(Voucher.status == "in_progress").scalar() or 0
	resolved_count = db.query(func.count(Voucher.id)).filter(Voucher.status == "resolved").scalar() or 0
	closed_count = db.query(func.count(Voucher.id)).filter(Voucher.status == "closed").scalar() or 0

	it_users = db.query(User).filter(func.lower(User.role) == "it", User.is_active.is_(True)).all()
	workload: list[ITWorkloadItem] = []

	for it_user in it_users:
		active_tickets = (
			db.query(func.count(Voucher.id))
			.filter(
				Voucher.assigned_to_id == it_user.id,
				Voucher.status.in_(["open", "assigned", "in_progress"]),
			)
			.scalar()
			or 0
		)
		workload.append(
			ITWorkloadItem(
				user_id=it_user.id,
				email=it_user.email,
				active_tickets=active_tickets,
			)
		)

	return VoucherOverviewResponse(
		total=total,
		open=open_count,
		assigned=assigned_count,
		in_progress=in_progress_count,
		resolved=resolved_count,
		closed=closed_count,
		workload=workload,
	)


@router.get("/sla-config", response_model=SLAConfigResponse)
def get_sla_config(db: Session = Depends(get_db)):
	return get_or_create_sla_config(db)


@router.put("/sla-config", response_model=SLAConfigResponse)
def update_sla_config(payload: SLAConfigUpdateRequest, db: Session = Depends(get_db)):
	config = get_or_create_sla_config(db)
	for key, value in payload.model_dump().items():
		setattr(config, key, value)

	db.commit()
	db.refresh(config)
	return config


@router.post("/check-sla", response_model=SLAEvaluationResponse)
def check_sla(db: Session = Depends(get_db)):
	checked_tickets, created_notifications = evaluate_sla_and_create_notifications(db)
	return SLAEvaluationResponse(
		checked_tickets=checked_tickets,
		created_notifications=created_notifications,
	)


@router.get("/notifications", response_model=list[TicketNotificationResponse])
def get_notifications(
	voucher_id: int | None = Query(default=None),
	unread_only: bool = Query(default=False),
	target_email: str | None = Query(default=None),
	limit: int = Query(default=30, ge=1, le=200),
	db: Session = Depends(get_db),
):
	_ = evaluate_sla_and_create_notifications(db)
	query = db.query(TicketNotification)
	if voucher_id is not None:
		query = query.filter(TicketNotification.voucher_id == voucher_id)
	if unread_only:
		query = query.filter(TicketNotification.is_read.is_(False))
	if target_email:
		normalized_target_email = target_email.lower()
		query = query.filter(
			or_(
				TicketNotification.target_email.is_(None),
				func.lower(TicketNotification.target_email) == normalized_target_email,
			)
		)

	return query.order_by(TicketNotification.created_at.desc()).limit(limit).all()


@router.patch("/notifications/{notification_id}/read", response_model=TicketNotificationResponse)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
	notification = db.query(TicketNotification).filter(TicketNotification.id == notification_id).first()
	if not notification:
		raise HTTPException(status_code=404, detail="Notification not found")

	notification.is_read = True
	db.commit()
	db.refresh(notification)
	return notification


@router.post("/notifications/read-all")
def mark_all_notifications_read(payload: dict, db: Session = Depends(get_db)):
	voucher_id = payload.get("voucher_id") if isinstance(payload, dict) else None
	target_email = payload.get("target_email") if isinstance(payload, dict) else None
	query = db.query(TicketNotification).filter(TicketNotification.is_read.is_(False))
	if voucher_id is not None:
		query = query.filter(TicketNotification.voucher_id == voucher_id)
	if target_email:
		normalized_target_email = target_email.lower()
		query = query.filter(
			or_(
				TicketNotification.target_email.is_(None),
				func.lower(TicketNotification.target_email) == normalized_target_email,
			)
		)

	updated = query.update({TicketNotification.is_read: True}, synchronize_session=False)
	db.commit()
	return {"updated": updated}
