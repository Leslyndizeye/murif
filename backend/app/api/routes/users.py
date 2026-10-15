from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.models.voucher import Voucher
from app.models.document import Document
from app.core.security import generate_temporary_password, hash_password
from app.api.deps import require_it_user, require_users_read_access
from app.schemas.user_schema import AdminCreateUserRequest, UserUpdateRequest
from app.services.email_service import EmailDeliveryError, send_welcome_email

router = APIRouter()
ORG_DOMAIN = "@icttoolsasm.com"


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class UpdateUserStatusRequest(BaseModel):
    is_active: bool

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/create-user")
def create_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_it_user),
):

    if not payload.email.endswith(ORG_DOMAIN):
        raise HTTPException(status_code=400, detail="Use organization email")

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    temporary_password = generate_temporary_password()

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        department=payload.department,
        station=payload.station,
        password=hash_password(temporary_password),
        role=(payload.role or "USER").upper(),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        send_welcome_email(
            to_email=user.email,
            full_name=user.full_name,
            username=user.username,
            temporary_password=temporary_password,
        )
    except EmailDeliveryError as exc:
        # The account was created but the user has no way to learn the
        # password, so undo it and surface the failure to the admin instead
        # of leaving an inaccessible account behind.
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"message": "User created successfully. Login details were emailed to them."}


@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_users_read_access),
):
    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "department": user.department,
            "station": user.station,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.get("/it-personnel")
def list_it_personnel(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .filter(func.lower(User.role) == "it", User.is_active.is_(True))
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "department": user.department,
            "station": user.station,
            "role": user.role,
        }
        for user in users
    ]


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_it_user: User = Depends(require_it_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None and user.id == current_it_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    if payload.email is not None:
        if not payload.email.endswith(ORG_DOMAIN):
            raise HTTPException(status_code=400, detail="Use organization email")
        existing = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = payload.email

    if payload.username is not None:
        existing = db.query(User).filter(User.username == payload.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = payload.username

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.department is not None:
        user.department = payload.department

    if payload.station is not None:
        user.station = payload.station

    if payload.role is not None:
        user.role = payload.role.upper()

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "department": user.department,
        "station": user.station,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_it_user: User = Depends(require_it_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_it_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    has_voucher_history = (
        db.query(Voucher.id)
        .filter((Voucher.requester_id == user_id) | (Voucher.assigned_to_id == user_id))
        .first()
        is not None
    )
    has_document_history = (
        db.query(Document.id)
        .filter((Document.approved_by_id == user_id) | (Document.submitted_by_id == user_id))
        .first()
        is not None
    )

    if has_voucher_history or has_document_history:
        raise HTTPException(
            status_code=400,
            detail="This user has ticket or document history and cannot be deleted. Deactivate the account instead.",
        )

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.patch("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_it_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset successfully"}


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UpdateUserStatusRequest,
    db: Session = Depends(get_db),
    current_it_user: User = Depends(require_it_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_it_user.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    user.is_active = payload.is_active
    db.commit()
    return {"message": "User status updated successfully"}