from pydantic import BaseModel
from typing import Literal


class AdminCreateUserRequest(BaseModel):
	email: str
	delivery_method: Literal["email", "manual"] = "email"
	role: str = "USER"
	username: str | None = None
	full_name: str | None = None
	department: str | None = None
	station: str | None = None


class UserUpdateRequest(BaseModel):
	email: str | None = None
	username: str | None = None
	full_name: str | None = None
	department: str | None = None
	station: str | None = None
	role: str | None = None
