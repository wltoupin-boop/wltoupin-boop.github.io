"""
Firebase JWT verification and FastAPI auth dependencies.

Flow:
    1. Client sends  Authorization: Bearer <firebase_id_token>
    2. verify_firebase_token() decodes and verifies the JWT via Firebase Admin SDK.
    3. get_current_user() looks up (or creates) a User row in the database.
    4. Role-checking dependencies (require_admin, require_institution_admin) guard
       routes that need elevated privileges.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# HTTP Bearer scheme — extracts the raw token from the Authorization header
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Dev mode: bypass Firebase entirely
# ---------------------------------------------------------------------------

DEV_USER_CACHE: dict = {}

async def _get_or_create_dev_user(db: AsyncSession) -> User:
    """Return (or create) a dev admin user without Firebase verification."""
    result = await db.execute(select(User).where(User.firebase_uid == "dev-user"))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            firebase_uid="dev-user",
            email="dev@cellgenetracker.local",
            display_name="Dev Admin",
            role=UserRole.SUPER_ADMIN,
        )
        db.add(user)
        await db.flush()
    return user


async def verify_firebase_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """Verify a Firebase ID token. In dev mode (FIREBASE_DISABLED=true), skip verification."""
    if settings.firebase_disabled:
        return {"uid": "dev-user", "email": "dev@cellgenetracker.local"}

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        import firebase_admin
        from firebase_admin import auth as firebase_auth, credentials as fb_creds

        @lru_cache(maxsize=1)
        def _get_firebase_app():
            cred_dict = settings.get_firebase_credentials()
            if cred_dict:
                cred = fb_creds.Certificate(cred_dict)
            else:
                cred = fb_creds.ApplicationDefault()
            return firebase_admin.initialize_app(
                cred,
                {"projectId": settings.firebase_project_id},
                name="cgt_platform",
            )

        app = _get_firebase_app()
        decoded = firebase_auth.verify_id_token(
            credentials.credentials, app=app, check_revoked=True
        )
        return decoded
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="firebase-admin not installed",
        )
    except Exception as exc:
        logger.warning("Firebase token error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# get_current_user — fetches or lazily creates the User row
# ---------------------------------------------------------------------------

async def get_current_user(
    token_data: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve a verified Firebase token to a database User.

    If the user has authenticated for the first time, a VIEWER-role record is
    created automatically.
    """
    if settings.firebase_disabled:
        return await _get_or_create_dev_user(db)

    firebase_uid: str = token_data["uid"]
    email: str = token_data.get("email", "")

    stmt = select(User).where(User.firebase_uid == firebase_uid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        # First-time login — provision a new user row
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            display_name=token_data.get("name"),
            photo_url=token_data.get("picture"),
            role=UserRole.VIEWER,
        )
        db.add(user)
        await db.flush()
        logger.info("Created new user %s (%s)", user.id, email)

    else:
        # Update last-login timestamp
        from datetime import datetime, timezone
        user.last_login_at = datetime.now(timezone.utc)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return user


# ---------------------------------------------------------------------------
# Optional auth — returns None if no token is provided
# ---------------------------------------------------------------------------

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None for unauthenticated requests."""
    if not credentials or not credentials.credentials:
        return None
    try:
        token_data = await verify_firebase_token(credentials)
        return await get_current_user(token_data, db)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Role-checking dependencies
# ---------------------------------------------------------------------------

def _require_roles(*roles: UserRole):
    """Factory that returns a dependency asserting the user has one of *roles*."""

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role(s): {[r.value for r in roles]}",
            )
        return current_user

    return _check


require_admin = _require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
require_super_admin = _require_roles(UserRole.SUPER_ADMIN)
require_institution_admin = _require_roles(
    UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTITUTION_ADMIN
)


async def require_institution_membership(
    institution_id: str,
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Ensure the current user belongs to the given institution, or is an admin.
    """
    is_admin = current_user.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN)
    belongs = str(current_user.institution_id) == institution_id
    if not is_admin and not belongs:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this institution is not allowed",
        )
    return current_user
