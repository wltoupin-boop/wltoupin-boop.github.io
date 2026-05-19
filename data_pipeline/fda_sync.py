#!/usr/bin/env python3
"""
fda_sync.py
===========
Standalone data pipeline script — Cell & Gene Therapy Tracking Platform

Queries the openFDA /drug/drugsfda.json endpoint and FDA press releases
RSS feed to identify new gene/cell therapy approvals and update therapy
records with approval metadata.

Usage:
    python fda_sync.py [--days-back 90] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import feedparser
import requests
import structlog
from dotenv import load_dotenv
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
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

OPENFDA_BASE = "https://api.fda.gov"
FDA_PRESS_RSS = "https://www.fda.gov/news-events/fda-newsroom/press-announcements/rss.xml"
PAGE_SIZE = 100
REQUEST_DELAY = 1.0

# Keyword patterns for identifying gene/cell therapy approvals in FDA data
GENE_CELL_KEYWORDS = [
    r"gene therapy",
    r"cell therapy",
    r"CAR[-\s]T",
    r"chimeric antigen receptor",
    r"gene editing",
    r"CRISPR",
    r"antisense",
    r"oligonucleotide",
    r"RNA therapy",
    r"mRNA",
    r"siRNA",
    r"lentiviral",
    r"adeno.associated virus",
    r"\bAAV\b",
    r"stem cell",
    r"oncolytic",
    r"viral vector",
    r"TCR.T",
    r"NK cell",
    r"natural killer cell",
]

COMPILED_PATTERNS = [re.compile(kw, re.IGNORECASE) for kw in GENE_CELL_KEYWORDS]

# FDA product type codes for biologics (which includes most gene/cell therapies)
BIOLOGIC_APPLICATION_TYPES = ["BLA", "BLA/OA", "BLA/EA"]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class FDAApproval:
    """Parsed FDA approval record."""

    application_number: str
    application_type: str  # BLA, NDA, etc.
    sponsor_name: str
    brand_name: str
    generic_name: str
    action_date: str | None
    action_type: str  # "AP" = approval
    submission_type: str
    drug_substance_name: str
    pharmacological_class: list[str]
    products: list[dict[str, Any]]
    nct_ids: list[str]  # linked clinical trial IDs (if parseable)
    is_gene_cell_therapy: bool = False
    raw: dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass
class PressRelease:
    """FDA press release from RSS feed."""

    title: str
    url: str
    published: str | None
    summary: str
    is_gene_cell_therapy: bool = False


@dataclass
class SyncStats:
    fetched: int = 0
    matched: int = 0
    therapy_updated: int = 0
    new_approvals_logged: int = 0
    errors: int = 0


# ---------------------------------------------------------------------------
# openFDA client
# ---------------------------------------------------------------------------

class OpenFDAClient:
    """Client for the openFDA API."""

    def __init__(self, api_key: str = ""):
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "TherapyTrackerPlatform/1.0 (contact@example.com)",
        })
        self.api_key = api_key

    @retry(
        retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
        wait=wait_exponential(multiplier=1, min=2, max=60),
        stop=stop_after_attempt(5),
    )
    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        if self.api_key:
            params["api_key"] = self.api_key
        url = f"{OPENFDA_BASE}{path}"
        response = self.session.get(url, params=params, timeout=30)

        if response.status_code == 404:
            return {"results": [], "meta": {"results": {"total": 0}}}
        if response.status_code == 429:
            log.warning("openfda.rate_limited", waiting=60)
            time.sleep(60)
            response = self.session.get(url, params=params, timeout=30)

        response.raise_for_status()
        return response.json()

    def search_drugsfda(
        self,
        search_query: str,
        skip: int = 0,
        limit: int = PAGE_SIZE,
    ) -> dict[str, Any]:
        return self._get(
            "/drug/drugsfda.json",
            {
                "search": search_query,
                "limit": limit,
                "skip": skip,
                "sort": "submissions.action_date:desc",
            },
        )

    def get_recent_approvals(self, days_back: int = 90) -> list[dict[str, Any]]:
        """Fetch BLA approvals from the last N days."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y%m%d")
        today = datetime.now(timezone.utc).strftime("%Y%m%d")

        query = (
            f"submissions.action_date:[{cutoff}+TO+{today}]"
            "+AND+submissions.submission_type:\"ORIG\""
            "+AND+application_number:[BLA000000+TO+BLA999999]"
        )

        all_results = []
        skip = 0

        while True:
            data = self.search_drugsfda(query, skip=skip, limit=PAGE_SIZE)
            results = data.get("results", [])
            if not results:
                break

            all_results.extend(results)
            total = data.get("meta", {}).get("results", {}).get("total", 0)
            skip += len(results)

            if skip >= total or skip >= 1000:  # openFDA hard cap
                break

            time.sleep(REQUEST_DELAY)

        return all_results

    def search_by_keyword(self, keyword: str) -> list[dict[str, Any]]:
        """Search by a gene/cell therapy keyword across all fields."""
        query = f'"{keyword}"'
        data = self.search_drugsfda(query, limit=PAGE_SIZE)
        return data.get("results", [])


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _match_gene_cell_therapy(text: str) -> bool:
    """Return True if any gene/cell therapy keyword is found in the text."""
    return any(p.search(text) for p in COMPILED_PATTERNS)


def parse_fda_result(raw: dict[str, Any]) -> FDAApproval:
    """Convert raw openFDA drugsfda result into an FDAApproval."""
    submissions = raw.get("submissions", [])
    # Sort submissions by action_date descending to get the most recent approval
    approved_subs = [
        s for s in submissions if s.get("submission_status") == "AP"
    ]
    approved_subs.sort(
        key=lambda s: s.get("action_date", "19000101"),
        reverse=True,
    )

    latest_approval = approved_subs[0] if approved_subs else {}

    # Extract product names
    products = raw.get("products", [])
    brand_names = list({
        p.get("brand_name", "")
        for p in products
        if p.get("brand_name")
    })
    generic_names = list({
        p.get("active_ingredients", [{}])[0].get("name", "")
        for p in products
        if p.get("active_ingredients")
    })

    # Pharmacological class
    pharma_class = list({
        pc
        for p in products
        for pc in (p.get("pharm_class", []) or [])
    })

    # Text blob for keyword matching
    text_blob = " ".join([
        raw.get("sponsor_name", ""),
        *brand_names,
        *generic_names,
        *pharma_class,
        raw.get("application_number", ""),
    ])

    return FDAApproval(
        application_number=raw.get("application_number", ""),
        application_type=raw.get("application_number", "")[0:3],
        sponsor_name=raw.get("sponsor_name", ""),
        brand_name=", ".join(brand_names) if brand_names else "",
        generic_name=", ".join(generic_names) if generic_names else "",
        action_date=latest_approval.get("action_date"),
        action_type=latest_approval.get("submission_status", ""),
        submission_type=latest_approval.get("submission_type", ""),
        drug_substance_name="",
        pharmacological_class=pharma_class,
        products=products[:10],
        nct_ids=[],  # enriched separately
        is_gene_cell_therapy=_match_gene_cell_therapy(text_blob),
        raw=raw,
    )


def parse_press_release(entry: Any) -> PressRelease:
    """Convert a feedparser entry into a PressRelease."""
    summary = getattr(entry, "summary", "") or ""
    title = getattr(entry, "title", "") or ""
    published = getattr(entry, "published", None)
    link = getattr(entry, "link", "") or ""

    return PressRelease(
        title=title,
        url=link,
        published=published,
        summary=summary,
        is_gene_cell_therapy=_match_gene_cell_therapy(f"{title} {summary}"),
    )


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

class FDARepository:
    """Repository for FDA approval data."""

    def __init__(self, engine):
        self.engine = engine

    def find_therapy_by_brand_name(self, brand_name: str) -> dict | None:
        """Try to match an FDA approval to an existing therapy record by brand name."""
        with Session(self.engine) as session:
            result = session.execute(
                text("""
                    SELECT id, nct_id, title, fda_approval_status
                    FROM therapies
                    WHERE LOWER(title) LIKE LOWER(:brand_pattern)
                       OR LOWER(brand_name) = LOWER(:brand_name)
                    LIMIT 1
                """),
                {
                    "brand_pattern": f"%{brand_name}%",
                    "brand_name": brand_name,
                },
            ).fetchone()
            return dict(result._mapping) if result else None

    def upsert_fda_approval(self, approval: FDAApproval, therapy_id: str | None = None) -> None:
        """Insert or update an FDA approval record."""
        with Session(self.engine) as session:
            existing = session.execute(
                text("""
                    SELECT id FROM fda_approvals
                    WHERE application_number = :app_num
                """),
                {"app_num": approval.application_number},
            ).fetchone()

            if existing:
                session.execute(
                    text("""
                        UPDATE fda_approvals SET
                            brand_name = :brand_name,
                            generic_name = :generic_name,
                            action_date = :action_date,
                            pharmacological_class = :pharma_class::jsonb,
                            products = :products::jsonb,
                            therapy_id = COALESCE(:therapy_id, therapy_id),
                            updated_at = NOW()
                        WHERE application_number = :app_num
                    """),
                    {
                        "app_num": approval.application_number,
                        "brand_name": approval.brand_name[:300],
                        "generic_name": approval.generic_name[:300],
                        "action_date": approval.action_date,
                        "pharma_class": json.dumps(approval.pharmacological_class),
                        "products": json.dumps(approval.products),
                        "therapy_id": therapy_id,
                    },
                )
            else:
                session.execute(
                    text("""
                        INSERT INTO fda_approvals (
                            application_number, application_type, sponsor_name,
                            brand_name, generic_name, action_date, action_type,
                            pharmacological_class, products, therapy_id,
                            created_at, updated_at
                        ) VALUES (
                            :app_num, :app_type, :sponsor,
                            :brand_name, :generic_name, :action_date, :action_type,
                            :pharma_class::jsonb, :products::jsonb, :therapy_id,
                            NOW(), NOW()
                        )
                    """),
                    {
                        "app_num": approval.application_number,
                        "app_type": approval.application_type,
                        "sponsor": approval.sponsor_name[:300],
                        "brand_name": approval.brand_name[:300],
                        "generic_name": approval.generic_name[:300],
                        "action_date": approval.action_date,
                        "action_type": approval.action_type,
                        "pharma_class": json.dumps(approval.pharmacological_class),
                        "products": json.dumps(approval.products),
                        "therapy_id": therapy_id,
                    },
                )

            # If we matched a therapy, update its approval status
            if therapy_id:
                session.execute(
                    text("""
                        UPDATE therapies SET
                            fda_approval_status = 'APPROVED',
                            fda_approval_date = :action_date,
                            fda_application_number = :app_num,
                            updated_at = NOW()
                        WHERE id = :therapy_id
                    """),
                    {
                        "action_date": approval.action_date,
                        "app_num": approval.application_number,
                        "therapy_id": therapy_id,
                    },
                )

            session.commit()

    def log_press_release(self, pr: PressRelease) -> None:
        """Store a gene/cell therapy press release for reference."""
        with Session(self.engine) as session:
            existing = session.execute(
                text("SELECT id FROM fda_press_releases WHERE url = :url"),
                {"url": pr.url},
            ).fetchone()

            if not existing:
                session.execute(
                    text("""
                        INSERT INTO fda_press_releases (title, url, published_at, summary, created_at)
                        VALUES (:title, :url, :published, :summary, NOW())
                        ON CONFLICT (url) DO NOTHING
                    """),
                    {
                        "title": pr.title[:500],
                        "url": pr.url,
                        "published": pr.published,
                        "summary": pr.summary[:5000],
                    },
                )
                session.commit()


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def fetch_and_parse_press_releases(stats: SyncStats) -> list[PressRelease]:
    """Fetch FDA press releases RSS feed and filter for gene/cell therapy items."""
    log.info("fda_sync.press_releases.start", url=FDA_PRESS_RSS)
    releases: list[PressRelease] = []

    try:
        feed = feedparser.parse(FDA_PRESS_RSS)
        for entry in feed.entries:
            pr = parse_press_release(entry)
            if pr.is_gene_cell_therapy:
                releases.append(pr)
                log.info(
                    "fda_sync.press_release.matched",
                    title=pr.title[:80],
                    published=pr.published,
                )

        log.info(
            "fda_sync.press_releases.complete",
            total=len(feed.entries),
            matched=len(releases),
        )
    except Exception as exc:  # noqa: BLE001
        log.error("fda_sync.press_releases.error", error=str(exc))
        stats.errors += 1

    return releases


def run_sync(
    db_url: str,
    openfda_api_key: str = "",
    days_back: int = 90,
    dry_run: bool = False,
) -> SyncStats:
    """Run the full FDA approval sync."""

    log.info("fda_sync.start", days_back=days_back, dry_run=dry_run)
    stats = SyncStats()

    fda_client = OpenFDAClient(api_key=openfda_api_key)
    engine = create_engine(db_url, pool_pre_ping=True) if not dry_run else None
    repo = FDARepository(engine) if engine else None

    # --- Part 1: openFDA recent BLA approvals ---
    log.info("fda_sync.openfda.start", days_back=days_back)

    try:
        raw_results = fda_client.get_recent_approvals(days_back=days_back)
        stats.fetched += len(raw_results)
        log.info("fda_sync.openfda.fetched", count=len(raw_results))

        for raw in raw_results:
            approval = parse_fda_result(raw)

            if not approval.is_gene_cell_therapy:
                continue

            stats.matched += 1
            log.info(
                "fda_sync.openfda.matched",
                app_num=approval.application_number,
                brand=approval.brand_name[:60],
                date=approval.action_date,
            )

            if dry_run:
                stats.new_approvals_logged += 1
                continue

            # Try to match to an existing therapy in the DB
            therapy = None
            if approval.brand_name:
                therapy = repo.find_therapy_by_brand_name(approval.brand_name)
                if therapy:
                    stats.therapy_updated += 1

            repo.upsert_fda_approval(
                approval,
                therapy_id=therapy["id"] if therapy else None,
            )
            stats.new_approvals_logged += 1

            time.sleep(REQUEST_DELAY)

    except Exception as exc:  # noqa: BLE001
        log.error("fda_sync.openfda.error", error=str(exc))
        stats.errors += 1

    # --- Part 2: FDA press releases RSS ---
    press_releases = fetch_and_parse_press_releases(stats)

    if not dry_run and repo:
        for pr in press_releases:
            try:
                repo.log_press_release(pr)
            except Exception as exc:  # noqa: BLE001
                log.warning("fda_sync.press_release.save_error", error=str(exc))

    # --- Part 3: Targeted keyword searches for known gene/cell therapy terms ---
    targeted_terms = [
        "gene therapy",
        "CAR-T",
        "cell therapy",
        "antisense oligonucleotide",
    ]

    log.info("fda_sync.targeted_search.start", terms=targeted_terms)

    for term in targeted_terms:
        try:
            raw_results = fda_client.search_by_keyword(term)
            for raw in raw_results:
                approval = parse_fda_result(raw)
                if not approval.action_date:
                    continue

                # Only process recent approvals not yet captured
                try:
                    action_dt = datetime.strptime(approval.action_date, "%Y%m%d").replace(
                        tzinfo=timezone.utc
                    )
                    if action_dt < datetime.now(timezone.utc) - timedelta(days=days_back):
                        continue
                except ValueError:
                    continue

                stats.fetched += 1
                if not approval.is_gene_cell_therapy:
                    continue

                stats.matched += 1

                if not dry_run and repo:
                    therapy = repo.find_therapy_by_brand_name(approval.brand_name) if approval.brand_name else None
                    repo.upsert_fda_approval(
                        approval,
                        therapy_id=therapy["id"] if therapy else None,
                    )

            time.sleep(REQUEST_DELAY * 2)

        except Exception as exc:  # noqa: BLE001
            log.error("fda_sync.targeted_search.error", term=term, error=str(exc))
            stats.errors += 1

    log.info(
        "fda_sync.complete",
        **{
            "fetched": stats.fetched,
            "matched": stats.matched,
            "therapy_updated": stats.therapy_updated,
            "approvals_logged": stats.new_approvals_logged,
            "press_releases": len(press_releases),
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
    parser = argparse.ArgumentParser(description="Sync FDA approval data into the platform DB")
    parser.add_argument(
        "--days-back",
        type=int,
        default=90,
        help="Number of days back to search for approvals (default: 90)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Log without writing to DB")
    parser.add_argument(
        "--use-secret-manager",
        action="store_true",
        default=os.getenv("ENVIRONMENT") not in ("development", "test", None),
    )
    args = parser.parse_args()

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

    openfda_api_key = os.getenv("OPENFDA_API_KEY", "")

    stats = run_sync(
        db_url=db_url,
        openfda_api_key=openfda_api_key,
        days_back=args.days_back,
        dry_run=args.dry_run,
    )

    sys.exit(1 if stats.errors > 0 else 0)


if __name__ == "__main__":
    main()
