"""
Milestone notification service.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.therapy import Therapy, TherapyMilestone
from app.models.user import Notification, User, UserWatchlist

logger = structlog.get_logger(__name__)

ALERT_WINDOWS_DAYS = [7, 30, 60]


async def check_and_create_milestone_notifications(db: AsyncSession) -> int:
    """
    Scan upcoming milestones and create notifications for users watching those therapies.
    Returns the number of notifications created.
    """
    today = date.today()
    max_horizon = today + timedelta(days=max(ALERT_WINDOWS_DAYS))
    created_count = 0

    # Find milestones in the alert window
    result = await db.execute(
        select(TherapyMilestone)
        .join(Therapy, TherapyMilestone.therapy_id == Therapy.id)
        .where(
            and_(
                Therapy.is_active.is_(True),
                TherapyMilestone.is_completed.is_(False),
                TherapyMilestone.milestone_date.isnot(None),
                TherapyMilestone.milestone_date >= today,
                TherapyMilestone.milestone_date <= max_horizon,
            )
        )
    )
    milestones = result.scalars().all()

    for milestone in milestones:
        days_until = (milestone.milestone_date - today).days if milestone.milestone_date else None
        if days_until is None:
            continue

        # Find which alert window this falls into
        window = None
        for w in sorted(ALERT_WINDOWS_DAYS):
            if days_until <= w:
                window = w
                break
        if window is None:
            continue

        # Find users watching this therapy
        watchers_result = await db.execute(
            select(UserWatchlist).where(UserWatchlist.therapy_id == milestone.therapy_id)
        )
        watchers = watchers_result.scalars().all()

        therapy_result = await db.execute(
            select(Therapy).where(Therapy.id == milestone.therapy_id)
        )
        therapy = therapy_result.scalar_one_or_none()
        if not therapy:
            continue

        for watcher in watchers:
            # Check if notification already sent recently for this milestone+window
            dedup_result = await db.execute(
                select(Notification).where(
                    and_(
                        Notification.user_id == watcher.user_id,
                        Notification.therapy_id == milestone.therapy_id,
                        Notification.notification_type == f"milestone_{window}d",
                        Notification.related_milestone_id == milestone.id,
                    )
                )
            )
            if dedup_result.scalar_one_or_none():
                continue  # Already notified

            notif = Notification(
                user_id=watcher.user_id,
                therapy_id=milestone.therapy_id,
                notification_type=f"milestone_{window}d",
                title=f"Upcoming milestone: {therapy.name}",
                message=(
                    f"{therapy.name} has a {milestone.milestone_type} milestone "
                    f"in {days_until} days ({milestone.milestone_date.isoformat()}): {milestone.title}"
                ),
                related_milestone_id=milestone.id,
            )
            db.add(notif)
            created_count += 1

    await db.commit()
    logger.info("Milestone notifications created", count=created_count)
    return created_count


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    therapy_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    related_milestone_id: Optional[uuid.UUID] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        therapy_id=therapy_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_milestone_id=related_milestone_id,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif
