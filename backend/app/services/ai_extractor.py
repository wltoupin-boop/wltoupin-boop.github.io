"""
AI-assisted data extraction and summarization using the Anthropic Claude API.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import anthropic
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
settings = get_settings()

logger = structlog.get_logger(__name__)

THERAPY_EXTRACTION_TOOL = {
    "name": "extract_therapy_data",
    "description": "Extract structured therapy data from text",
    "input_schema": {
        "type": "object",
        "properties": {
            "product_name": {"type": "string"},
            "manufacturer": {"type": "string"},
            "therapy_type": {
                "type": "string",
                "enum": ["gene_therapy", "cell_therapy", "car_t", "gene_editing", "rna_therapy", "oncolytic_virus", "other"],
            },
            "disease_category": {
                "type": "string",
                "enum": ["oncology", "hematology", "neurology", "ophthalmology", "metabolic", "immunology", "cardiovascular", "rare_disease", "other"],
            },
            "disease_indication": {"type": "string"},
            "clinical_phase": {
                "type": "string",
                "enum": ["phase_1", "phase_1_2", "phase_2", "phase_2_3", "phase_3", "phase_4", "approved", "preclinical"],
            },
            "fda_status": {"type": "string"},
            "pdufa_date": {"type": "string", "description": "ISO date string YYYY-MM-DD if mentioned"},
            "nct_id": {"type": "string"},
            "pediatric": {"type": "boolean"},
            "rare_disease": {"type": "boolean"},
            "breakthrough_therapy": {"type": "boolean"},
            "fast_track": {"type": "boolean"},
            "orphan_drug": {"type": "boolean"},
            "key_facts": {"type": "array", "items": {"type": "string"}},
            "confidence_score": {"type": "integer", "minimum": 0, "maximum": 100},
        },
        "required": ["product_name", "therapy_type", "disease_category"],
    },
}


class AIExtractorService:
    def __init__(self):
        self._client: Optional[anthropic.AsyncAnthropic] = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if not self._client:
            self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def extract_therapy_info(self, text: str, source_type: str = "general") -> dict[str, Any]:
        """Extract structured therapy data from arbitrary text."""
        client = self._get_client()
        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            tools=[THERAPY_EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "extract_therapy_data"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Extract structured data about cell or gene therapies from this {source_type} text. "
                        f"Only include fields you are confident about. Set confidence_score based on data quality (0-100).\n\n"
                        f"Text:\n{text[:4000]}"
                    ),
                }
            ],
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_therapy_data":
                return block.input
        return {}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def summarize_therapy(self, therapy_data: dict[str, Any]) -> str:
        """Generate a plain-language summary of a therapy for clinicians."""
        client = self._get_client()
        name = therapy_data.get("name", "This therapy")
        description = therapy_data.get("description", "")
        phase = therapy_data.get("clinical_phase", "")
        disease = therapy_data.get("disease_indications", [])
        manufacturer = therapy_data.get("manufacturer", "")

        prompt = (
            f"Write a concise 2-3 sentence plain-language summary of this cell/gene therapy for a hospital program director. "
            f"Focus on: what it is, what disease it treats, and its current development stage. "
            f"Be factual and neutral.\n\n"
            f"Name: {name}\n"
            f"Manufacturer: {manufacturer}\n"
            f"Disease/Indication: {', '.join(disease) if isinstance(disease, list) else disease}\n"
            f"Phase: {phase}\n"
            f"Description: {description[:1500]}"
        )

        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip() if response.content else ""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def generate_operational_summary(self, therapy_data: dict[str, Any]) -> str:
        """Generate an operational readiness summary for hospital administrators."""
        client = self._get_client()
        name = therapy_data.get("name", "This therapy")
        therapy_type = therapy_data.get("therapy_type", "")
        phase = therapy_data.get("clinical_phase", "")
        fda_status = therapy_data.get("fda_approval_status", "")

        prompt = (
            f"Write a brief 2-3 sentence operational readiness note for a hospital administrator "
            f"about this therapy. What key operational considerations should they be aware of "
            f"(e.g., site certification requirements, specialized handling, patient eligibility complexity)?\n\n"
            f"Therapy: {name}\n"
            f"Type: {therapy_type}\n"
            f"Phase: {phase}\n"
            f"FDA Status: {fda_status}"
        )

        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip() if response.content else ""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    async def estimate_next_milestone(self, therapy_data: dict[str, Any]) -> dict[str, Any]:
        """Estimate the most likely next regulatory or clinical milestone."""
        client = self._get_client()

        prompt = (
            f"Based on this therapy's current status, what is the most likely next milestone? "
            f"Respond as JSON with keys: milestone_type, estimated_date (ISO string or null), "
            f"confidence (low/medium/high), rationale (one sentence).\n\n"
            f"Therapy data: {json.dumps(therapy_data, default=str)[:2000]}"
        )

        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip() if response.content else "{}"
        try:
            # Extract JSON from response
            start = text.find("{")
            end = text.rfind("}") + 1
            return json.loads(text[start:end]) if start >= 0 else {}
        except json.JSONDecodeError:
            return {"rationale": text}

    async def assess_source_confidence(self, source_records: list[dict]) -> int:
        """Return a 0-100 confidence score based on number/quality of sources."""
        if not source_records:
            return 0
        score = 0
        source_weights = {
            "clinicaltrials": 40,
            "openfda": 35,
            "pubmed": 15,
            "manual": 10,
        }
        seen_sources: set[str] = set()
        for rec in source_records:
            source_name = rec.get("source_name", "")
            if source_name not in seen_sources:
                score += source_weights.get(source_name, 5)
                seen_sources.add(source_name)
        return min(score, 100)

    async def detect_status_change(
        self, old_data: dict[str, Any], new_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Detect significant status changes between two therapy snapshots."""
        significant_fields = [
            "fda_approval_status",
            "clinical_phase",
            "trial_status",
            "pdufa_date",
            "approval_date",
        ]
        changes = {}
        for field in significant_fields:
            old_val = old_data.get(field)
            new_val = new_data.get(field)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
        return changes
