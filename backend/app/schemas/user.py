"""
Pydantic v2 schemas for User, Institution, Watchlist, and Notification.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Institution
# ---------------------------------------------------------------------------

class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=512)
    short_name: Optional[str] = Field(None, max_length=64)
    institution_type: Optional[str] = Field(None, max_length=100)
    address: Optional[Dict[str, str]] = None
    website: Optional[str] = Field(None, max_length=512)
    npi_number: Optional[str] = Field(None, max_length=20)
    capabilities: Optional[List[str]] = None
    accreditations: Optional[List[str]] = None
    foundation_cell_lab: bool = False
    car_t_certified: bool = False


class InstitutionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=512)
    short_name: Optional[str] = Field(None, max_length=64)
    institution_type: Optional[str] = Field(None, max_length=100)
    address: Optional[Dict[str, str]] = None
    website: Optional[str] = Field(None, max_length=512)
    npi_number: Optional[str] = Field(None, max_length=20)
    capabilities: Optional[List[str]] = None
    accreditations: Optional[List[str]] = None
    foundation_cell_lab: Optional[bool] = None
    car_t_certified: Optional[bool] = None
    is_active: Optional[bool] = None


class InstitutionResponse(_OrmBase):
    id: uuid.UUID
    name: str
    short_name: Optional[str]
    institution_type: Optional[str]
    address: Optional[Dict[str, str]]
    website: Optional[str]
    npi_number: Optional[str]
    capabilities: Optional[List[str]]
    accreditations: Optional[List[str]]
    foundation_cell_lab: bool
    car_t_certified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InstitutionDashboard(BaseModel):
    institution: InstitutionResponse
    total_therapies_tracked: int
    high_priority_count: int
    ready_for_launch_count: int
    upcoming_milestones_30d: int
    readiness_by_stage: Dict[str, Any]


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    """Fields a user can update on their own profile."""

    display_name: Optional[str] = Field(None, max_length=256)
    first_name: Optional[str] = Field(None, max_length=128)
    last_name: Optional[str] = Field(None, max_length=128)
    job_title: Optional[str] = Field(None, max_length=256)
    specialty: Optional[str] = Field(None, max_length=256)
    notification_preferences: Optional[Dict[str, Any]] = None


class AdminUserUpdate(UserUpdate):
    """Additional fields only admins can change."""

    role: Optional[UserRole] = None
    institution_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class UserResponse(_OrmBase):
    id: uuid.UUID
    firebase_uid: str
    email: str
    display_name: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    photo_url: Optional[str]
    role: UserRole
    institution_id: Optional[uuid.UUID]
    job_title: Optional[str]
    specialty: Optional[str]
    notification_preferences: Optional[Dict[str, Any]]
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------

class WatchlistCreate(BaseModel):
    therapy_id: uuid.UUID
    priority: int = Field(3, ge=1, le=3)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    notify_on_change: bool = True


class WatchlistUpdate(BaseModel):
    priority: Optional[int] = Field(None, ge=1, le=3)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    notify_on_change: Optional[bool] = None


class WatchlistResponse(_OrmBase):
    id: uuid.UUID
    user_id: uuid.UUID
    therapy_id: uuid.UUID
    priority: int
    notes: Optional[str]
    tags: Optional[List[str]]
    notify_on_change: bool
    added_at: datetime
    updated_at: datetime

    # Nested therapy summary
    therapy: Optional[Any] = None  # populated by join


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class NotificationResponse(_OrmBase):
    id: uuid.UUID
    user_id: uuid.UUID
    therapy_id: Optional[uuid.UUID]
    notification_type: str
    title: str
    message: str
    action_url: Optional[str]
    metadata: Optional[Dict[str, Any]]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
