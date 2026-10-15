from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DocumentPriority = Literal["low", "medium", "high", "critical"]
DocumentApprovalStatus = Literal["pending", "approved", "rejected"]
DocumentType = Literal["receiving", "returning"]
DocumentAssetStatus = Literal["active", "re-assigned", "repaired", "disposed"]


class DocumentCreateRequest(BaseModel):
    date: str
    document_type: DocumentType = "returning"
    name_of_staff: str = Field(min_length=2)
    position: str = Field(min_length=2)
    division: str = Field(min_length=2)
    device_model: str = Field(min_length=2)
    device_serial_number: str = Field(min_length=2)
    rab_asset_code: str | None = None
    recipient_email: str | None = None
    source_of_computer: str | None = None
    acquisition_details: str | None = None
    receiving_comment: str | None = None
    nature_of_problem: str | None = None
    observation: str | None = None
    key_recommendation: str | None = None
    priority: DocumentPriority = "medium"
    asset_status: DocumentAssetStatus = "active"
    voucher_id: int | None = None
    disposal_id: int | None = None
    submitted_by_email: str | None = None


class DocumentResponse(BaseModel):
    id: int
    document_ref: str
    date: str
    document_type: str
    name_of_staff: str
    position: str
    division: str
    device_model: str
    device_serial_number: str
    rab_asset_code: str | None = None
    recipient_email: str | None = None
    source_of_computer: str | None = None
    acquisition_details: str | None = None
    receiving_comment: str | None = None
    user_signature: str | None = None
    user_signed_at: datetime | None = None
    signature_status: str
    nature_of_problem: str
    observation: str | None = None
    key_recommendation: str | None = None
    priority: str
    asset_status: str
    status: str
    approval_status: str
    approved_by_id: int | None = None
    approved_at: datetime | None = None
    approval_note: str | None = None
    submitted_by_id: int | None = None
    voucher_id: int | None = None
    disposal_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentLinkRequest(BaseModel):
    voucher_id: int | None = None


class DocumentApprovalRequest(BaseModel):
    decision: DocumentApprovalStatus
    approved_by_email: str | None = None
    approval_note: str | None = None


class DocumentSignRequest(BaseModel):
    signer_email: str
    signature_text: str = Field(min_length=2)
