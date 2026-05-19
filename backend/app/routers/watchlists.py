"""
User watchlist endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.therapy import Therapy
from app.models.user import User, UserWatchlist
from app.schemas.user import WatchlistCreate, WatchlistResponse, WatchlistUpdate

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


async def _enrich_watchlist_items(entries: list[UserWatchlist], db: AsyncSession) -> list[dict]:
    """Load therapy names for a list of watchlist entries."""
    therapy_ids = [e.therapy_id for e in entries]
    therapies: dict[uuid.UUID, Therapy] = {}
    if therapy_ids:
        result = await db.execute(
            select(Therapy.id, Therapy.name, Therapy.therapy_type, Therapy.disease_category)
            .where(Therapy.id.in_(therapy_ids))
        )
        for row in result:
            therapies[row.id] = row

    out = []
    for e in entries:
        data = WatchlistResponse.model_validate(e).model_dump()
        t = therapies.get(e.therapy_id)
        if t:
            data["therapy_name"] = t.name
            data["therapy_type"] = t.therapy_type.value if hasattr(t.therapy_type, "value") else t.therapy_type
            data["therapy_disease_category"] = t.disease_category.value if hasattr(t.disease_category, "value") else t.disease_category
        out.append(data)
    return out


@router.get("/my")
async def get_my_watchlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == current_user.id)
        .order_by(UserWatchlist.priority.asc().nullslast(), UserWatchlist.added_at.desc())
    )
    entries = result.scalars().all()
    return await _enrich_watchlist_items(entries, db)


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    payload: WatchlistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    therapy_result = await db.execute(
        select(Therapy).where(and_(Therapy.id == payload.therapy_id, Therapy.is_active.is_(True)))
    )
    if not therapy_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Therapy not found")

    existing = await db.execute(
        select(UserWatchlist).where(
            and_(
                UserWatchlist.user_id == current_user.id,
                UserWatchlist.therapy_id == payload.therapy_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Therapy already in watchlist")

    entry = UserWatchlist(
        user_id=current_user.id,
        therapy_id=payload.therapy_id,
        priority=payload.priority,
        notes=payload.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    enriched = await _enrich_watchlist_items([entry], db)
    return enriched[0]


@router.put("/{therapy_id}")
async def update_watchlist_item(
    therapy_id: uuid.UUID,
    payload: WatchlistUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserWatchlist).where(
            and_(
                UserWatchlist.user_id == current_user.id,
                UserWatchlist.therapy_id == therapy_id,
            )
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, val)
    await db.commit()
    await db.refresh(entry)
    enriched = await _enrich_watchlist_items([entry], db)
    return enriched[0]


@router.delete("/{therapy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    therapy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserWatchlist).where(
            and_(
                UserWatchlist.user_id == current_user.id,
                UserWatchlist.therapy_id == therapy_id,
            )
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
    await db.delete(entry)
    await db.commit()
