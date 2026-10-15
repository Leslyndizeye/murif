from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def get_current_user(
	credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
	db: Session = Depends(get_db),
) -> User:
	email = decode_access_token(credentials.credentials)
	if not email:
		raise HTTPException(status_code=401, detail="Invalid or expired token")

	user = db.query(User).filter(User.email == email).first()
	if not user:
		raise HTTPException(status_code=404, detail="User not found")

	return user


def require_it_user(current_user: User = Depends(get_current_user)) -> User:
	if (current_user.role or "").upper() not in {"IT", "ADMIN"}:
		raise HTTPException(status_code=403, detail="Only IT personnel can perform this action")
	return current_user


def require_users_read_access(current_user: User = Depends(get_current_user)) -> User:
	# Broader than require_it_user: covers roles that only need to look up
	# users (e.g. voucher/manager picking an assignee) without granting
	# write access (create, edit, reset password, activate/deactivate).
	if (current_user.role or "").upper() not in {"IT", "ADMIN", "MANAGER", "VOUCHER"}:
		raise HTTPException(status_code=403, detail="You do not have access to the user directory")
	return current_user
