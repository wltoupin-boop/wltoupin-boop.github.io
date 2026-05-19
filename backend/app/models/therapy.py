"""
SQLAlchemy ORM models for therapy-related entities.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, date
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
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

class TherapyType(str, enum.Enum):
    GENE_THERAPY = "gene_therapy"
    CELL_THERAPY = "cell_therapy"
    CAR_T = "car_t"
    GENE_EDITING = "gene_editing"
    ONCOLYTIC_VIRUS = "oncolytic_virus"
    RNA_THERAPY = "rna_therapy"
    OTHER = "other"


class DiseaseCategory(str, enum.Enum):
    ONCOLOGY = "oncology"
    HEMATOLOGY = "hematology"
    NEUROLOGY = "neurology"
    OPHTHALMOLOGY = "ophthalmology"
    MUSCULOSKELETAL = "musculoskeletal"
    CARDIOVASCULAR = "cardiovascular"
    IMMUNOLOGY = "immunology"
    METABOLIC = "metabolic"
    INFECTIOUS = "infectious"
    RARE_DISEASE = "rare_disease"
    OTHER = "other"


class ClinicalPhase(str, enum.Enum):
    PRECLINICAL = "preclinical"
    PHASE_1 = "phase_1"
    PHASE_1_2 = "phase_1_2"
    PHASE_2 = "phase_2"
    PHASE_2_3 = "phase_2_3"
    PHASE_3 = "phase_3"
    PHASE_4 = "phase_4"
    APPROVED = "approved"
    DISCONTINUED = "discontinued"


class FDAApprovalStatus(str, enum.Enum):
    NOT_SUBMITTED = "not_submitted"
    IND_FILED = "ind_filed"
    BLA_SUBMITTED = "bla_submitted"
    PDUFA_DATE_SET = "pdufa_date_set"
    APPROVED = "approved"
    APPROVED_ACCELERATED = "approved_accelerated"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    FAST_TRACK = "fast_track"
    BREAKTHROUGH_THERAPY = "breakthrough_therapy"
    PRIORITY_REVIEW = "priority_review"
    ACCELERATED_APPROVAL = "accelerated_approval"


class TrialStatus(str, enum.Enum):
    NOT_YET_RECRUITING = "not_yet_recruiting"
    RECRUITING = "recruiting"
    ENROLLING_BY_INVITATION = "enrolling_by_invitation"
    ACTIVE_NOT_RECRUITING = "active_not_recruiting"
    COMPLETED = "completed"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"
    WITHDRAWN = "withdrawn"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Therapy (core entity)
# ---------------------------------------------------------------------------

class Therapy(Base):
    """Core therapy record aggregating data from multiple public sources."""

    __tablename__ = "therapies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Identity
    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    brand_name: Mapped[Optional[str]] = mapped_column(String(256))
    generic_name: Mapped[Optional[str]] = mapped_column(String(256))
    aliases: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]

    # Classification
    therapy_type: Mapped[TherapyType] = mapped_column(
        SAEnum(TherapyType, name="therapytype"), nullable=False, index=True
    )
    disease_category: Mapped[DiseaseCategory] = mapped_column(
        SAEnum(DiseaseCategory, name="diseasecategory"), nullable=False, index=True
    )
    disease_indications: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]
    target_gene: Mapped[Optional[str]] = mapped_column(String(256))
    vector_type: Mapped[Optional[str]] = mapped_column(String(256))
    mechanism_of_action: Mapped[Optional[str]] = mapped_column(Text)

    # Developer / sponsor
    manufacturer: Mapped[Optional[str]] = mapped_column(String(512), index=True)
    developer: Mapped[Optional[str]] = mapped_column(String(512))
    collaborators: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]

    # Clinical status
    clinical_phase: Mapped[ClinicalPhase] = mapped_column(
        SAEnum(ClinicalPhase, name="clinicalphase"), nullable=False, index=True
    )
    trial_status: Mapped[Optional[TrialStatus]] = mapped_column(
        SAEnum(TrialStatus, name="trialstatus")
    )
    nct_ids: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]
    primary_nct_id: Mapped[Optional[str]] = mapped_column(String(20), index=True)

    # FDA regulatory
    fda_approval_status: Mapped[FDAApprovalStatus] = mapped_column(
        SAEnum(FDAApprovalStatus, name="fdaapprovalstatus"),
        nullable=False,
        default=FDAApprovalStatus.NOT_SUBMITTED,
        index=True,
    )
    bla_number: Mapped[Optional[str]] = mapped_column(String(50))
    ind_number: Mapped[Optional[str]] = mapped_column(String(50))
    pdufa_date: Mapped[Optional[date]] = mapped_column(Date)
    approval_date: Mapped[Optional[date]] = mapped_column(Date)
    fda_designations: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]

    # Special populations
    pediatric_indication: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    rare_disease: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    orphan_drug_designation: Mapped[bool] = mapped_column(Boolean, default=False)

    # Description
    description: Mapped[Optional[str]] = mapped_column(Text)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)

    # Data quality
    data_confidence_score: Mapped[Optional[int]] = mapped_column(Integer)  # 0-100
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ai_review_flags: Mapped[Optional[dict]] = mapped_column(JSON)  # field -> flag info
    source_urls: Mapped[Optional[dict]] = mapped_column(JSON)  # source -> url

    # Extra JSONB-style blobs
    clinical_sites: Mapped[Optional[list]] = mapped_column(JSON)
    publications: Mapped[Optional[list]] = mapped_column(JSON)
    pricing_info: Mapped[Optional[dict]] = mapped_column(JSON)
    reimbursement_status: Mapped[Optional[dict]] = mapped_column(JSON)

    # Soft delete
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    # Relationships
    milestones: Mapped[list["TherapyMilestone"]] = relationship(
        "TherapyMilestone", back_populates="therapy", cascade="all, delete-orphan"
    )
    version_history: Mapped[list["TherapyVersionHistory"]] = relationship(
        "TherapyVersionHistory", back_populates="therapy", cascade="all, delete-orphan"
    )
    data_sources: Mapped[list["DataSourceRecord"]] = relationship(
        "DataSourceRecord", back_populates="therapy", cascade="all, delete-orphan"
    )
    ai_review_flag_records: Mapped[list["AIReviewFlag"]] = relationship(
        "AIReviewFlag", back_populates="therapy", cascade="all, delete-orphan"
    )
    watchlist_entries: Mapped[list["UserWatchlist"]] = relationship(
        "UserWatchlist", back_populates="therapy"
    )

    def __repr__(self) -> str:
        return f"<Therapy id={self.id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# TherapyMilestone
# ---------------------------------------------------------------------------

class TherapyMilestone(Base):
    """Key dates and events in a therapy's development timeline."""

    __tablename__ = "therapy_milestones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    milestone_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    estimated_date: Mapped[Optional[date]] = mapped_column(Date)
    is_estimate: Mapped[bool] = mapped_column(Boolean, default=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    milestone_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "phase_start", "pdufa", "approval", "trial_completion"

    source: Mapped[Optional[str]] = mapped_column(String(256))
    source_url: Mapped[Optional[str]] = mapped_column(String(2048))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    therapy: Mapped["Therapy"] = relationship("Therapy", back_populates="milestones")

    def __repr__(self) -> str:
        return f"<TherapyMilestone therapy_id={self.therapy_id} title={self.title!r}>"


# ---------------------------------------------------------------------------
# TherapyVersionHistory
# ---------------------------------------------------------------------------

class TherapyVersionHistory(Base):
    """Immutable audit log of field-level changes to a therapy record."""

    __tablename__ = "therapy_version_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    version: Mapped[int] = mapped_column(Integer, nullable=False)
    changed_fields: Mapped[dict] = mapped_column(JSON, nullable=False)  # {field: {old, new}}
    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source: Mapped[Optional[str]] = mapped_column(String(256))  # "manual" | "clinicaltrials" | "fda" | "ai"

    therapy: Mapped["Therapy"] = relationship("Therapy", back_populates="version_history")

    __table_args__ = (
        UniqueConstraint("therapy_id", "version", name="uq_therapy_version"),
    )


# ---------------------------------------------------------------------------
# DataSourceRecord
# ---------------------------------------------------------------------------

class DataSourceRecord(Base):
    """Raw snapshot of external data ingested for a therapy."""

    __tablename__ = "data_source_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    source_name: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # "clinicaltrials" | "openfda" | "pubmed" | "manual"
    source_id: Mapped[Optional[str]] = mapped_column(String(256))  # NCT ID, application number, etc.
    source_url: Mapped[Optional[str]] = mapped_column(String(2048))
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSON)
    confidence_score: Mapped[Optional[int]] = mapped_column(Integer)  # 0-100
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ingestion_job_id: Mapped[Optional[str]] = mapped_column(String(256))

    therapy: Mapped["Therapy"] = relationship("Therapy", back_populates="data_sources")


# ---------------------------------------------------------------------------
# AIReviewFlag
# ---------------------------------------------------------------------------

class AIReviewFlag(Base):
    """
    Records when a human reviewer confirms or corrects an AI-extracted field.
    """

    __tablename__ = "ai_review_flags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    field_name: Mapped[str] = mapped_column(String(128), nullable=False)
    original_ai_value: Mapped[Optional[Any]] = mapped_column(JSON)
    corrected_value: Mapped[Optional[Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # "pending" | "confirmed" | "corrected" | "dismissed"
    reviewer_note: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    therapy: Mapped["Therapy"] = relationship("Therapy", back_populates="ai_review_flag_records")

    # Import here to avoid circular at module level
    from app.models.user import UserWatchlist  # noqa: F401
