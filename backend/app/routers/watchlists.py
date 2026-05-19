"""
User watchlist endpoints.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.therapy import Therapy
from app.models.user import User, UserWatchlist
from app.schemas.user import WatchlistCreate, WatchlistResponse, WatchlistUpdate

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


@router.get("/my", response_model=list[WatchlistResponse])
async def get_my_watchlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == current_user.id)
        .options(selectinload(UserWatchlist.therapy))
        .order_by(UserWatchlist.custom_priority.asc().nullslast(), UserWatchlist.created_at.desc())
    )
    return [WatchlistResponse.model_validate(w) for w in result.scalars().all()]


@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    payload: WatchlistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify therapy exists
    therapy_result = await db.execute(
        select(Therapy).where(and_(Therapy.id == payload.therapy_id, Therapy.is_active.is_(True)))
    )
    if not therapy_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Therapy not found")

    # Check for duplicate
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
        custom_priority=payload.custom_priority,
        notes=payload.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    await db.execute(select(UserWatchlist).where(UserWatchlist.id == entry.id).options(selectinload(UserWatchlist.therapy)))
    return WatchlistResponse.model_validate(entry)


@router.put("/{therapy_id}", response_model=WatchlistResponse)
async def update_watchlist_item(
    therapy_id: uuid.UUID,
    payload: WatchlistUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserWatchlist)
        .where(
            and_(
                UserWatchlist.user_id == current_user.id,
                UserWatchlist.therapy_id == therapy_id,
            )
        )
        .options(selectinload(UserWatchlist.therapy))
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, val)
    await db.commit()
    await db.refresh(entry)
    return WatchlistResponse.model_validate(entry)


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
