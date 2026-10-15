from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import verify_password, hash_password, create_access_token, decode_access_token
from app.schemas.auth_schema import LoginRequest, RegisterRequest, AuthResponse, UserResponse

router = APIRouter()
bearer_scheme = HTTPBearer()

ORG_DOMAIN = "@icttoolsasm.com"


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        username=user.username,
        full_name=user.full_name,
        department=user.department,
        station=user.station,
    )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:

    email = payload.email
    password = payload.password

    # Rule 1: Check organization email
    if not email.endswith(ORG_DOMAIN):
        raise HTTPException(status_code=400, detail="Use organization email")

    # Rule 2: Password minimum 8 characters
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check if user exists
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Verify password
    if not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Invalid password")

    access_token = create_access_token(user.email)

    return AuthResponse(
        access_token=access_token,
        user=to_user_response(user)
    )


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if not payload.email.endswith(ORG_DOMAIN):
        raise HTTPException(status_code=400, detail="Use organization email")

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Self-service registration must never let the caller pick their own
    # role — role is always USER here; elevation only happens through the
    # admin-only /users/create-user or /users/{id} endpoints.
    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        department=payload.department,
        station=payload.station,
        password=hash_password(payload.password),
        role="USER",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.email)

    return AuthResponse(
        access_token=access_token,
        user=to_user_response(user)
    )


@router.get("/me")
def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> UserResponse:
    email = decode_access_token(credentials.credentials)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return to_user_response(user)