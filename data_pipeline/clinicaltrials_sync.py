#!/usr/bin/env python3
"""
clinicaltrials_sync.py
======================
Standalone data pipeline script — Cell & Gene Therapy Tracking Platform

Queries the ClinicalTrials.gov API v2 for gene therapy, cell therapy,
CAR-T, and related study records, then upserts them into the platform
database.

Can be run:
  - Locally:           python clinicaltrials_sync.py
  - As a Cloud Run Job: configured as the container command
  - Via Cloud Scheduler -> Backend trigger endpoint

Usage:
    python clinicaltrials_sync.py [--max-results 1000] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generator

import requests
import structlog
from dotenv import load_dotenv
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# ---------------------------------------------------------------------------
# Optional: SQLAlchemy for direct DB writes
# Comment out / replace with REST API calls if running against the backend API
# ---------------------------------------------------------------------------
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Optional: Anthropic for AI summaries on new records
# ---------------------------------------------------------------------------
import anthropic

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

CLINICALTRIALS_API_BASE = "https://clinicaltrials.gov/api/v2"
PAGE_SIZE = 100          # Max page size allowed by ClinicalTrials.gov API v2
REQUEST_DELAY_SECONDS = 1.0  # Respectful rate limiting
MAX_RESULTS_DEFAULT = 1000

# Search terms covering the full cell & gene therapy landscape
SEARCH_TERMS = [
    "gene therapy",
    "cell therapy",
    "CAR-T",
    "CAR T-cell",
    "gene editing",
    "CRISPR",
    "antisense oligonucleotide",
    "RNA therapy",
    "mRNA therapy",
    "siRNA",
    "lentiviral vector",
    "adeno-associated virus",
    "AAV gene therapy",
    "stem cell therapy",
    "chimeric antigen receptor",
    "T-cell receptor therapy",
    "TCR-T",
    "NK cell therapy",
    "natural killer cell",
    "dendritic cell vaccine",
    "oncolytic virus",
    "base editing",
    "prime editing",
]

# ClinicalTrials.gov intervention type filter
INTERVENTION_TYPES = ["BIOLOGICAL", "GENETIC"]

# Phases of interest
PHASES_OF_INTEREST = ["PHASE1", "PHASE2", "PHASE3", "PHASE4", "NA"]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class TherapyRecord:
    """Normalised therapy record extracted from a ClinicalTrials study."""

    nct_id: str
    title: str
    official_title: str
    brief_summary: str
    sponsor: str
    lead_sponsor_class: str
    conditions: list[str]
    interventions: list[dict[str, str]]
    phase: str
    status: str
    study_type: str
    start_date: str | None
    completion_date: str | None
    primary_completion_date: str | None
    enrollment: int | None
    locations: list[str]
    keywords: list[str]
    mesh_terms: list[str]
    url: str
    last_update_posted: str | None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass
class SyncStats:
    """Counters accumulated during a sync run."""

    fetched: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    errors: int = 0
    skipped: int = 0


# ---------------------------------------------------------------------------
# ClinicalTrials.gov API client
# ---------------------------------------------------------------------------

class ClinicalTrialsClient:
    """Thin wrapper around ClinicalTrials.gov API v2."""

    def __init__(self, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "TherapyTrackerPlatform/1.0 (contact@example.com)",
        })

    @retry(
        retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(5),
    )
    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{CLINICALTRIALS_API_BASE}{path}"
        response = self.session.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()

    def search_studies(
        self,
        query: str,
        page_token: str | None = None,
    ) -> dict[str, Any]:
        """Fetch one page of study results for the given query string."""
        params: dict[str, Any] = {
            "query.term": query,
            "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION,COMPLETED,TERMINATED",
            "pageSize": PAGE_SIZE,
            "fields": (
                "NCTId,BriefTitle,OfficialTitle,BriefSummary,LeadSponsorName,"
                "LeadSponsorClass,Condition,InterventionName,InterventionType,"
                "Phase,OverallStatus,StudyType,StartDate,CompletionDate,"
                "PrimaryCompletionDate,EnrollmentCount,LocationFacility,"
                "Keyword,MeshTerm,LastUpdatePostDate,StudyFirstPostDate"
            ),
            "sort": "LastUpdatePostDate:desc",
        }
        if page_token:
            params["pageToken"] = page_token
        return self._get("/studies", params)

    def iter_studies(
        self,
        query: str,
        max_results: int = MAX_RESULTS_DEFAULT,
    ) -> Generator[dict[str, Any], None, None]:
        """Paginate through all results for a query, up to max_results."""
        fetched = 0
        page_token: str | None = None

        while fetched < max_results:
            data = self._get_page(query, page_token)
            studies = data.get("studies", [])

            if not studies:
                break

            for study in studies:
                if fetched >= max_results:
                    return
                yield study
                fetched += 1

            page_token = data.get("nextPageToken")
            if not page_token:
                break

            time.sleep(REQUEST_DELAY_SECONDS)

    def _get_page(self, query: str, page_token: str | None) -> dict[str, Any]:
        params: dict[str, Any] = {
            "query.term": query,
            "filter.overallStatus": (
                "RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION,"
                "COMPLETED,TERMINATED,SUSPENDED"
            ),
            "pageSize": PAGE_SIZE,
            "fields": (
                "NCTId,BriefTitle,OfficialTitle,BriefSummary,LeadSponsorName,"
                "LeadSponsorClass,Condition,InterventionName,InterventionType,"
                "Phase,OverallStatus,StudyType,StartDate,CompletionDate,"
                "PrimaryCompletionDate,EnrollmentCount,LocationFacility,"
                "Keyword,MeshTerm,LastUpdatePostDate,StudyFirstPostDate"
            ),
            "sort": "LastUpdatePostDate:desc",
        }
        if page_token:
            params["pageToken"] = page_token
        return self._get("/studies", params)


# ---------------------------------------------------------------------------
# Study parsing
# ---------------------------------------------------------------------------

def _safe_list(data: dict, *keys: str) -> list[str]:
    """Safely extract a list of strings from nested dict keys."""
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return []
        current = current.get(key, [])
    if isinstance(current, list):
        return [str(item) for item in current if item is not None]
    return []


def _safe_str(data: dict, *keys: str, default: str = "") -> str:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return str(current) if current is not None else default


def parse_study(raw_study: dict[str, Any]) -> TherapyRecord | None:
    """Convert a raw ClinicalTrials.gov API v2 study dict into a TherapyRecord."""
    try:
        proto = raw_study.get("protocolSection", {})
        id_module = proto.get("identificationModule", {})
        desc_module = proto.get("descriptionModule", {})
        status_module = proto.get("statusModule", {})
        sponsor_module = proto.get("sponsorCollaboratorsModule", {})
        design_module = proto.get("designModule", {})
        conditions_module = proto.get("conditionsModule", {})
        arms_module = proto.get("armsInterventionsModule", {})
        contacts_module = proto.get("contactsLocationsModule", {})

        nct_id = _safe_str(id_module, "nctId")
        if not nct_id:
            return None

        # Extract interventions with type filter
        interventions: list[dict[str, str]] = []
        for interv in arms_module.get("interventions", []):
            itype = str(interv.get("type", "")).upper()
            iname = str(interv.get("name", ""))
            desc = str(interv.get("description", ""))
            if itype in INTERVENTION_TYPES and iname:
                interventions.append({
                    "type": itype,
                    "name": iname,
                    "description": desc[:500],  # truncate
                })

        # Skip studies with no gene/cell therapy interventions
        if not interventions:
            return None

        phases = design_module.get("phases", [])
        phase_str = ", ".join(phases) if phases else "N/A"

        # Locations
        locations = [
            loc.get("facility", {}).get("name", "")
            for loc in contacts_module.get("locations", [])
            if loc.get("facility", {}).get("name")
        ]

        # Enrollment
        enrollment_info = design_module.get("enrollmentInfo", {})
        enrollment = enrollment_info.get("count") if enrollment_info else None

        return TherapyRecord(
            nct_id=nct_id,
            title=_safe_str(id_module, "briefTitle"),
            official_title=_safe_str(id_module, "officialTitle"),
            brief_summary=_safe_str(desc_module, "briefSummary"),
            sponsor=_safe_str(
                sponsor_module, "leadSponsor", "name", default="Unknown"
            ),
            lead_sponsor_class=_safe_str(
                sponsor_module, "leadSponsor", "class", default="UNKNOWN"
            ),
            conditions=_safe_list(conditions_module, "conditions"),
            interventions=interventions,
            phase=phase_str,
            status=_safe_str(status_module, "overallStatus"),
            study_type=_safe_str(design_module, "studyType"),
            start_date=_safe_str(status_module, "startDateStruct", "date") or None,
            completion_date=(
                _safe_str(status_module, "completionDateStruct", "date") or None
            ),
            primary_completion_date=(
                _safe_str(status_module, "primaryCompletionDateStruct", "date") or None
            ),
            enrollment=int(enrollment) if enrollment else None,
            locations=locations[:20],  # cap at 20 locations
            keywords=_safe_list(conditions_module, "keywords"),
            mesh_terms=_safe_list(conditions_module, "meshes"),
            url=f"https://clinicaltrials.gov/study/{nct_id}",
            last_update_posted=(
                _safe_str(status_module, "lastUpdatePostDateStruct", "date") or None
            ),
            raw=raw_study,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("parse_study.failed", error=str(exc))
        return None


def is_gene_cell_therapy(record: TherapyRecord) -> bool:
    """
    Additional keyword filter — ensures the study is genuinely about
    gene/cell therapy, not just tangentially related.
    """
    text_blob = " ".join([
        record.title,
        record.official_title,
        record.brief_summary,
        " ".join(record.conditions),
        " ".join(record.keywords),
        " ".join(i["name"] for i in record.interventions),
    ]).lower()

    gene_cell_keywords = {
        "gene therapy", "cell therapy", "car-t", "car t", "cart", "gene editing",
        "crispr", "antisense", "oligonucleotide", "rna therapy", "mrna", "sirna",
        "lentiviral", "adeno-associated", "aav", "stem cell", "chimeric antigen",
        "t-cell receptor", "tcr-t", "nk cell", "natural killer", "dendritic cell",
        "oncolytic", "base editing", "prime editing", "viral vector",
        "retroviral vector", "zinc finger", "tale nuclease",
    }
    return any(kw in text_blob for kw in gene_cell_keywords)


# ---------------------------------------------------------------------------
# AI summary generation
# ---------------------------------------------------------------------------

def generate_summary(record: TherapyRecord, client: anthropic.Anthropic) -> str:
    """Use Claude to generate a concise lay-person summary of the therapy."""
    prompt = f"""You are a biomedical content writer for a cell and gene therapy tracking platform.
Write a 2-3 sentence plain-language summary of the following clinical trial for a scientifically literate but non-specialist audience.
Focus on: what the therapy does, what disease it targets, and the current development stage.

Trial title: {record.title}
Sponsor: {record.sponsor}
Conditions: {', '.join(record.conditions[:5])}
Interventions: {', '.join(i['name'] for i in record.interventions[:3])}
Phase: {record.phase}
Status: {record.status}
Brief summary from registry: {record.brief_summary[:800]}

Respond with only the summary text, no preamble."""

    try:
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as exc:  # noqa: BLE001
        log.warning("generate_summary.failed", nct_id=record.nct_id, error=str(exc))
        return ""


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

class TherapyRepository:
    """
    Minimal database repository for therapy records.

    In production this would use the full SQLAlchemy ORM models from app/.
    Here we use raw SQL for portability (can run standalone without the full app).
    """

    def __init__(self, engine):
        self.engine = engine

    def find_by_nct_id(self, nct_id: str) -> dict[str, Any] | None:
        with Session(self.engine) as session:
            result = session.execute(
                text("SELECT id, nct_id, last_update_posted, status FROM therapies WHERE nct_id = :nct_id"),
                {"nct_id": nct_id},
            ).fetchone()
            return dict(result._mapping) if result else None

    def create(self, record: TherapyRecord, ai_summary: str = "") -> str:
        """Insert a new therapy record and return its UUID."""
        with Session(self.engine) as session:
            row = session.execute(
                text("""
                    INSERT INTO therapies (
                        nct_id, title, official_title, brief_summary, ai_summary,
                        sponsor, lead_sponsor_class, conditions, interventions,
                        phase, status, study_type, start_date, completion_date,
                        primary_completion_date, enrollment, locations,
                        keywords, mesh_terms, url, last_update_posted,
                        source, created_at, updated_at
                    ) VALUES (
                        :nct_id, :title, :official_title, :brief_summary, :ai_summary,
                        :sponsor, :lead_sponsor_class, :conditions::jsonb, :interventions::jsonb,
                        :phase, :status, :study_type, :start_date, :completion_date,
                        :primary_completion_date, :enrollment, :locations::jsonb,
                        :keywords::jsonb, :mesh_terms::jsonb, :url, :last_update_posted,
                        'clinicaltrials', NOW(), NOW()
                    )
                    RETURNING id
                """),
                {
                    "nct_id": record.nct_id,
                    "title": record.title[:500],
                    "official_title": record.official_title[:1000],
                    "brief_summary": record.brief_summary[:5000],
                    "ai_summary": ai_summary,
                    "sponsor": record.sponsor[:300],
                    "lead_sponsor_class": record.lead_sponsor_class,
                    "conditions": json.dumps(record.conditions),
                    "interventions": json.dumps(record.interventions),
                    "phase": record.phase,
                    "status": record.status,
                    "study_type": record.study_type,
                    "start_date": record.start_date,
                    "completion_date": record.completion_date,
                    "primary_completion_date": record.primary_completion_date,
                    "enrollment": record.enrollment,
                    "locations": json.dumps(record.locations),
                    "keywords": json.dumps(record.keywords),
                    "mesh_terms": json.dumps(record.mesh_terms),
                    "url": record.url,
                    "last_update_posted": record.last_update_posted,
                },
            )
            session.commit()
            return str(row.fetchone()[0])

    def update(self, nct_id: str, record: TherapyRecord) -> None:
        """Update changed fields and log a version history entry."""
        with Session(self.engine) as session:
            existing = session.execute(
                text("SELECT id FROM therapies WHERE nct_id = :nct_id"),
                {"nct_id": nct_id},
            ).fetchone()

            if not existing:
                return

            therapy_id = existing[0]

            session.execute(
                text("""
                    UPDATE therapies SET
                        title = :title,
                        official_title = :official_title,
                        brief_summary = :brief_summary,
                        sponsor = :sponsor,
                        conditions = :conditions::jsonb,
                        interventions = :interventions::jsonb,
                        phase = :phase,
                        status = :status,
                        completion_date = :completion_date,
                        primary_completion_date = :primary_completion_date,
                        enrollment = :enrollment,
                        locations = :locations::jsonb,
                        last_update_posted = :last_update_posted,
                        updated_at = NOW()
                    WHERE nct_id = :nct_id
                """),
                {
                    "nct_id": nct_id,
                    "title": record.title[:500],
                    "official_title": record.official_title[:1000],
                    "brief_summary": record.brief_summary[:5000],
                    "sponsor": record.sponsor[:300],
                    "conditions": json.dumps(record.conditions),
                    "interventions": json.dumps(record.interventions),
                    "phase": record.phase,
                    "status": record.status,
                    "completion_date": record.completion_date,
                    "primary_completion_date": record.primary_completion_date,
                    "enrollment": record.enrollment,
                    "locations": json.dumps(record.locations),
                    "last_update_posted": record.last_update_posted,
                },
            )

            # Log version history
            session.execute(
                text("""
                    INSERT INTO therapy_version_history (therapy_id, changed_at, source, snapshot)
                    VALUES (:therapy_id, NOW(), 'clinicaltrials_sync', :snapshot::jsonb)
                """),
                {
                    "therapy_id": therapy_id,
                    "snapshot": json.dumps({
                        "nct_id": record.nct_id,
                        "status": record.status,
                        "phase": record.phase,
                        "last_update_posted": record.last_update_posted,
                    }),
                },
            )
            session.commit()


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def run_sync(
    db_url: str,
    anthropic_api_key: str,
    max_results: int = MAX_RESULTS_DEFAULT,
    dry_run: bool = False,
) -> SyncStats:
    """Execute the full ClinicalTrials.gov sync pipeline."""

    log.info(
        "clinicaltrials_sync.start",
        max_results=max_results,
        dry_run=dry_run,
        search_term_count=len(SEARCH_TERMS),
    )

    stats = SyncStats()
    seen_nct_ids: set[str] = set()  # deduplicate across search terms

    client = ClinicalTrialsClient()
    ai_client = anthropic.Anthropic(api_key=anthropic_api_key)

    engine = create_engine(db_url, pool_pre_ping=True) if not dry_run else None
    repo = TherapyRepository(engine) if engine else None

    for term in SEARCH_TERMS:
        log.info("clinicaltrials_sync.term_start", term=term)
        term_count = 0

        try:
            for raw_study in client.iter_studies(term, max_results=max_results // len(SEARCH_TERMS) + 10):
                stats.fetched += 1

                record = parse_study(raw_study)
                if record is None:
                    stats.skipped += 1
                    continue

                # Deduplicate across overlapping search terms
                if record.nct_id in seen_nct_ids:
                    stats.skipped += 1
                    continue
                seen_nct_ids.add(record.nct_id)

                # Additional keyword filter
                if not is_gene_cell_therapy(record):
                    stats.skipped += 1
                    continue

                term_count += 1

                if dry_run:
                    log.info(
                        "clinicaltrials_sync.dry_run_record",
                        nct_id=record.nct_id,
                        title=record.title[:80],
                        phase=record.phase,
                        status=record.status,
                    )
                    stats.created += 1  # count as would-create for reporting
                    continue

                # Check if record exists in DB
                existing = repo.find_by_nct_id(record.nct_id)

                if existing is None:
                    # New record — generate AI summary
                    ai_summary = generate_summary(record, ai_client)
                    time.sleep(0.5)  # slight delay between AI calls

                    repo.create(record, ai_summary=ai_summary)
                    stats.created += 1
                    log.info(
                        "clinicaltrials_sync.created",
                        nct_id=record.nct_id,
                        title=record.title[:80],
                    )
                elif existing.get("last_update_posted") != record.last_update_posted:
                    # Existing record with updates
                    repo.update(record.nct_id, record)
                    stats.updated += 1
                    log.info(
                        "clinicaltrials_sync.updated",
                        nct_id=record.nct_id,
                        old_update=existing.get("last_update_posted"),
                        new_update=record.last_update_posted,
                    )
                else:
                    stats.unchanged += 1

        except Exception as exc:  # noqa: BLE001
            log.error("clinicaltrials_sync.term_error", term=term, error=str(exc))
            stats.errors += 1

        log.info("clinicaltrials_sync.term_complete", term=term, count=term_count)
        time.sleep(REQUEST_DELAY_SECONDS * 2)  # extra delay between term searches

    log.info(
        "clinicaltrials_sync.complete",
        **{
            "fetched": stats.fetched,
            "created": stats.created,
            "updated": stats.updated,
            "unchanged": stats.unchanged,
            "skipped": stats.skipped,
            "errors": stats.errors,
            "unique_records_processed": len(seen_nct_ids),
        },
    )
    return stats


# ---------------------------------------------------------------------------
# Secret fetching (GCP Secret Manager)
# ---------------------------------------------------------------------------

def get_secret(secret_id: str, project_id: str) -> str:
    """Fetch a secret from GCP Secret Manager."""
    from google.cloud import secretmanager  # noqa: PLC0415

    sm_client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = sm_client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync ClinicalTrials.gov gene/cell therapy data into the platform DB"
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=MAX_RESULTS_DEFAULT,
        help=f"Maximum total records to fetch (default: {MAX_RESULTS_DEFAULT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and log records without writing to DB",
    )
    parser.add_argument(
        "--use-secret-manager",
        action="store_true",
        default=os.getenv("ENVIRONMENT") not in ("development", "test", None),
        help="Fetch credentials from GCP Secret Manager instead of env vars",
    )
    args = parser.parse_args()

    # Resolve credentials
    environment = os.getenv("ENVIRONMENT", "development")
    project_id = os.getenv("GCP_PROJECT_ID", "")

    if args.use_secret_manager and project_id:
        log.info("clinicaltrials_sync.using_secret_manager", project_id=project_id)
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

        anthropic_api_key = get_secret(f"{environment}-anthropic-api-key", project_id)
    else:
        db_url = os.getenv("DATABASE_URL", "postgresql+psycopg2://therapy_user:therapy_pass@localhost/therapy_tracker")
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not anthropic_api_key:
        log.warning("clinicaltrials_sync.no_anthropic_key", msg="AI summaries will be skipped")

    stats = run_sync(
        db_url=db_url,
        anthropic_api_key=anthropic_api_key,
        max_results=args.max_results,
        dry_run=args.dry_run,
    )

    # Exit with non-zero if there were errors (so Cloud Scheduler can detect failures)
    if stats.errors > 0:
        log.warning("clinicaltrials_sync.finished_with_errors", errors=stats.errors)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
