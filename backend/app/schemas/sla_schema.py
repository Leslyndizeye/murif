from datetime import datetime

from pydantic import BaseModel, Field


class SLAConfigUpdateRequest(BaseModel):
    low_hours: int = Field(ge=1, le=240)
    medium_hours: int = Field(ge=1, le=240)
    high_hours: int = Field(ge=1, le=240)
    critical_hours: int = Field(ge=1, le=240)
    at_risk_ratio_percent: int = Field(ge=1, le=99)
    escalation_target_email: str | None = None
    notifications_enabled: bool = True


class SLAConfigResponse(BaseModel):
    low_hours: int
    medium_hours: int
    high_hours: int
    critical_hours: int
    at_risk_ratio_percent: int
    escalation_target_email: str | None = None
    notifications_enabled: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketNotificationResponse(BaseModel):
    id: int
    voucher_id: int
    category: str
    severity: str
    message: str
    target_email: str | None = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SLAEvaluationResponse(BaseModel):
    checked_tickets: int
    created_notifications: int
