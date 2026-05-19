"""
Pydantic v2 schemas for OperationalReadiness and related entities.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.operational import (
    CenterRole,
    OperationalStage,
    ReadinessLevel,
    TaskStatus,
)


class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# OperationalTask
# ---------------------------------------------------------------------------

class OperationalTaskCreate(BaseModel):
    stage: OperationalStage
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.NOT_STARTED
    priority: int = Field(3, ge=1, le=3)
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    blocker_reason: Optional[str] = None
    notes: Optional[str] = None
    external_link: Optional[str] = Field(None, max_length=2048)
    is_required: bool = True


class OperationalTaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = Field(None, ge=1, le=3)
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    blocker_reason: Optional[str] = None
    notes: Optional[str] = None
    external_link: Optional[str] = Field(None, max_length=2048)
    is_required: Optional[bool] = None


class OperationalTaskResponse(_OrmBase):
    id: uuid.UUID
    operational_readiness_id: uuid.UUID
    stage: OperationalStage
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: int
    assigned_to: Optional[uuid.UUID]
    due_date: Optional[date]
    completed_at: Optional[datetime]
    completed_by: Optional[uuid.UUID]
    blocker_reason: Optional[str]
    notes: Optional[str]
    external_link: Optional[str]
    is_required: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# OperationalReadiness
# ---------------------------------------------------------------------------

class OperationalReadinessCreate(BaseModel):
    institution_id: uuid.UUID
    therapy_id: uuid.UUID
    center_role: CenterRole = CenterRole.TREATING_CENTER
    overall_readiness: ReadinessLevel = ReadinessLevel.NOT_STARTED
    target_go_live_date: Optional[date] = None
    stage_readiness: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    responsible_lead_id: Optional[uuid.UUID] = None


class OperationalReadinessUpdate(BaseModel):
    center_role: Optional[CenterRole] = None
    overall_readiness: Optional[ReadinessLevel] = None
    readiness_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    target_go_live_date: Optional[date] = None
    actual_go_live_date: Optional[date] = None
    stage_readiness: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    responsible_lead_id: Optional[uuid.UUID] = None


class OperationalReadinessResponse(_OrmBase):
    id: uuid.UUID
    institution_id: uuid.UUID
    therapy_id: uuid.UUID
    center_role: CenterRole
    overall_readiness: ReadinessLevel
    readiness_score: Optional[float]
    target_go_live_date: Optional[date]
    actual_go_live_date: Optional[date]
    stage_readiness: Optional[Dict[str, Any]]
    ai_summary: Optional[str]
    ai_recommendations: Optional[List[str]]
    notes: Optional[str]
    responsible_lead_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    tasks: Optional[List[OperationalTaskResponse]] = None


class InstitutionOperationalSummary(BaseModel):
    """Aggregated readiness summary for an institution across all tracked therapies."""

    institution_id: uuid.UUID
    total_therapies: int
    by_readiness_level: Dict[str, int]
    average_readiness_score: Optional[float]
    therapies_ready: int
    therapies_in_progress: int
    tasks_overdue: int
    tasks_blocked: int
    upcoming_go_live_30d: int
