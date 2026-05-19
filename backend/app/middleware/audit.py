"""
Audit logging middleware and FastAPI dependency.

Any CREATE / UPDATE / DELETE operation should call log_audit_event() to
produce an immutable AuditLog row for compliance.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import AuditLog, User

logger = logging.getLogger(__name__)


async def log_audit_event(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    user: Optional[User] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Persist a single AuditLog row.

    Args:
        db:            Active async database session.
        action:        "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT"
        resource_type: Model/entity name, e.g. "Therapy"
        resource_id:   Primary key of the affected record.
        changes:       Dict of changed field names → {old, new} values.
        user:          The authenticated User performing the action.
        request:       The current HTTP request (for IP / user-agent / request_id).
    """
    try:
        entry = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id if user else None,
            action=action.upper(),
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            changes=changes,
            ip_address=_get_client_ip(request) if request else None,
            user_agent=request.headers.get("user-agent") if request else None,
            request_id=request.state.request_id if request and hasattr(request.state, "request_id") else None,
        )
        db.add(entry)
        # flush so the row gets the server default timestamp but don't commit yet
        # (the caller's session commit will finalise it together with the main change)
        await db.flush()
    except Exception as exc:
        # Audit logging must never break the main request flow
        logger.error("Failed to write audit log: %s", exc)


def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, honouring common proxy headers."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# Convenience FastAPI dependency that captures request context
# ---------------------------------------------------------------------------

class AuditLogger:
    """
    Thin wrapper injected as a FastAPI dependency.

    Usage in a router::

        async def my_endpoint(
            audit: AuditLogger = Depends(get_audit_logger),
        ):
            await audit.log("CREATE", "Therapy", resource_id=str(therapy.id))
    """

    def __init__(self, request: Request, db: AsyncSession):
        self._request = request
        self._db = db
        self._user: Optional[User] = None

    def set_user(self, user: User) -> None:
        self._user = user

    async def log(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
    ) -> None:
        await log_audit_event(
            db=self._db,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=changes,
            user=self._user,
            request=self._request,
        )


async def get_audit_logger(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuditLogger:
    """FastAPI dependency that provides an AuditLogger for the current request."""
    return AuditLogger(request=request, db=db)
