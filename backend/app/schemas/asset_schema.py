from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AssetStatus = Literal["Available", "Assigned", "Disposed"]


class AssetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    serial_number: str = Field(min_length=1, max_length=100)


class AssetUpdateRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    serial_number: str | None = None
    status: AssetStatus | None = None


class AssetResponse(BaseModel):
    id: int
    name: str
    category: str
    serial_number: str
    status: AssetStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
