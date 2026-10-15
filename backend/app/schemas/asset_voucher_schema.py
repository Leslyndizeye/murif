from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AssetVoucherStatus = Literal["Issued", "Returned"]


class AssetVoucherCreateRequest(BaseModel):
    asset_id: int
    issued_to: str = Field(min_length=1, max_length=200)
    issued_by: str = Field(min_length=1, max_length=200)


class AssetVoucherResponse(BaseModel):
    id: int
    voucher_number: str
    asset_id: int
    asset_name: str
    asset_category: str
    serial_number: str
    issued_to: str
    issued_by: str
    date_issued: datetime
    date_returned: datetime | None = None
    status: AssetVoucherStatus

    model_config = {"from_attributes": True}
