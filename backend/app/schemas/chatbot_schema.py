from pydantic import BaseModel, Field


class ChatbotAskRequest(BaseModel):
    message: str = Field(min_length=2, max_length=500)


class ChatbotAskResponse(BaseModel):
    reply: str
    intent: str
    context: dict | None = None
