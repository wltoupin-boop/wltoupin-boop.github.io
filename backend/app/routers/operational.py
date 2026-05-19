"""
Operational readiness tracking endpoints.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.operational import OperationalReadiness, OperationalTask, TaskStatus
from app.models.user import User, UserRole
from app.schemas.operational import (
    OperationalReadinessCreate as OperationalCreate,
    OperationalReadinessResponse as OperationalResponse,
    OperationalReadinessUpdate as OperationalUpdate,
    OperationalTaskCreate,
    OperationalTaskResponse,
)

router = APIRouter(prefix="/operational", tags=["operational"])


def _can_access(current_user: User, institution_id: uuid.UUID) -> bool:
    if current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
        return True
    return current_user.institution_id == institution_id


async def _get_or_404(record_id: uuid.UUID, db: AsyncSession) -> OperationalReadiness:
    result = await db.execute(
        select(OperationalReadiness)
        .where(OperationalReadiness.id == record_id)
        .options(selectinload(OperationalReadiness.tasks))
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Operational record not found")
    return rec


@router.get("/{institution_id}/{therapy_id}", response_model=OperationalResponse)
async def get_operational(
    institution_id: uuid.UUID,
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(
        select(OperationalReadiness)
        .where(
            and_(
                OperationalReadiness.institution_id == institution_id,
                OperationalReadiness.therapy_id == therapy_id,
            )
        )
        .options(selectinload(OperationalReadiness.tasks))
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="No operational record found")
    return OperationalResponse.model_validate(rec)


@router.post("", response_model=OperationalResponse, status_code=status.HTTP_201_CREATED)
async def create_operational(
    payload: OperationalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access(current_user, payload.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    existing = await db.execute(
        select(OperationalReadiness).where(
            and_(
                OperationalReadiness.institution_id == payload.institution_id,
                OperationalReadiness.therapy_id == payload.therapy_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Operational record already exists — use PUT to update",
        )

    rec = OperationalReadiness(**payload.model_dump(), created_by=current_user.id)
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return OperationalResponse.model_validate(rec)


@router.put("/{record_id}", response_model=OperationalResponse)
async def update_operational(
    record_id: uuid.UUID,
    payload: OperationalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await _get_or_404(record_id, db)
    if not _can_access(current_user, rec.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(rec, field, val)
    rec.updated_by = current_user.id
    await db.commit()
    await db.refresh(rec)
    return OperationalResponse.model_validate(rec)


@router.get("/{institution_id}/summary")
async def get_operational_summary(
    institution_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_access(current_user, institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(OperationalReadiness)
        .where(OperationalReadiness.institution_id == institution_id)
        .options(selectinload(OperationalReadiness.tasks))
    )
    records = result.scalars().all()

    # Readiness level counts
    level_counts: dict[str, int] = {}
    overdue = 0
    now = datetime.now(timezone.utc)

    for r in records:
        key = r.overall_readiness.value if r.overall_readiness else "unknown"
        level_counts[key] = level_counts.get(key, 0) + 1
        for task in r.tasks:
            if (
                task.due_date
                and task.due_date < now.date()
                and not task.completed_at
                and task.status != TaskStatus.COMPLETED
            ):
                overdue += 1

    return {
        "institution_id": str(institution_id),
        "total_records": len(records),
        "readiness_breakdown": level_counts,
        "overdue_tasks": overdue,
        "records": [
            {
                "id": str(r.id),
                "therapy_id": str(r.therapy_id),
                "overall_readiness": r.overall_readiness.value if r.overall_readiness else None,
                "readiness_score": r.readiness_score,
                "center_role": r.center_role.value if r.center_role else None,
                "target_go_live_date": r.target_go_live_date.isoformat() if r.target_go_live_date else None,
                "responsible_lead_id": str(r.responsible_lead_id) if r.responsible_lead_id else None,
                "open_tasks": sum(
                    1 for t in r.tasks if t.status not in (TaskStatus.COMPLETED,)
                ),
                "blocked_tasks": sum(
                    1 for t in r.tasks if t.status == TaskStatus.BLOCKED
                ),
            }
            for r in records
        ],
    }


# ---- Tasks -----------------------------------------------------------------

@router.post("/{record_id}/tasks", response_model=OperationalTaskResponse, status_code=201)
async def add_task(
    record_id: uuid.UUID,
    payload: OperationalTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await _get_or_404(record_id, db)
    if not _can_access(current_user, rec.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    task = OperationalTask(
        operational_readiness_id=record_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return OperationalTaskResponse.model_validate(task)


@router.put("/{record_id}/tasks/{task_id}", response_model=OperationalTaskResponse)
async def update_task(
    record_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: OperationalTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await _get_or_404(record_id, db)
    if not _can_access(current_user, rec.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(OperationalTask).where(
            and_(
                OperationalTask.id == task_id,
                OperationalTask.operational_readiness_id == record_id,
            )
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, val)
    await db.commit()
    await db.refresh(task)
    return OperationalTaskResponse.model_validate(task)


@router.put("/{record_id}/tasks/{task_id}/complete")
async def complete_task(
    record_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await _get_or_404(record_id, db)
    if not _can_access(current_user, rec.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(OperationalTask).where(
            and_(
                OperationalTask.id == task_id,
                OperationalTask.operational_readiness_id == record_id,
            )
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by = current_user.id
    await db.commit()
    return {"status": "ok", "completed_at": task.completed_at.isoformat()}


@router.delete("/{record_id}/tasks/{task_id}", status_code=204)
async def delete_task(
    record_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await _get_or_404(record_id, db)
    if not _can_access(current_user, rec.institution_id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(OperationalTask).where(
            and_(
                OperationalTask.id == task_id,
                OperationalTask.operational_readiness_id == record_id,
            )
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
