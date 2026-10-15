from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VoucherPriority = Literal["low", "medium", "high", "critical"]
VoucherStatus = Literal["open", "assigned", "in_progress", "resolved", "closed"]


class VoucherCreateRequest(BaseModel):
	title: str = Field(min_length=3, max_length=200)
	description: str = Field(min_length=5)
	priority: VoucherPriority = "medium"
	requester_email: str
	requester_name: str | None = None
	requester_station: str | None = None
	requester_department: str | None = None
	requester_role: str | None = None
	attachment_names: list[str] = Field(default_factory=list)


class VoucherUpdateRequest(BaseModel):
	status: VoucherStatus | None = None
	assigned_to_id: int | None = None
	diagnosis: str | None = None
	action_taken: str | None = None


class VoucherResponse(BaseModel):
	id: int
	ticket_number: str
	title: str
	description: str
	priority: VoucherPriority
	status: VoucherStatus
	requester_id: int
	requester_name: str
	requester_station: str | None = None
	requester_department: str | None = None
	requester_role: str | None = None
	assigned_to_id: int | None = None
	attachment_names: str | None = None
	diagnosis: str | None = None
	action_taken: str | None = None
	created_at: datetime
	updated_at: datetime
	resolved_at: datetime | None = None

	model_config = {"from_attributes": True}


class ITWorkloadItem(BaseModel):
	user_id: int
	email: str
	active_tickets: int


class VoucherOverviewResponse(BaseModel):
	total: int
	open: int
	assigned: int
	in_progress: int
	resolved: int
	closed: int
	workload: list[ITWorkloadItem]
