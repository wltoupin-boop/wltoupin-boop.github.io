"""
FDA and openFDA API integration service.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Optional

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)

OPENFDA_BASE = "https://api.fda.gov"
GENE_CELL_KEYWORDS = [
    "gene therapy", "cell therapy", "CAR-T", "chimeric antigen receptor",
    "lentiviral", "adeno-associated", "AAV", "ex vivo", "in vivo gene",
    "stem cell", "hematopoietic", "CRISPR", "oncolytic",
]


class FDAService:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if not self._client or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=OPENFDA_BASE,
                timeout=30.0,
                headers={"Accept": "application/json"},
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def search_drug_applications(
        self, query: str, limit: int = 25
    ) -> list[dict[str, Any]]:
        """Search openFDA drug applications endpoint."""
        client = await self._get_client()
        params = {
            "search": query,
            "limit": limit,
        }
        response = await client.get("/drug/drugsfda.json", params=params)
        if response.status_code == 404:
            return []
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def get_drug_label(self, application_number: str) -> Optional[dict[str, Any]]:
        """Retrieve FDA drug label by application number."""
        client = await self._get_client()
        query = f'openfda.application_number:"{application_number}"'
        response = await client.get(
            "/drug/label.json", params={"search": query, "limit": 1}
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        return results[0] if results else None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def search_recent_approvals(
        self, days_back: int = 90
    ) -> list[dict[str, Any]]:
        """Get BLA approvals from the last N days, filtered for gene/cell therapy."""
        client = await self._get_client()
        from_date = (
            datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        )
        from_date = from_date.replace(day=from_date.day - days_back)
        date_str = from_date.strftime("%Y%m%d")

        # BLA = Biologics License Application (gene/cell therapies are BLAs)
        query = f'submissions.submission_type:"BLA" AND submissions.submission_status_date:[{date_str} TO *]'
        params = {"search": query, "limit": 100}
        response = await client.get("/drug/drugsfda.json", params=params)
        if response.status_code == 404:
            return []
        response.raise_for_status()
        data = response.json()

        results = data.get("results", [])
        # Filter for gene/cell therapy keywords
        filtered = []
        for result in results:
            brand_name = result.get("brand_name", "")
            generic_name = result.get("generic_name", "")
            combined = f"{brand_name} {generic_name}".lower()
            if any(kw.lower() in combined for kw in GENE_CELL_KEYWORDS):
                filtered.append(result)

        logger.info(
            "FDA recent approvals",
            total=len(results),
            gene_cell_filtered=len(filtered),
        )
        return filtered

    def extract_therapy_data(self, fda_record: dict[str, Any]) -> dict[str, Any]:
        """Transform an openFDA drug application record into our therapy field dict."""
        openfda = fda_record.get("openfda", {})
        submissions = fda_record.get("submissions", [])

        # Find most recent approval submission
        approval_sub = None
        for sub in sorted(
            submissions,
            key=lambda s: s.get("submission_status_date", ""),
            reverse=True,
        ):
            if sub.get("submission_type") in ("ORIG-1", "BLA"):
                approval_sub = sub
                break

        brand_name = (openfda.get("brand_name") or [""])[0]
        generic_name = (openfda.get("generic_name") or [""])[0]
        manufacturer = (openfda.get("manufacturer_name") or [""])[0]
        application_number = fda_record.get("application_number", "")

        approval_date_str = (
            approval_sub.get("submission_status_date") if approval_sub else None
        )
        approval_date: Optional[date] = None
        if approval_date_str:
            try:
                approval_date = datetime.strptime(approval_date_str, "%Y%m%d").date()
            except ValueError:
                pass

        return {
            "name": brand_name or generic_name or "Unknown",
            "brand_name": brand_name or None,
            "generic_name": generic_name or None,
            "manufacturer": manufacturer or None,
            "bla_number": application_number or None,
            "approval_date": approval_date,
            "fda_approval_status": "approved" if approval_date else "bla_submitted",
            "source_urls": {
                "openfda": f"https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo={re.sub(r'[^0-9]', '', application_number)}"
            } if application_number else {},
        }

    def parse_pdufa_date(self, text: str) -> Optional[date]:
        """Extract a PDUFA date from text (e.g., press releases)."""
        patterns = [
            r"PDUFA\s+(?:date|action\s+date)\s+(?:of|is|:)?\s*(\w+\s+\d{1,2},?\s+\d{4})",
            r"action\s+date\s+(?:of|is|:)?\s*(\w+\s+\d{1,2},?\s+\d{4})",
            r"FDA\s+is\s+expected\s+to\s+(?:act|decide)\s+(?:on|by)\s+(\w+\s+\d{1,2},?\s+\d{4})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return datetime.strptime(match.group(1).strip(), "%B %d, %Y").date()
                except ValueError:
                    try:
                        return datetime.strptime(match.group(1).strip(), "%B %d %Y").date()
                    except ValueError:
                        pass
        return None
