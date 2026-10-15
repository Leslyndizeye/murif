from pydantic import BaseModel, Field


class LookupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class LookupUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class LookupResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
