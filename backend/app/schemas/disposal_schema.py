from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DisposalReason = Literal["reuse", "dispose"]
DisposalStatus = Literal["pending", "approved", "rejected"]


class DisposalCreateRequest(BaseModel):
    station: str = Field(min_length=2)
    reason: DisposalReason

    device_name: str = Field(min_length=2)
    serial_number: str = Field(min_length=2)
    device_type: str | None = None
    device_model: str | None = None
    rab_tag: str | None = None

    assigned_name: str | None = None
    assigned_position: str | None = None
    department: str | None = None
    guest_department: str | None = None

    condition: str | None = None
    disposal_date: str | None = None
    notes: str | None = None

    requested_by_email: str | None = None


class DisposalResponse(BaseModel):
    id: int
    request_number: str
    station: str
    reason: str

    device_name: str
    serial_number: str
    device_type: str | None = None
    device_model: str | None = None
    rab_tag: str | None = None

    assigned_name: str | None = None
    assigned_position: str | None = None
    department: str | None = None
    guest_department: str | None = None

    condition: str | None = None
    disposal_date: str | None = None
    notes: str | None = None

    requested_by_id: int | None = None
    requested_by_email: str | None = None

    document_id: int | None = None
    status: DisposalStatus

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
