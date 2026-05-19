#!/usr/bin/env python3
"""
milestone_checker.py
====================
Standalone data pipeline script — Cell & Gene Therapy Tracking Platform

Checks all upcoming therapy milestones and:
  - Creates in-app notifications for users watching those therapies
  - Sends email notifications (via SendGrid) for time-sensitive milestones

Alert windows: 7, 30, and 60 days before a milestone date.

Usage:
    python milestone_checker.py [--dry-run] [--alert-windows 7,30,60]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
load_dotenv()

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer()
        if os.getenv("ENVIRONMENT") == "development"
        else structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_ALERT_WINDOWS = [7, 30, 60]  # days before milestone

# Milestone types and their human-readable labels
MILESTONE_LABELS = {
    "primary_completion_date": "Primary Completion Date",
    "completion_date": "Study Completion Date",
    "pdufa_date": "FDA PDUFA Target Action Date",
    "interim_analysis_date": "Interim Analysis Date",
    "enrollment_target_date": "Enrollment Target Date",
    "nda_bla_submission_date": "NDA/BLA Submission Date",
    "advisory_committee_date": "Advisory Committee Meeting",
    "custom": "Custom Milestone",
}

# Email configuration
EMAIL_FROM = os.getenv("NOTIFICATION_EMAIL_FROM", "notifications@therapytracker.example.com")
EMAIL_FROM_NAME = "Therapy Tracker Platform"

# Email template IDs (SendGrid Dynamic Templates)
SENDGRID_TEMPLATE_MILESTONE_ALERT = os.getenv(
    "SENDGRID_TEMPLATE_MILESTONE_ALERT", "d-placeholder-template-id"
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Milestone:
    """A single upcoming milestone for a therapy."""
    therapy_id: str
    therapy_nct_id: str
    therapy_title: str
    milestone_type: str
    milestone_date: date
    days_until: int


@dataclass
class UserWatch:
    """A user subscribed to milestone alerts for a therapy."""
    user_id: str
    user_email: str
    user_display_name: str
    therapy_id: str
    notification_preferences: dict[str, Any]


@dataclass
class NotificationResult:
    """Result of sending a single notification."""
    user_id: str
    therapy_id: str
    milestone_type: str
    channel: str  # "in_app" | "email"
    success: bool
    error: str = ""


@dataclass
class CheckStats:
    therapies_checked: int = 0
    milestones_found: int = 0
    notifications_created: int = 0
    emails_sent: int = 0
    errors: int = 0


# ---------------------------------------------------------------------------
# Database repository
# ---------------------------------------------------------------------------

class MilestoneRepository:
    """Read milestones and user watches from the database."""

    def __init__(self, engine):
        self.engine = engine

    def get_upcoming_milestones(self, alert_windows: list[int]) -> list[Milestone]:
        """
        Return all therapy milestones within any of the alert window days.
        Looks at both primary/completion dates from ClinicalTrials data
        and any custom milestones stored in the milestones table.
        """
        today = date.today()
        max_days = max(alert_windows)
        upper_bound = today + timedelta(days=max_days)

        milestones: list[Milestone] = []

        with Session(self.engine) as session:
            # --- Standard date fields on the therapies table ---
            date_fields = [
                ("primary_completion_date", "primary_completion_date"),
                ("completion_date", "completion_date"),
            ]

            for col, milestone_type in date_fields:
                rows = session.execute(
                    text(f"""
                        SELECT id, nct_id, title, {col}
                        FROM therapies
                        WHERE {col} IS NOT NULL
                          AND {col}::date BETWEEN :today AND :upper_bound
                          AND status NOT IN ('COMPLETED', 'TERMINATED', 'WITHDRAWN')
                        ORDER BY {col}
                    """),
                    {"today": today, "upper_bound": upper_bound},
                ).fetchall()

                for row in rows:
                    try:
                        milestone_date = (
                            row[3] if isinstance(row[3], date)
                            else datetime.strptime(str(row[3])[:10], "%Y-%m-%d").date()
                        )
                        days_until = (milestone_date - today).days
                        if days_until in alert_windows or any(
                            abs(days_until - w) <= 1 for w in alert_windows
                        ):
                            milestones.append(Milestone(
                                therapy_id=str(row[0]),
                                therapy_nct_id=str(row[1]),
                                therapy_title=str(row[2]),
                                milestone_type=milestone_type,
                                milestone_date=milestone_date,
                                days_until=days_until,
                            ))
                    except (ValueError, TypeError) as exc:
                        log.warning("milestone.date_parse_error", error=str(exc))

            # --- Custom milestones table ---
            custom_rows = session.execute(
                text("""
                    SELECT m.id, m.therapy_id, t.nct_id, t.title,
                           m.milestone_type, m.milestone_date
                    FROM milestones m
                    JOIN therapies t ON t.id = m.therapy_id
                    WHERE m.milestone_date::date BETWEEN :today AND :upper_bound
                      AND m.is_active = TRUE
                    ORDER BY m.milestone_date
                """),
                {"today": today, "upper_bound": upper_bound},
            ).fetchall()

            for row in custom_rows:
                try:
                    milestone_date = (
                        row[5] if isinstance(row[5], date)
                        else datetime.strptime(str(row[5])[:10], "%Y-%m-%d").date()
                    )
                    days_until = (milestone_date - today).days
                    milestones.append(Milestone(
                        therapy_id=str(row[1]),
                        therapy_nct_id=str(row[2]),
                        therapy_title=str(row[3]),
                        milestone_type=str(row[4]),
                        milestone_date=milestone_date,
                        days_until=days_until,
                    ))
                except (ValueError, TypeError) as exc:
                    log.warning("milestone.custom_date_error", error=str(exc))

        return milestones

    def get_watchers(self, therapy_id: str) -> list[UserWatch]:
        """Return all users watching a given therapy who want milestone alerts."""
        with Session(self.engine) as session:
            rows = session.execute(
                text("""
                    SELECT u.id, u.email, u.display_name,
                           uw.therapy_id, uw.notification_preferences
                    FROM user_watches uw
                    JOIN users u ON u.id = uw.user_id
                    WHERE uw.therapy_id = :therapy_id
                      AND uw.milestone_alerts = TRUE
                      AND u.is_active = TRUE
                    ORDER BY u.email
                """),
                {"therapy_id": therapy_id},
            ).fetchall()

            return [
                UserWatch(
                    user_id=str(row[0]),
                    user_email=str(row[1]),
                    user_display_name=str(row[2]),
                    therapy_id=str(row[3]),
                    notification_preferences=(
                        row[4] if isinstance(row[4], dict)
                        else json.loads(row[4] or "{}")
                    ),
                )
                for row in rows
            ]

    def notification_already_sent(
        self, user_id: str, therapy_id: str, milestone_type: str, window_days: int
    ) -> bool:
        """Check if we already sent this exact notification (idempotency check)."""
        with Session(self.engine) as session:
            result = session.execute(
                text("""
                    SELECT id FROM milestone_notifications
                    WHERE user_id = :user_id
                      AND therapy_id = :therapy_id
                      AND milestone_type = :milestone_type
                      AND alert_window_days = :window_days
                      AND sent_at > NOW() - INTERVAL '2 days'
                    LIMIT 1
                """),
                {
                    "user_id": user_id,
                    "therapy_id": therapy_id,
                    "milestone_type": milestone_type,
                    "window_days": window_days,
                },
            ).fetchone()
            return result is not None

    def create_in_app_notification(
        self,
        user_id: str,
        therapy_id: str,
        milestone: Milestone,
        window_days: int,
    ) -> str:
        """Insert an in-app notification and return its ID."""
        label = MILESTONE_LABELS.get(milestone.milestone_type, "Milestone")
        message = (
            f"{label} for {milestone.therapy_title} ({milestone.therapy_nct_id}) "
            f"is {milestone.days_until} day{'s' if milestone.days_until != 1 else ''} away "
            f"({milestone.milestone_date.isoformat()})."
        )

        with Session(self.engine) as session:
            result = session.execute(
                text("""
                    INSERT INTO notifications (
                        user_id, therapy_id, notification_type, title, message,
                        is_read, created_at
                    ) VALUES (
                        :user_id, :therapy_id, 'milestone_alert',
                        :title, :message, FALSE, NOW()
                    )
                    RETURNING id
                """),
                {
                    "user_id": user_id,
                    "therapy_id": therapy_id,
                    "title": f"Upcoming: {label}",
                    "message": message,
                },
            )
            notification_id = str(result.fetchone()[0])
            session.commit()
            return notification_id

    def record_notification_sent(
        self,
        user_id: str,
        therapy_id: str,
        milestone_type: str,
        window_days: int,
        channel: str,
        notification_id: str | None = None,
    ) -> None:
        with Session(self.engine) as session:
            session.execute(
                text("""
                    INSERT INTO milestone_notifications (
                        user_id, therapy_id, milestone_type,
                        alert_window_days, channel, notification_id, sent_at
                    ) VALUES (
                        :user_id, :therapy_id, :milestone_type,
                        :window_days, :channel, :notification_id, NOW()
                    )
                    ON CONFLICT (user_id, therapy_id, milestone_type, alert_window_days, channel)
                    DO UPDATE SET sent_at = NOW()
                """),
                {
                    "user_id": user_id,
                    "therapy_id": therapy_id,
                    "milestone_type": milestone_type,
                    "window_days": window_days,
                    "channel": channel,
                    "notification_id": notification_id,
                },
            )
            session.commit()


# ---------------------------------------------------------------------------
# Email notification
# ---------------------------------------------------------------------------

def find_closest_window(days_until: int, alert_windows: list[int]) -> int:
    """Find which alert window this milestone falls into."""
    return min(alert_windows, key=lambda w: abs(w - days_until))


def send_email_notification(
    watcher: UserWatch,
    milestone: Milestone,
    sendgrid_api_key: str,
    window_days: int,
) -> bool:
    """Send a milestone alert email via SendGrid."""
    label = MILESTONE_LABELS.get(milestone.milestone_type, "Milestone")

    template_data = {
        "user_name": watcher.user_display_name or watcher.user_email.split("@")[0],
        "therapy_title": milestone.therapy_title,
        "nct_id": milestone.therapy_nct_id,
        "milestone_label": label,
        "milestone_date": milestone.milestone_date.strftime("%B %-d, %Y"),
        "days_until": milestone.days_until,
        "therapy_url": f"https://therapytracker.example.com/therapies/{milestone.therapy_id}",
        "alert_window": window_days,
        "clinicaltrials_url": f"https://clinicaltrials.gov/study/{milestone.therapy_nct_id}",
    }

    message = Mail(
        from_email=(EMAIL_FROM, EMAIL_FROM_NAME),
        to_emails=watcher.user_email,
    )
    message.template_id = SENDGRID_TEMPLATE_MILESTONE_ALERT
    message.dynamic_template_data = template_data

    try:
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        if response.status_code in (200, 201, 202):
            log.info(
                "email.sent",
                to=watcher.user_email,
                therapy_nct_id=milestone.therapy_nct_id,
                milestone_type=milestone.milestone_type,
                days_until=milestone.days_until,
            )
            return True
        else:
            log.warning(
                "email.unexpected_status",
                status=response.status_code,
                to=watcher.user_email,
            )
            return False
    except Exception as exc:  # noqa: BLE001
        log.error("email.send_error", error=str(exc), to=watcher.user_email)
        return False


# ---------------------------------------------------------------------------
# Main checker logic
# ---------------------------------------------------------------------------

def run_check(
    db_url: str,
    sendgrid_api_key: str = "",
    alert_windows: list[int] | None = None,
    dry_run: bool = False,
) -> CheckStats:
    """Execute the milestone check and dispatch notifications."""

    if alert_windows is None:
        alert_windows = DEFAULT_ALERT_WINDOWS

    log.info(
        "milestone_checker.start",
        alert_windows=alert_windows,
        dry_run=dry_run,
        today=date.today().isoformat(),
    )

    stats = CheckStats()
    engine = create_engine(db_url, pool_pre_ping=True) if not dry_run else None
    repo = MilestoneRepository(engine) if engine else None

    if dry_run:
        log.info("milestone_checker.dry_run_mode")
        # In dry-run, just log what would happen
        log.info(
            "milestone_checker.dry_run_complete",
            note="Connect to real DB to see actual milestones",
        )
        return stats

    # Fetch all upcoming milestones
    milestones = repo.get_upcoming_milestones(alert_windows)
    stats.milestones_found = len(milestones)
    log.info("milestone_checker.milestones_found", count=len(milestones))

    # Process each milestone
    seen_therapies: set[str] = set()

    for milestone in milestones:
        stats.therapies_checked += 1 if milestone.therapy_id not in seen_therapies else 0
        seen_therapies.add(milestone.therapy_id)

        window = find_closest_window(milestone.days_until, alert_windows)
        label = MILESTONE_LABELS.get(milestone.milestone_type, "Milestone")

        log.info(
            "milestone_checker.processing",
            nct_id=milestone.therapy_nct_id,
            milestone_type=milestone.milestone_type,
            milestone_date=milestone.milestone_date.isoformat(),
            days_until=milestone.days_until,
            window=window,
        )

        # Get all watchers for this therapy
        watchers = repo.get_watchers(milestone.therapy_id)
        if not watchers:
            log.info(
                "milestone_checker.no_watchers",
                therapy_id=milestone.therapy_id,
            )
            continue

        for watcher in watchers:
            # Check user notification preferences
            prefs = watcher.notification_preferences
            wants_in_app = prefs.get("in_app_notifications", True)
            wants_email = prefs.get("email_notifications", True)
            min_alert_window = prefs.get("min_alert_window_days", 7)

            if milestone.days_until < min_alert_window:
                continue

            # --- In-app notification ---
            if wants_in_app:
                already_sent = repo.notification_already_sent(
                    watcher.user_id, milestone.therapy_id,
                    milestone.milestone_type, window,
                )
                if not already_sent:
                    try:
                        notif_id = repo.create_in_app_notification(
                            watcher.user_id, milestone.therapy_id, milestone, window
                        )
                        repo.record_notification_sent(
                            watcher.user_id, milestone.therapy_id,
                            milestone.milestone_type, window,
                            "in_app", notif_id,
                        )
                        stats.notifications_created += 1
                        log.info(
                            "notification.in_app.created",
                            user_id=watcher.user_id,
                            therapy_nct_id=milestone.therapy_nct_id,
                            days_until=milestone.days_until,
                        )
                    except Exception as exc:  # noqa: BLE001
                        log.error(
                            "notification.in_app.error",
                            error=str(exc),
                            user_id=watcher.user_id,
                        )
                        stats.errors += 1

            # --- Email notification (only for 7-day and 30-day windows) ---
            if wants_email and window in (7, 30) and sendgrid_api_key:
                already_sent = repo.notification_already_sent(
                    watcher.user_id, milestone.therapy_id,
                    milestone.milestone_type, window,
                )
                if not already_sent:
                    success = send_email_notification(
                        watcher, milestone, sendgrid_api_key, window
                    )
                    if success:
                        repo.record_notification_sent(
                            watcher.user_id, milestone.therapy_id,
                            milestone.milestone_type, window, "email",
                        )
                        stats.emails_sent += 1
                    else:
                        stats.errors += 1

    log.info(
        "milestone_checker.complete",
        **{
            "therapies_checked": stats.therapies_checked,
            "milestones_found": stats.milestones_found,
            "notifications_created": stats.notifications_created,
            "emails_sent": stats.emails_sent,
            "errors": stats.errors,
        },
    )
    return stats


# ---------------------------------------------------------------------------
# Secret fetching
# ---------------------------------------------------------------------------

def get_secret(secret_id: str, project_id: str) -> str:
    from google.cloud import secretmanager  # noqa: PLC0415
    sm_client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = sm_client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Check upcoming therapy milestones and send alerts")
    parser.add_argument(
        "--alert-windows",
        type=str,
        default="7,30,60",
        help="Comma-separated alert window days (default: 7,30,60)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Log without writing notifications")
    parser.add_argument(
        "--use-secret-manager",
        action="store_true",
        default=os.getenv("ENVIRONMENT") not in ("development", "test", None),
    )
    args = parser.parse_args()

    alert_windows = [int(w.strip()) for w in args.alert_windows.split(",")]

    environment = os.getenv("ENVIRONMENT", "development")
    project_id = os.getenv("GCP_PROJECT_ID", "")

    if args.use_secret_manager and project_id:
        db_password = get_secret(f"{environment}-db-password", project_id)
        db_user = os.getenv("DB_USER", "app")
        db_name = os.getenv("DB_NAME", "therapy_tracker")
        cloud_sql_conn = os.getenv("CLOUD_SQL_CONNECTION_NAME", "")
        if cloud_sql_conn:
            db_url = (
                f"postgresql+psycopg2://{db_user}:{db_password}@/"
                f"{db_name}?host=/cloudsql/{cloud_sql_conn}"
            )
        else:
            db_host = os.getenv("DB_HOST", "localhost")
            db_url = f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}/{db_name}"
    else:
        db_url = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://therapy_user:therapy_pass@localhost/therapy_tracker",
        )

    sendgrid_api_key = os.getenv("SENDGRID_API_KEY", "")
    if not sendgrid_api_key:
        log.warning("milestone_checker.no_sendgrid_key", msg="Email notifications will be skipped")

    stats = run_check(
        db_url=db_url,
        sendgrid_api_key=sendgrid_api_key,
        alert_windows=alert_windows,
        dry_run=args.dry_run,
    )

    sys.exit(1 if stats.errors > 0 else 0)


if __name__ == "__main__":
    main()
