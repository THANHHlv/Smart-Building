"""Schemas for Smart Building AI Assistant queries and contextual responses."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AiQueryRequest(BaseModel):
    """User query sent to the Smart Building AI Assistant."""

    message: str = Field(..., min_length=1, max_length=1000)


class AiSuggestedAction(BaseModel):
    """Quick actionable shortcut returned with AI recommendations."""

    label: str
    action_type: str
    target: str | None = None
    data: dict[str, Any] | None = None


class AiQueryResponse(BaseModel):
    """Smart response from the Building AI Assistant."""

    reply: str
    role_context: str
    confidence_score: float = 0.98
    suggested_actions: list[AiSuggestedAction] = []
    timestamp: datetime
