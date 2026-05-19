"""
Data ingestion trigger and status endpoints (admin-only).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.user import User
from app.services.clinicaltrials import ClinicalTrialsService
from app.services.ai_extractor import AIExtractorService

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

# In-memory job tracker (swap for Redis/DB in production)
_jobs: dict[str, dict] = {}


@router.post("/trigger")
async def trigger_ingestion(
    source: str = Query("all", pattern="^(all|clinicaltrials|fda)$"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Manually trigger a data ingestion run."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id,
        "source": source,
        "status": "queued",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "records_processed": 0,
        "errors": [],
    }

    async def run_ingestion():
        _jobs[job_id]["status"] = "running"
        try:
            ct_service = ClinicalTrialsService()
            ai_service = AIExtractorService()
            count = await ct_service.run_full_sync(db, ai_service)
            _jobs[job_id]["records_processed"] = count
            _jobs[job_id]["status"] = "completed"
        except Exception as exc:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["errors"].append(str(exc))
        finally:
            _jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    background_tasks.add_task(run_ingestion)
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs")
async def list_jobs(_admin: User = Depends(require_admin)):
    """List recent ingestion jobs (most recent first)."""
    jobs = sorted(_jobs.values(), key=lambda j: j["started_at"], reverse=True)
    return {"jobs": jobs[:20]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, _admin: User = Depends(require_admin)):
    if job_id not in _jobs:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Job not found")
    return _jobs[job_id]


@router.post("/clinicaltrials/search")
async def search_clinicaltrials(
    query: str = Query(..., min_length=2),
    max_results: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Search ClinicalTrials.gov and preview importable results."""
    service = ClinicalTrialsService()
    studies = await service.search_studies(query, max_results=max_results)
    return {
        "query": query,
        "total_found": len(studies),
        "studies": [service.map_study_to_preview(s) for s in studies],
    }


@router.post("/clinicaltrials/import/{nct_id}")
async def import_from_clinicaltrials(
    nct_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Import or refresh a single study from ClinicalTrials.gov."""
    ct_service = ClinicalTrialsService()
    ai_service = AIExtractorService()
    study = await ct_service.get_study(nct_id)
    if not study:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"NCT ID {nct_id} not found on ClinicalTrials.gov")
    therapy = await ct_service.upsert_study(study, db, ai_service, created_by=admin.id)
    return {"status": "ok", "therapy_id": str(therapy.id), "nct_id": nct_id}
