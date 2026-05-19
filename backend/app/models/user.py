"""
SQLAlchemy ORM models for users, institutions, watchlists, and notifications.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INSTITUTION_ADMIN = "institution_admin"
    CLINICIAN = "clinician"
    RESEARCHER = "researcher"
    VIEWER = "viewer"


# ---------------------------------------------------------------------------
# Institution
# ---------------------------------------------------------------------------

class Institution(Base):
    """A healthcare institution using the platform."""

    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    short_name: Mapped[Optional[str]] = mapped_column(String(64))
    institution_type: Mapped[Optional[str]] = mapped_column(
        String(100)
    )  # "academic_medical_center" | "community_hospital" | "cancer_center" | ...
    address: Mapped[Optional[dict]] = mapped_column(JSON)  # {street, city, state, zip, country}
    website: Mapped[Optional[str]] = mapped_column(String(512))
    npi_number: Mapped[Optional[str]] = mapped_column(String(20))

    # Capabilities relevant to cell/gene therapy
    capabilities: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]
    accreditations: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]
    foundation_cell_lab: Mapped[bool] = mapped_column(Boolean, default=False)
    car_t_certified: Mapped[bool] = mapped_column(Boolean, default=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="institution")
    therapy_priorities: Mapped[list["InstitutionTherapyPriority"]] = relationship(
        "InstitutionTherapyPriority", back_populates="institution", cascade="all, delete-orphan"
    )
    operational_readiness: Mapped[list] = relationship(
        "OperationalReadiness", back_populates="institution"
    )

    def __repr__(self) -> str:
        return f"<Institution id={self.id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    """Platform user — authenticated via Firebase."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    firebase_uid: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(256))
    first_name: Mapped[Optional[str]] = mapped_column(String(128))
    last_name: Mapped[Optional[str]] = mapped_column(String(128))
    photo_url: Mapped[Optional[str]] = mapped_column(String(2048))

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole"), nullable=False, default=UserRole.VIEWER
    )

    institution_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="SET NULL")
    )
    job_title: Mapped[Optional[str]] = mapped_column(String(256))
    specialty: Mapped[Optional[str]] = mapped_column(String(256))

    # Notification preferences (JSON dict)
    notification_preferences: Mapped[Optional[dict]] = mapped_column(JSON)
    # e.g. {"milestone_30d": true, "milestone_60d": true, "status_change": true, "email": true}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    institution: Mapped[Optional["Institution"]] = relationship("Institution", back_populates="users")
    watchlists: Mapped[list["UserWatchlist"]] = relationship(
        "UserWatchlist", back_populates="user", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


# ---------------------------------------------------------------------------
# UserWatchlist
# ---------------------------------------------------------------------------

class UserWatchlist(Base):
    """A user's personal watchlist entry for a therapy."""

    __tablename__ = "user_watchlists"
    __table_args__ = (
        UniqueConstraint("user_id", "therapy_id", name="uq_user_therapy_watchlist"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    priority: Mapped[int] = mapped_column(Integer, default=3)  # 1=high, 2=medium, 3=low
    notes: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]
    notify_on_change: Mapped[bool] = mapped_column(Boolean, default=True)

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="watchlists")
    therapy: Mapped["Therapy"] = relationship(  # type: ignore[name-defined]
        "Therapy", back_populates="watchlist_entries"
    )

    def __repr__(self) -> str:
        return f"<UserWatchlist user_id={self.user_id} therapy_id={self.therapy_id}>"


# ---------------------------------------------------------------------------
# InstitutionTherapyPriority
# ---------------------------------------------------------------------------

class InstitutionTherapyPriority(Base):
    """Institution-level priority / tracking for a therapy (not user-specific)."""

    __tablename__ = "institution_therapy_priorities"
    __table_args__ = (
        UniqueConstraint("institution_id", "therapy_id", name="uq_institution_therapy_priority"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    priority_level: Mapped[str] = mapped_column(
        String(50), nullable=False, default="medium"
    )  # "high" | "medium" | "low" | "monitor"
    strategic_notes: Mapped[Optional[str]] = mapped_column(Text)
    assigned_lead: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))  # User.id
    target_go_live_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    institution: Mapped["Institution"] = relationship(
        "Institution", back_populates="therapy_priorities"
    )


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class Notification(Base):
    """In-app notification sent to a user."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    therapy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="SET NULL")
    )

    notification_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "milestone_30d" | "milestone_60d" | "status_change" | "new_data" | "system"
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[Optional[str]] = mapped_column(String(2048))
    metadata: Mapped[Optional[dict]] = mapped_column(JSON)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.notification_type}>"


# ---------------------------------------------------------------------------
# AuditLog
# ---------------------------------------------------------------------------

class AuditLog(Base):
    """Immutable log of user actions for compliance and debugging."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT"
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(256))
    changes: Mapped[Optional[dict]] = mapped_column(JSON)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    request_id: Mapped[Optional[str]] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} resource={self.resource_type}/{self.resource_id}>"
