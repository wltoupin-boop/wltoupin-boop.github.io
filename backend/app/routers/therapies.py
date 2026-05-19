"""
Therapy CRUD and search endpoints.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.therapy import (
    AIReviewFlag,
    ClinicalPhase,
    DataSourceRecord,
    DiseaseCategory,
    FDAApprovalStatus,
    Therapy,
    TherapyMilestone,
    TherapyType,
    TherapyVersionHistory,
    TrialStatus,
)
from app.models.user import User
from app.schemas.therapy import (
    AIReviewFlagUpdate,
    TherapyCreate,
    TherapyMilestoneCreate,
    TherapyMilestoneResponse,
    TherapyResponse,
    TherapyUpdate,
    UpcomingMilestoneResponse,
)

router = APIRouter(prefix="/therapies", tags=["therapies"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _apply_filters(stmt, params: dict):
    """Apply optional filter parameters to a select statement."""
    if params.get("therapy_type"):
        stmt = stmt.where(Therapy.therapy_type == params["therapy_type"])
    if params.get("disease_category"):
        stmt = stmt.where(Therapy.disease_category == params["disease_category"])
    if params.get("fda_status"):
        stmt = stmt.where(Therapy.fda_approval_status == params["fda_status"])
    if params.get("clinical_phase"):
        stmt = stmt.where(Therapy.clinical_phase == params["clinical_phase"])
    if params.get("pediatric_only"):
        stmt = stmt.where(Therapy.pediatric_indication.is_(True))
    if params.get("rare_disease_only"):
        stmt = stmt.where(Therapy.rare_disease.is_(True))
    if params.get("manufacturer"):
        stmt = stmt.where(
            Therapy.manufacturer.ilike(f"%{params['manufacturer']}%")
        )
    return stmt


async def _get_therapy_or_404(
    therapy_id: uuid.UUID, db: AsyncSession
) -> Therapy:
    result = await db.execute(
        select(Therapy).where(
            and_(Therapy.id == therapy_id, Therapy.is_active.is_(True))
        )
    )
    therapy = result.scalar_one_or_none()
    if not therapy:
        raise HTTPException(status_code=404, detail="Therapy not found")
    return therapy


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=dict)
async def list_therapies(
    q: Optional[str] = Query(None, description="Full-text search"),
    therapy_type: Optional[TherapyType] = None,
    disease_category: Optional[DiseaseCategory] = None,
    fda_status: Optional[FDAApprovalStatus] = None,
    clinical_phase: Optional[ClinicalPhase] = None,
    pediatric_only: bool = False,
    rare_disease_only: bool = False,
    manufacturer: Optional[str] = None,
    sort_by: str = Query("updated_at", pattern="^(name|updated_at|pdufa_date|approval_date|clinical_phase)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List therapies with filtering, sorting, and pagination."""
    params = {
        "therapy_type": therapy_type,
        "disease_category": disease_category,
        "fda_status": fda_status,
        "clinical_phase": clinical_phase,
        "pediatric_only": pediatric_only,
        "rare_disease_only": rare_disease_only,
        "manufacturer": manufacturer,
    }

    base_stmt = select(Therapy).where(Therapy.is_active.is_(True))

    if q:
        search_term = f"%{q}%"
        base_stmt = base_stmt.where(
            or_(
                Therapy.name.ilike(search_term),
                Therapy.brand_name.ilike(search_term),
                Therapy.generic_name.ilike(search_term),
                Therapy.manufacturer.ilike(search_term),
                Therapy.description.ilike(search_term),
            )
        )

    base_stmt = _apply_filters(base_stmt, params)

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(base_stmt.subquery())
    )
    total = count_result.scalar_one()

    # Sort
    sort_col = getattr(Therapy, sort_by, Therapy.updated_at)
    if sort_order == "desc":
        base_stmt = base_stmt.order_by(sort_col.desc().nullslast())
    else:
        base_stmt = base_stmt.order_by(sort_col.asc().nullsfirst())

    # Paginate
    offset = (page - 1) * page_size
    items_result = await db.execute(
        base_stmt.offset(offset).limit(page_size)
    )
    items = items_result.scalars().all()

    return {
        "items": [TherapyResponse.model_validate(t) for t in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": -(-total // page_size),
    }


@router.get("/upcoming-milestones", response_model=list)
async def get_upcoming_milestones(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Return therapy milestones occurring within the next N days."""
    cutoff = date.today() + timedelta(days=days)
    result = await db.execute(
        select(TherapyMilestone)
        .join(Therapy, TherapyMilestone.therapy_id == Therapy.id)
        .where(
            and_(
                Therapy.is_active.is_(True),
                TherapyMilestone.is_completed.is_(False),
                or_(
                    and_(
                        TherapyMilestone.milestone_date.isnot(None),
                        TherapyMilestone.milestone_date <= cutoff,
                        TherapyMilestone.milestone_date >= date.today(),
                    ),
                    and_(
                        TherapyMilestone.estimated_date.isnot(None),
                        TherapyMilestone.estimated_date <= cutoff,
                        TherapyMilestone.estimated_date >= date.today(),
                    ),
                ),
            )
        )
        .order_by(
            func.coalesce(TherapyMilestone.milestone_date, TherapyMilestone.estimated_date).asc()
        )
        .limit(100)
        .options(selectinload(TherapyMilestone.therapy))
    )
    milestones = result.scalars().all()

    return [
        {
            "milestone_id": str(m.id),
            "therapy_id": str(m.therapy_id),
            "therapy_name": m.therapy.name if m.therapy else None,
            "title": m.title,
            "milestone_type": m.milestone_type,
            "date": (m.milestone_date or m.estimated_date).isoformat() if (m.milestone_date or m.estimated_date) else None,
            "is_estimate": m.is_estimate,
            "days_until": (
                ((m.milestone_date or m.estimated_date) - date.today()).days
                if (m.milestone_date or m.estimated_date) else None
            ),
        }
        for m in milestones
    ]


@router.get("/{therapy_id}", response_model=TherapyResponse)
async def get_therapy(
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    therapy = await _get_therapy_or_404(therapy_id, db)
    return TherapyResponse.model_validate(therapy)


@router.post("", response_model=TherapyResponse, status_code=status.HTTP_201_CREATED)
async def create_therapy(
    payload: TherapyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    therapy = Therapy(**payload.model_dump(), created_by=current_user.id, updated_by=current_user.id)
    db.add(therapy)
    await db.commit()
    await db.refresh(therapy)
    return TherapyResponse.model_validate(therapy)


@router.put("/{therapy_id}", response_model=TherapyResponse)
async def update_therapy(
    therapy_id: uuid.UUID,
    payload: TherapyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    therapy = await _get_therapy_or_404(therapy_id, db)

    # Record changed fields for version history
    update_data = payload.model_dump(exclude_unset=True)
    changed_fields: dict[str, Any] = {}
    for field, new_val in update_data.items():
        old_val = getattr(therapy, field, None)
        if old_val != new_val:
            changed_fields[field] = {"old": old_val, "new": new_val}
            setattr(therapy, field, new_val)

    if changed_fields:
        # Determine next version number
        count_result = await db.execute(
            select(func.count()).where(TherapyVersionHistory.therapy_id == therapy_id)
        )
        next_version = (count_result.scalar_one() or 0) + 1
        history = TherapyVersionHistory(
            therapy_id=therapy_id,
            version=next_version,
            changed_fields=changed_fields,
            changed_by=current_user.id,
            source="manual",
        )
        db.add(history)
        therapy.updated_by = current_user.id

    await db.commit()
    await db.refresh(therapy)
    return TherapyResponse.model_validate(therapy)


@router.delete("/{therapy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_therapy(
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    therapy = await _get_therapy_or_404(therapy_id, db)
    from datetime import datetime, timezone
    therapy.is_active = False
    therapy.deleted_at = datetime.now(timezone.utc)
    therapy.deleted_by = current_user.id
    await db.commit()


@router.get("/{therapy_id}/milestones", response_model=list[TherapyMilestoneResponse])
async def get_therapy_milestones(
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    await _get_therapy_or_404(therapy_id, db)
    result = await db.execute(
        select(TherapyMilestone)
        .where(TherapyMilestone.therapy_id == therapy_id)
        .order_by(
            func.coalesce(TherapyMilestone.milestone_date, TherapyMilestone.estimated_date).asc()
        )
    )
    return [TherapyMilestoneResponse.model_validate(m) for m in result.scalars().all()]


@router.post("/{therapy_id}/milestones", response_model=TherapyMilestoneResponse, status_code=201)
async def add_milestone(
    therapy_id: uuid.UUID,
    payload: TherapyMilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    await _get_therapy_or_404(therapy_id, db)
    milestone = TherapyMilestone(
        therapy_id=therapy_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return TherapyMilestoneResponse.model_validate(milestone)


@router.get("/{therapy_id}/history", response_model=list)
async def get_therapy_history(
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    await _get_therapy_or_404(therapy_id, db)
    result = await db.execute(
        select(TherapyVersionHistory)
        .where(TherapyVersionHistory.therapy_id == therapy_id)
        .order_by(TherapyVersionHistory.version.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "version": r.version,
            "changed_fields": r.changed_fields,
            "change_summary": r.change_summary,
            "changed_by": str(r.changed_by) if r.changed_by else None,
            "changed_at": r.changed_at.isoformat(),
            "source": r.source,
        }
        for r in rows
    ]


@router.put("/{therapy_id}/ai-review/{field_name}", response_model=dict)
async def review_ai_field(
    therapy_id: uuid.UUID,
    field_name: str,
    payload: AIReviewFlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an AI-extracted field as reviewed, confirmed, or corrected."""
    await _get_therapy_or_404(therapy_id, db)
    from datetime import datetime, timezone

    result = await db.execute(
        select(AIReviewFlag).where(
            and_(
                AIReviewFlag.therapy_id == therapy_id,
                AIReviewFlag.field_name == field_name,
            )
        )
    )
    flag = result.scalar_one_or_none()
    if not flag:
        flag = AIReviewFlag(therapy_id=therapy_id, field_name=field_name)
        db.add(flag)

    flag.status = payload.status
    flag.corrected_value = payload.corrected_value
    flag.reviewer_note = payload.reviewer_note
    flag.reviewed_by = current_user.id
    flag.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"status": "ok", "field": field_name, "review_status": payload.status}
