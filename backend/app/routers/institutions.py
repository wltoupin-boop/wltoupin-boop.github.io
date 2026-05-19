"""
Institution management endpoints.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.operational import OperationalReadiness, OperationalStage
from app.models.therapy import Therapy, FDAApprovalStatus
from app.models.user import Institution, InstitutionTherapyPriority, User, UserRole
from app.schemas.user import InstitutionCreate, InstitutionResponse, InstitutionUpdate

router = APIRouter(prefix="/institutions", tags=["institutions"])


async def _get_institution_or_404(institution_id: uuid.UUID, db: AsyncSession) -> Institution:
    result = await db.execute(
        select(Institution).where(Institution.id == institution_id)
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")
    return inst


def _can_access_institution(current_user: User, institution_id: uuid.UUID) -> bool:
    if current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        return True
    return current_user.institution_id == institution_id


@router.get("", response_model=list[InstitutionResponse])
async def list_institutions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(Institution)
        .order_by(Institution.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [InstitutionResponse.model_validate(i) for i in result.scalars().all()]


@router.post("", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    payload: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    institution = Institution(**payload.model_dump())
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return InstitutionResponse.model_validate(institution)


@router.get("/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access_institution(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")
    institution = await _get_institution_or_404(institution_id, db)
    return InstitutionResponse.model_validate(institution)


@router.put("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: uuid.UUID,
    payload: InstitutionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access_institution(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTITUTION_ADMIN):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    institution = await _get_institution_or_404(institution_id, db)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(institution, field, val)
    await db.commit()
    await db.refresh(institution)
    return InstitutionResponse.model_validate(institution)


@router.get("/{institution_id}/dashboard")
async def get_institution_dashboard(
    institution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """High-level summary statistics for an institution's therapy tracking."""
    if not _can_access_institution(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")
    await _get_institution_or_404(institution_id, db)

    # Total tracked
    total_tracked = (
        await db.execute(
            select(func.count()).where(
                InstitutionTherapyPriority.institution_id == institution_id
            )
        )
    ).scalar_one()

    # By operational stage
    stage_counts_result = await db.execute(
        select(OperationalReadiness.stage, func.count())
        .where(OperationalReadiness.institution_id == institution_id)
        .group_by(OperationalReadiness.stage)
    )
    stage_counts = {row[0]: row[1] for row in stage_counts_result}

    active = stage_counts.get(OperationalStage.ACTIVE_PROGRAM, 0)
    approved = stage_counts.get(OperationalStage.APPROVED_TREATMENT_CENTER, 0)
    in_prep = sum(
        v
        for k, v in stage_counts.items()
        if k
        not in (
            OperationalStage.NOT_YET_REVIEWED,
            OperationalStage.AWARENESS_MONITORING,
            OperationalStage.ACTIVE_PROGRAM,
            OperationalStage.APPROVED_TREATMENT_CENTER,
        )
    )
    monitoring = stage_counts.get(OperationalStage.AWARENESS_MONITORING, 0)

    # Priority therapies (priority 1-2)
    priority_result = await db.execute(
        select(InstitutionTherapyPriority)
        .where(
            and_(
                InstitutionTherapyPriority.institution_id == institution_id,
                InstitutionTherapyPriority.priority_level <= 2,
            )
        )
        .order_by(InstitutionTherapyPriority.priority_level.asc())
        .limit(10)
    )
    priority_items = priority_result.scalars().all()

    return {
        "institution_id": str(institution_id),
        "totals": {
            "tracked": total_tracked,
            "active_program": active,
            "approved_treatment_center": approved,
            "in_preparation": in_prep,
            "monitoring_only": monitoring,
        },
        "stage_breakdown": {k.value if hasattr(k, "value") else k: v for k, v in stage_counts.items()},
        "top_priorities": [
            {
                "therapy_id": str(p.therapy_id),
                "priority_level": p.priority_level,
                "local_patient_estimate": p.local_patient_estimate,
                "is_trial_site": p.is_trial_site,
                "is_treatment_site": p.is_treatment_site,
            }
            for p in priority_items
        ],
    }


@router.get("/{institution_id}/therapies")
async def get_institution_therapies(
    institution_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List therapies tracked by an institution with priority + operational data."""
    if not _can_access_institution(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(InstitutionTherapyPriority, Therapy)
        .join(Therapy, InstitutionTherapyPriority.therapy_id == Therapy.id)
        .where(
            and_(
                InstitutionTherapyPriority.institution_id == institution_id,
                Therapy.is_active.is_(True),
            )
        )
        .order_by(InstitutionTherapyPriority.priority_level.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = result.all()
    items = []
    for priority, therapy in rows:
        # Get operational readiness if it exists
        op_result = await db.execute(
            select(OperationalReadiness).where(
                and_(
                    OperationalReadiness.institution_id == institution_id,
                    OperationalReadiness.therapy_id == therapy.id,
                )
            )
        )
        op = op_result.scalar_one_or_none()
        items.append(
            {
                "therapy_id": str(therapy.id),
                "therapy_name": therapy.name,
                "therapy_type": therapy.therapy_type,
                "disease_category": therapy.disease_category,
                "clinical_phase": therapy.clinical_phase,
                "fda_approval_status": therapy.fda_approval_status,
                "pdufa_date": therapy.pdufa_date.isoformat() if therapy.pdufa_date else None,
                "priority_level": priority.priority_level,
                "local_patient_estimate": priority.local_patient_estimate,
                "is_trial_site": priority.is_trial_site,
                "is_treatment_site": priority.is_treatment_site,
                "operational_stage": op.stage if op else None,
                "next_action": op.next_action if op else None,
                "due_date": op.due_date.isoformat() if op and op.due_date else None,
            }
        )

    return {"items": items, "page": page, "page_size": page_size}
