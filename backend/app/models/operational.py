"""
SQLAlchemy ORM models for operational readiness tracking at institution level.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, date
from typing import Optional

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

class OperationalStage(str, enum.Enum):
    """All 23 operational readiness stages for cell and gene therapy programs."""
    # 1  Program Strategy
    PROGRAM_STRATEGY = "program_strategy"
    # 2  Leadership & Governance
    LEADERSHIP_GOVERNANCE = "leadership_governance"
    # 3  Clinical Team Assembly
    CLINICAL_TEAM_ASSEMBLY = "clinical_team_assembly"
    # 4  Regulatory Strategy
    REGULATORY_STRATEGY = "regulatory_strategy"
    # 5  IRB & Ethics Approval
    IRB_ETHICS_APPROVAL = "irb_ethics_approval"
    # 6  Payer & Reimbursement Strategy
    PAYER_REIMBURSEMENT_STRATEGY = "payer_reimbursement_strategy"
    # 7  Financial Modeling & Budgeting
    FINANCIAL_MODELING = "financial_modeling"
    # 8  Cell Processing Facility
    CELL_PROCESSING_FACILITY = "cell_processing_facility"
    # 9  Pharmacy & Drug Management
    PHARMACY_DRUG_MANAGEMENT = "pharmacy_drug_management"
    # 10 Apheresis Capability
    APHERESIS_CAPABILITY = "apheresis_capability"
    # 11 Infusion Center Readiness
    INFUSION_CENTER_READINESS = "infusion_center_readiness"
    # 12 Inpatient Bed Capacity
    INPATIENT_BED_CAPACITY = "inpatient_bed_capacity"
    # 13 ICU Backup Protocol
    ICU_BACKUP_PROTOCOL = "icu_backup_protocol"
    # 14 Chain of Identity & Custody
    CHAIN_OF_IDENTITY_CUSTODY = "chain_of_identity_custody"
    # 15 Data Systems & EHR Integration
    DATA_SYSTEMS_EHR = "data_systems_ehr"
    # 16 Patient Identification & Referral
    PATIENT_IDENTIFICATION_REFERRAL = "patient_identification_referral"
    # 17 Patient Education & Consent
    PATIENT_EDUCATION_CONSENT = "patient_education_consent"
    # 18 Toxicity Management Protocol
    TOXICITY_MANAGEMENT = "toxicity_management"
    # 19 Long-Term Follow-Up Program
    LONG_TERM_FOLLOWUP = "long_term_followup"
    # 20 Quality & Compliance Systems
    QUALITY_COMPLIANCE = "quality_compliance"
    # 21 Staff Training & Competency
    STAFF_TRAINING_COMPETENCY = "staff_training_competency"
    # 22 Vendor & Supplier Contracts
    VENDOR_SUPPLIER_CONTRACTS = "vendor_supplier_contracts"
    # 23 Go-Live Readiness Review
    GO_LIVE_READINESS_REVIEW = "go_live_readiness_review"


class CenterRole(str, enum.Enum):
    TREATING_CENTER = "treating_center"
    COLLECTION_CENTER = "collection_center"
    BOTH = "both"
    REFERRING_PARTNER = "referring_partner"


class TaskStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    WAIVED = "waived"


class ReadinessLevel(str, enum.Enum):
    NOT_STARTED = "not_started"
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    NEARLY_READY = "nearly_ready"
    READY = "ready"
    CERTIFIED = "certified"


# ---------------------------------------------------------------------------
# OperationalReadiness
# ---------------------------------------------------------------------------

class OperationalReadiness(Base):
    """
    Tracks an institution's readiness to offer a specific therapy.
    One record per (institution, therapy) pair.
    """

    __tablename__ = "operational_readiness"
    __table_args__ = (
        UniqueConstraint(
            "institution_id", "therapy_id", name="uq_institution_therapy_readiness"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    therapy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("therapies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    center_role: Mapped[CenterRole] = mapped_column(
        SAEnum(CenterRole, name="centerrole"),
        nullable=False,
        default=CenterRole.TREATING_CENTER,
    )

    # Overall readiness
    overall_readiness: Mapped[ReadinessLevel] = mapped_column(
        SAEnum(ReadinessLevel, name="readinesslevel"),
        nullable=False,
        default=ReadinessLevel.NOT_STARTED,
    )
    readiness_score: Mapped[Optional[float]] = mapped_column(Float)  # 0.0 – 100.0
    target_go_live_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_go_live_date: Mapped[Optional[date]] = mapped_column(Date)

    # Stage-level readiness stored as JSON for flexibility
    # { stage_name: { readiness_level, score, notes, last_updated } }
    stage_readiness: Mapped[Optional[dict]] = mapped_column(JSON)

    # AI-generated summary
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendations: Mapped[Optional[list]] = mapped_column(JSON)  # list[str]

    # Internal notes
    notes: Mapped[Optional[str]] = mapped_column(Text)
    responsible_lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

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
    institution: Mapped["Institution"] = relationship(  # type: ignore[name-defined]
        "Institution", back_populates="operational_readiness"
    )
    tasks: Mapped[list["OperationalTask"]] = relationship(
        "OperationalTask",
        back_populates="operational_readiness",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["OperationalDocument"]] = relationship(
        "OperationalDocument",
        back_populates="operational_readiness",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<OperationalReadiness institution={self.institution_id} "
            f"therapy={self.therapy_id} level={self.overall_readiness}>"
        )


# ---------------------------------------------------------------------------
# OperationalTask
# ---------------------------------------------------------------------------

class OperationalTask(Base):
    """A granular action item within an operational readiness record."""

    __tablename__ = "operational_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    operational_readiness_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("operational_readiness.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    stage: Mapped[OperationalStage] = mapped_column(
        SAEnum(OperationalStage, name="operationalstage"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="taskstatus"),
        nullable=False,
        default=TaskStatus.NOT_STARTED,
    )
    priority: Mapped[int] = mapped_column(Integer, default=3)  # 1=critical, 2=high, 3=normal

    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    blocker_reason: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    external_link: Mapped[Optional[str]] = mapped_column(String(2048))

    is_required: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    operational_readiness: Mapped["OperationalReadiness"] = relationship(
        "OperationalReadiness", back_populates="tasks"
    )

    def __repr__(self) -> str:
        return f"<OperationalTask id={self.id} stage={self.stage} status={self.status}>"


# ---------------------------------------------------------------------------
# OperationalDocument
# ---------------------------------------------------------------------------

class OperationalDocument(Base):
    """A document (policy, SOP, contract, etc.) attached to an operational readiness record."""

    __tablename__ = "operational_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    operational_readiness_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("operational_readiness.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    stage: Mapped[Optional[OperationalStage]] = mapped_column(
        SAEnum(OperationalStage, name="operationalstage_doc", create_constraint=False)
    )
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # GCS object path
    gcs_path: Mapped[Optional[str]] = mapped_column(String(2048))
    file_name: Mapped[Optional[str]] = mapped_column(String(512))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128))

    version: Mapped[Optional[str]] = mapped_column(String(50))
    effective_date: Mapped[Optional[date]] = mapped_column(Date)
    expiration_date: Mapped[Optional[date]] = mapped_column(Date)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    operational_readiness: Mapped["OperationalReadiness"] = relationship(
        "OperationalReadiness", back_populates="documents"
    )

    def __repr__(self) -> str:
        return f"<OperationalDocument id={self.id} title={self.title!r}>"
