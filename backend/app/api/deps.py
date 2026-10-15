from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def get_authenticated_user(
	credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
	db: Session = Depends(get_db),
) -> User:
	email = decode_access_token(credentials.credentials)
	temporary_session = not email
	if temporary_session:
		email = decode_access_token(credentials.credentials, allow_temporary=True)
	if not email:
		raise HTTPException(status_code=401, detail="Invalid or expired token")

	user = db.query(User).filter(User.email == email).first()
	if not user:
		raise HTTPException(status_code=404, detail="User not found")
	if not user.is_active:
		raise HTTPException(status_code=403, detail="This account is inactive")
	if temporary_session and not user.must_change_password:
		raise HTTPException(status_code=401, detail="Sign in again with your new password")

	return user


def get_current_user(current_user: User = Depends(get_authenticated_user)) -> User:
	if current_user.must_change_password:
		raise HTTPException(status_code=403, detail="Change your temporary password before continuing")
	return current_user


def require_password_change_completed(
	request: Request,
	credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
	db: Session = Depends(get_db),
) -> None:
	# Keep the existing public endpoints available, while a signed-in account
	# with a temporary password can only inspect its session or change it.
	if request.url.path.rstrip('/') in {'/auth/login', '/auth/register', '/auth/me', '/auth/change-password', ''}:
		return
	if not credentials:
		return
	email = decode_access_token(credentials.credentials, allow_temporary=True)
	if email:
		user = db.query(User).filter(User.email == email).first()
		if user and (user.must_change_password or not decode_access_token(credentials.credentials)):
			raise HTTPException(status_code=403, detail="Change your temporary password before continuing")


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
