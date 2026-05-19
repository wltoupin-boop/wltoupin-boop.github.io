"""
Package init: export all ORM models and the shared Base.

Importing this module ensures all models are registered with SQLAlchemy's
metadata before Alembic or create_all() is called.
"""

from app.database import Base  # noqa: F401

# Therapy models
from app.models.therapy import (  # noqa: F401
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

# User / institution models
from app.models.user import (  # noqa: F401
    AuditLog,
    Institution,
    InstitutionTherapyPriority,
    Notification,
    User,
    UserRole,
    UserWatchlist,
)

# Operational models
from app.models.operational import (  # noqa: F401
    CenterRole,
    OperationalDocument,
    OperationalReadiness,
    OperationalStage,
    OperationalTask,
    ReadinessLevel,
    TaskStatus,
)

__all__ = [
    "Base",
    # therapy
    "AIReviewFlag",
    "ClinicalPhase",
    "DataSourceRecord",
    "DiseaseCategory",
    "FDAApprovalStatus",
    "Therapy",
    "TherapyMilestone",
    "TherapyType",
    "TherapyVersionHistory",
    "TrialStatus",
    # user / institution
    "AuditLog",
    "Institution",
    "InstitutionTherapyPriority",
    "Notification",
    "User",
    "UserRole",
    "UserWatchlist",
    # operational
    "CenterRole",
    "OperationalDocument",
    "OperationalReadiness",
    "OperationalStage",
    "OperationalTask",
    "ReadinessLevel",
    "TaskStatus",
]
