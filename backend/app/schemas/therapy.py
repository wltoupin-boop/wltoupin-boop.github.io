"""
Pydantic v2 schemas for Therapy-related API request/response models.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.therapy import (
    ClinicalPhase,
    DiseaseCategory,
    FDAApprovalStatus,
    TherapyType,
    TrialStatus,
)


# ---------------------------------------------------------------------------
# Shared base config
# ---------------------------------------------------------------------------

class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Therapy Create / Update
# ---------------------------------------------------------------------------

class TherapyCreate(BaseModel):
    """Fields accepted when creating a new therapy record (admin only)."""

    name: str = Field(..., min_length=1, max_length=512)
    brand_name: Optional[str] = Field(None, max_length=256)
    generic_name: Optional[str] = Field(None, max_length=256)
    aliases: Optional[List[str]] = None

    therapy_type: TherapyType
    disease_category: DiseaseCategory
    disease_indications: Optional[List[str]] = None
    target_gene: Optional[str] = Field(None, max_length=256)
    vector_type: Optional[str] = Field(None, max_length=256)
    mechanism_of_action: Optional[str] = None

    manufacturer: Optional[str] = Field(None, max_length=512)
    developer: Optional[str] = Field(None, max_length=512)
    collaborators: Optional[List[str]] = None

    clinical_phase: ClinicalPhase
    trial_status: Optional[TrialStatus] = None
    nct_ids: Optional[List[str]] = None
    primary_nct_id: Optional[str] = Field(None, max_length=20)

    fda_approval_status: FDAApprovalStatus = FDAApprovalStatus.NOT_SUBMITTED
    bla_number: Optional[str] = Field(None, max_length=50)
    ind_number: Optional[str] = Field(None, max_length=50)
    pdufa_date: Optional[date] = None
    approval_date: Optional[date] = None
    fda_designations: Optional[List[str]] = None

    pediatric_indication: bool = False
    rare_disease: bool = False
    orphan_drug_designation: bool = False

    description: Optional[str] = None
    source_urls: Optional[Dict[str, str]] = None
    clinical_sites: Optional[List[Any]] = None
    publications: Optional[List[Any]] = None
    pricing_info: Optional[Dict[str, Any]] = None
    reimbursement_status: Optional[Dict[str, Any]] = None


class TherapyUpdate(BaseModel):
    """All fields optional for PATCH-style updates (admin only)."""

    name: Optional[str] = Field(None, min_length=1, max_length=512)
    brand_name: Optional[str] = Field(None, max_length=256)
    generic_name: Optional[str] = Field(None, max_length=256)
    aliases: Optional[List[str]] = None

    therapy_type: Optional[TherapyType] = None
    disease_category: Optional[DiseaseCategory] = None
    disease_indications: Optional[List[str]] = None
    target_gene: Optional[str] = Field(None, max_length=256)
    vector_type: Optional[str] = Field(None, max_length=256)
    mechanism_of_action: Optional[str] = None

    manufacturer: Optional[str] = Field(None, max_length=512)
    developer: Optional[str] = Field(None, max_length=512)
    collaborators: Optional[List[str]] = None

    clinical_phase: Optional[ClinicalPhase] = None
    trial_status: Optional[TrialStatus] = None
    nct_ids: Optional[List[str]] = None
    primary_nct_id: Optional[str] = Field(None, max_length=20)

    fda_approval_status: Optional[FDAApprovalStatus] = None
    bla_number: Optional[str] = Field(None, max_length=50)
    ind_number: Optional[str] = Field(None, max_length=50)
    pdufa_date: Optional[date] = None
    approval_date: Optional[date] = None
    fda_designations: Optional[List[str]] = None

    pediatric_indication: Optional[bool] = None
    rare_disease: Optional[bool] = None
    orphan_drug_designation: Optional[bool] = None

    description: Optional[str] = None
    source_urls: Optional[Dict[str, str]] = None
    clinical_sites: Optional[List[Any]] = None
    publications: Optional[List[Any]] = None
    pricing_info: Optional[Dict[str, Any]] = None
    reimbursement_status: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Therapy Response
# ---------------------------------------------------------------------------

class TherapyMilestoneResponse(_OrmBase):
    id: uuid.UUID
    therapy_id: uuid.UUID
    title: str
    description: Optional[str]
    milestone_date: Optional[date]
    estimated_date: Optional[date]
    is_estimate: bool
    is_completed: bool
    completed_at: Optional[datetime]
    milestone_type: str
    source: Optional[str]
    source_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class TherapyResponse(_OrmBase):
    id: uuid.UUID
    name: str
    brand_name: Optional[str]
    generic_name: Optional[str]
    aliases: Optional[List[str]]

    therapy_type: TherapyType
    disease_category: DiseaseCategory
    disease_indications: Optional[List[str]]
    target_gene: Optional[str]
    vector_type: Optional[str]
    mechanism_of_action: Optional[str]

    manufacturer: Optional[str]
    developer: Optional[str]
    collaborators: Optional[List[str]]

    clinical_phase: ClinicalPhase
    trial_status: Optional[TrialStatus]
    nct_ids: Optional[List[str]]
    primary_nct_id: Optional[str]

    fda_approval_status: FDAApprovalStatus
    bla_number: Optional[str]
    ind_number: Optional[str]
    pdufa_date: Optional[date]
    approval_date: Optional[date]
    fda_designations: Optional[List[str]]

    pediatric_indication: bool
    rare_disease: bool
    orphan_drug_designation: bool

    description: Optional[str]
    ai_summary: Optional[str]
    data_confidence_score: Optional[int]
    last_verified_at: Optional[datetime]
    ai_review_flags: Optional[Dict[str, Any]]
    source_urls: Optional[Dict[str, str]]

    clinical_sites: Optional[List[Any]]
    publications: Optional[List[Any]]
    pricing_info: Optional[Dict[str, Any]]
    reimbursement_status: Optional[Dict[str, Any]]

    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[uuid.UUID]
    updated_by: Optional[uuid.UUID]

    # Nested milestones only included in detail view
    milestones: Optional[List[TherapyMilestoneResponse]] = None


class TherapyListItem(_OrmBase):
    """Lightweight projection for list endpoints."""

    id: uuid.UUID
    name: str
    brand_name: Optional[str]
    therapy_type: TherapyType
    disease_category: DiseaseCategory
    clinical_phase: ClinicalPhase
    fda_approval_status: FDAApprovalStatus
    manufacturer: Optional[str]
    pediatric_indication: bool
    rare_disease: bool
    pdufa_date: Optional[date]
    data_confidence_score: Optional[int]
    updated_at: datetime


class TherapyListResponse(BaseModel):
    """Paginated list response."""

    items: List[TherapyListItem]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------------------
# Milestone Create
# ---------------------------------------------------------------------------

class TherapyMilestoneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    milestone_date: Optional[date] = None
    estimated_date: Optional[date] = None
    is_estimate: bool = False
    milestone_type: str = Field(..., max_length=100)
    source: Optional[str] = Field(None, max_length=256)
    source_url: Optional[str] = Field(None, max_length=2048)


# ---------------------------------------------------------------------------
# AI Review Flag Update
# ---------------------------------------------------------------------------

class AIReviewFlagUpdate(BaseModel):
    status: str = Field(
        ..., pattern="^(confirmed|corrected|dismissed)$"
    )
    corrected_value: Optional[Any] = None
    reviewer_note: Optional[str] = None


# ---------------------------------------------------------------------------
# Search Params
# ---------------------------------------------------------------------------

class TherapySearchParams(BaseModel):
    """Query parameters for GET /therapies list endpoint."""

    query: Optional[str] = Field(None, max_length=512, description="Full-text search query")
    therapy_type: Optional[TherapyType] = None
    disease_category: Optional[DiseaseCategory] = None
    fda_status: Optional[FDAApprovalStatus] = None
    clinical_phase: Optional[ClinicalPhase] = None
    pediatric_only: bool = False
    rare_disease_only: bool = False
    manufacturer: Optional[str] = Field(None, max_length=512)
    sort_by: str = Field("updated_at", pattern="^(name|updated_at|pdufa_date|clinical_phase|created_at)$")
    sort_order: str = Field("desc", pattern="^(asc|desc)$")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


# ---------------------------------------------------------------------------
# Version History
# ---------------------------------------------------------------------------

class TherapyVersionHistoryResponse(_OrmBase):
    id: uuid.UUID
    therapy_id: uuid.UUID
    version: int
    changed_fields: Dict[str, Any]
    change_summary: Optional[str]
    changed_by: Optional[uuid.UUID]
    changed_at: datetime
    source: Optional[str]
