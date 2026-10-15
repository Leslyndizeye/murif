from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
	email: str
	password: str = Field(min_length=8)


class RegisterRequest(BaseModel):
	email: str
	password: str = Field(min_length=8)
	role: str = "USER"
	username: str | None = None
	full_name: str | None = None
	department: str | None = None
	station: str | None = None


class UserResponse(BaseModel):
	id: int | None = None
	email: str
	role: str
	username: str | None = None
	full_name: str | None = None
	department: str | None = None
	station: str | None = None


class AuthResponse(BaseModel):
	access_token: str
	token_type: str = "bearer"
	user: UserResponse
