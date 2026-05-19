"""
ClinicalTrials.gov API v2 integration service.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date
from typing import Any, Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.models.therapy import (
    ClinicalPhase,
    DiseaseCategory,
    FDAApprovalStatus,
    Therapy,
    TherapyType,
    TherapyVersionHistory,
    DataSourceRecord,
    TrialStatus,
)

logger = structlog.get_logger(__name__)

CT_BASE = "https://clinicaltrials.gov/api/v2"

GENE_CELL_THERAPY_TERMS = [
    "gene therapy",
    "cell therapy",
    "CAR-T",
    "CAR T cell",
    "gene editing",
    "CRISPR",
    "lentiviral vector",
    "adeno-associated virus",
    "AAV gene",
    "ex vivo gene",
    "in vivo gene",
    "antisense oligonucleotide",
    "RNA therapy",
    "mRNA therapy",
    "stem cell gene",
    "hematopoietic stem cell gene",
    "oncolytic virus",
    "base editing",
    "prime editing",
]

PHASE_MAP = {
    "PHASE1": ClinicalPhase.PHASE_1,
    "PHASE2": ClinicalPhase.PHASE_2,
    "PHASE3": ClinicalPhase.PHASE_3,
    "PHASE4": ClinicalPhase.PHASE_4,
    "EARLY_PHASE1": ClinicalPhase.PHASE_1,
    "NA": ClinicalPhase.PHASE_1,
}

STATUS_MAP = {
    "NOT_YET_RECRUITING": TrialStatus.NOT_YET_RECRUITING,
    "RECRUITING": TrialStatus.RECRUITING,
    "ENROLLING_BY_INVITATION": TrialStatus.ENROLLING_BY_INVITATION,
    "ACTIVE_NOT_RECRUITING": TrialStatus.ACTIVE_NOT_RECRUITING,
    "COMPLETED": TrialStatus.COMPLETED,
    "SUSPENDED": TrialStatus.SUSPENDED,
    "TERMINATED": TrialStatus.TERMINATED,
    "WITHDRAWN": TrialStatus.WITHDRAWN,
    "UNKNOWN": TrialStatus.UNKNOWN,
}

DISEASE_KEYWORDS: dict[str, DiseaseCategory] = {
    "leukemia": DiseaseCategory.ONCOLOGY,
    "lymphoma": DiseaseCategory.ONCOLOGY,
    "myeloma": DiseaseCategory.ONCOLOGY,
    "cancer": DiseaseCategory.ONCOLOGY,
    "tumor": DiseaseCategory.ONCOLOGY,
    "carcinoma": DiseaseCategory.ONCOLOGY,
    "sarcoma": DiseaseCategory.ONCOLOGY,
    "anemia": DiseaseCategory.HEMATOLOGY,
    "hemophilia": DiseaseCategory.HEMATOLOGY,
    "sickle cell": DiseaseCategory.HEMATOLOGY,
    "thalassemia": DiseaseCategory.HEMATOLOGY,
    "neurological": DiseaseCategory.NEUROLOGY,
    "muscular dystrophy": DiseaseCategory.NEUROLOGY,
    "spinal muscular atrophy": DiseaseCategory.NEUROLOGY,
    "sma": DiseaseCategory.NEUROLOGY,
    "retinal": DiseaseCategory.OPHTHALMOLOGY,
    "leber": DiseaseCategory.OPHTHALMOLOGY,
    "macular": DiseaseCategory.OPHTHALMOLOGY,
    "metabolic": DiseaseCategory.METABOLIC,
    "immune": DiseaseCategory.IMMUNOLOGY,
    "immunodeficiency": DiseaseCategory.IMMUNOLOGY,
    "scid": DiseaseCategory.IMMUNOLOGY,
    "cardiovascular": DiseaseCategory.CARDIOVASCULAR,
    "heart failure": DiseaseCategory.CARDIOVASCULAR,
}


class ClinicalTrialsService:
    def __init__(self, base_url: str = CT_BASE):
        self.base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if not self._client or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
                headers={"Accept": "application/json"},
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def search_studies(
        self, query: str, max_results: int = 100, page_token: Optional[str] = None
    ) -> list[dict]:
        client = await self._get_client()
        params: dict[str, Any] = {
            "query.term": query,
            "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION,NOT_YET_RECRUITING,COMPLETED",
            "fields": "NCTId,BriefTitle,OfficialTitle,OverallStatus,Phase,Condition,InterventionType,InterventionName,LeadSponsorName,StudyType,PrimaryCompletionDate,CompletionDate,StartDate,BriefSummary,ResponsiblePartyInvestigatorFullName,LocationCountry",
            "pageSize": min(max_results, 100),
            "format": "json",
        }
        if page_token:
            params["pageToken"] = page_token

        response = await client.get("/studies", params=params)
        response.raise_for_status()
        data = response.json()
        studies = data.get("studies", [])
        logger.info("ClinicalTrials search", query=query, count=len(studies))
        return studies

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def get_study(self, nct_id: str) -> Optional[dict]:
        client = await self._get_client()
        response = await client.get(f"/studies/{nct_id}", params={"format": "json"})
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    def _infer_therapy_type(self, study: dict) -> TherapyType:
        interventions = study.get("protocolSection", {}).get("armsInterventionsModule", {}).get("interventions", [])
        all_text = " ".join(
            [i.get("name", "") + " " + i.get("description", "") for i in interventions]
        ).lower()
        if any(t in all_text for t in ["car-t", "car t", "chimeric antigen"]):
            return TherapyType.CAR_T
        if any(t in all_text for t in ["crispr", "base editing", "prime editing", "zinc finger", "talen"]):
            return TherapyType.GENE_EDITING
        if any(t in all_text for t in ["antisense", "oligonucleotide", "morpholino"]):
            return TherapyType.RNA_THERAPY
        if any(t in all_text for t in ["mrna", "sirna", "rna therapy"]):
            return TherapyType.RNA_THERAPY
        if any(t in all_text for t in ["oncolytic"]):
            return TherapyType.ONCOLYTIC_VIRUS
        if any(t in all_text for t in ["cell therapy", "stem cell", "hematopoietic"]):
            return TherapyType.CELL_THERAPY
        return TherapyType.GENE_THERAPY

    def _infer_disease_category(self, conditions: list[str]) -> DiseaseCategory:
        combined = " ".join(conditions).lower()
        for keyword, category in DISEASE_KEYWORDS.items():
            if keyword in combined:
                return category
        return DiseaseCategory.RARE_DISEASE

    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        if not date_str:
            return None
        from datetime import datetime
        for fmt in ("%Y-%m-%d", "%B %Y", "%Y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    def map_study_to_therapy_data(self, study: dict) -> dict:
        """Transform a ClinicalTrials.gov study into our Therapy field dict."""
        ps = study.get("protocolSection", {})
        id_module = ps.get("identificationModule", {})
        status_module = ps.get("statusModule", {})
        design_module = ps.get("designModule", {})
        sponsor_module = ps.get("sponsorCollaboratorsModule", {})
        cond_module = ps.get("conditionsModule", {})
        desc_module = ps.get("descriptionModule", {})
        arms_module = ps.get("armsInterventionsModule", {})

        nct_id = id_module.get("nctId", "")
        title = id_module.get("briefTitle") or id_module.get("officialTitle", "Unknown")
        sponsor = sponsor_module.get("leadSponsor", {}).get("name")
        conditions = cond_module.get("conditions", [])
        phases = design_module.get("phases", [])
        phase = PHASE_MAP.get(phases[0] if phases else "", ClinicalPhase.PHASE_1)
        overall_status = status_module.get("overallStatus", "UNKNOWN")
        trial_status = STATUS_MAP.get(overall_status, TrialStatus.UNKNOWN)
        primary_completion = status_module.get("primaryCompletionDateStruct", {}).get("date")
        study_completion = status_module.get("completionDateStruct", {}).get("date")

        interventions = arms_module.get("interventions", [])
        intervention_names = [i.get("name", "") for i in interventions]

        therapy_type = self._infer_therapy_type(study)
        disease_category = self._infer_disease_category(conditions)

        return {
            "name": title,
            "manufacturer": sponsor,
            "therapy_type": therapy_type,
            "disease_category": disease_category,
            "disease_indications": conditions[:10],
            "clinical_phase": phase,
            "trial_status": trial_status,
            "nct_ids": [nct_id] if nct_id else [],
            "primary_nct_id": nct_id,
            "fda_approval_status": FDAApprovalStatus.NOT_SUBMITTED,
            "description": desc_module.get("briefSummary"),
            "source_urls": {
                "clinicaltrials": f"https://clinicaltrials.gov/study/{nct_id}"
            } if nct_id else {},
            "pediatric_indication": False,
            "rare_disease": True,
        }

    def map_study_to_preview(self, study: dict) -> dict:
        data = self.map_study_to_therapy_data(study)
        ps = study.get("protocolSection", {})
        id_module = ps.get("identificationModule", {})
        return {
            "nct_id": id_module.get("nctId"),
            "title": data["name"],
            "sponsor": data["manufacturer"],
            "conditions": data["disease_indications"],
            "therapy_type": data["therapy_type"].value if hasattr(data["therapy_type"], "value") else data["therapy_type"],
            "phase": data["clinical_phase"].value if hasattr(data["clinical_phase"], "value") else data["clinical_phase"],
            "status": data["trial_status"].value if hasattr(data["trial_status"], "value") else data["trial_status"],
        }

    async def upsert_study(
        self,
        study: dict,
        db,
        ai_service,
        created_by: Optional[uuid.UUID] = None,
    ) -> Therapy:
        """Create or update a Therapy record from a CT.gov study dict."""
        from sqlalchemy import select, and_
        from sqlalchemy.ext.asyncio import AsyncSession

        therapy_data = self.map_study_to_therapy_data(study)
        nct_id = therapy_data.get("primary_nct_id")

        # Check if already exists
        result = await db.execute(
            select(Therapy).where(Therapy.primary_nct_id == nct_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update changed fields
            changed = {}
            for field, new_val in therapy_data.items():
                old_val = getattr(existing, field, None)
                if old_val != new_val:
                    changed[field] = {"old": old_val, "new": new_val}
                    setattr(existing, field, new_val)
            if changed:
                from sqlalchemy import func
                count_res = await db.execute(
                    select(func.count()).where(TherapyVersionHistory.therapy_id == existing.id)
                )
                next_v = (count_res.scalar_one() or 0) + 1
                db.add(TherapyVersionHistory(
                    therapy_id=existing.id,
                    version=next_v,
                    changed_fields=changed,
                    source="clinicaltrials",
                ))
            therapy = existing
        else:
            therapy = Therapy(**therapy_data, created_by=created_by, updated_by=created_by)
            db.add(therapy)
            await db.flush()

            # Generate AI summary for new record
            try:
                if therapy.description:
                    summary = await ai_service.summarize_therapy(therapy_data)
                    therapy.ai_summary = summary
            except Exception as e:
                logger.warning("AI summary generation failed", nct_id=nct_id, error=str(e))

        # Record raw data source
        db.add(DataSourceRecord(
            therapy_id=therapy.id,
            source_name="clinicaltrials",
            source_id=nct_id,
            source_url=f"https://clinicaltrials.gov/study/{nct_id}",
            raw_data=study,
            confidence_score=75,
        ))

        await db.commit()
        await db.refresh(therapy)
        return therapy

    async def run_full_sync(self, db, ai_service) -> int:
        """Run a full sync across all gene/cell therapy search terms."""
        total = 0
        seen_nct_ids: set[str] = set()

        for term in GENE_CELL_THERAPY_TERMS:
            try:
                studies = await self.search_studies(term, max_results=100)
                for study in studies:
                    ps = study.get("protocolSection", {})
                    nct_id = ps.get("identificationModule", {}).get("nctId")
                    if nct_id and nct_id not in seen_nct_ids:
                        seen_nct_ids.add(nct_id)
                        await self.upsert_study(study, db, ai_service)
                        total += 1
                await asyncio.sleep(0.5)  # Rate limiting
            except Exception as e:
                logger.error("Sync term failed", term=term, error=str(e))

        logger.info("ClinicalTrials full sync complete", total_upserted=total)
        return total
