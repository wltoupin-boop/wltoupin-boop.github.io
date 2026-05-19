# Product Requirements Document
## Cell & Gene Therapy Tracking Platform

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-05-19  
**Owner:** Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [User Personas](#3-user-personas)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 [Therapy Master Database](#41-therapy-master-database)
   - 4.2 [Data Ingestion Pipeline](#42-data-ingestion-pipeline)
   - 4.3 [User & Institution Management](#43-user--institution-management)
   - 4.4 [Watchlists](#44-watchlists)
   - 4.5 [Operational Readiness Tracking](#45-operational-readiness-tracking)
   - 4.6 [Visualizations & Dashboards](#46-visualizations--dashboards)
   - 4.7 [Notifications & Alerts](#47-notifications--alerts)
   - 4.8 [AI Features](#48-ai-features)
   - 4.9 [AI Governance](#49-ai-governance)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Integration Requirements](#6-integration-requirements)
7. [MVP Scope vs. Future Phases](#7-mvp-scope-vs-future-phases)
8. [Success Metrics](#8-success-metrics)
9. [Assumptions & Constraints](#9-assumptions--constraints)
10. [Open Questions](#10-open-questions)

---

## 1. Executive Summary

The Cell & Gene Therapy Tracking Platform is a web-based SaaS application designed to give hospital systems, academic medical centers, and specialty programs a unified, continuously updated view of the cell and gene therapy (CGT) landscape. It bridges the gap between raw regulatory and clinical data scattered across ClinicalTrials.gov, the FDA, PubMed, and industry news, and the strategic and operational decisions that hospital leadership, pharmacy directors, and clinical teams must make.

The platform ingests, normalizes, and enriches therapy data through automated pipelines and AI-assisted summarization, then surfaces actionable intelligence through role-specific dashboards, configurable watchlists, staged operational readiness tracking, and proactive notifications. An integrated AI governance layer ensures that AI-generated content is human-reviewable and auditable before it drives institutional decision-making.

The primary goal of the MVP is to reduce the manual research burden on clinical operations and pharmacy teams, accelerate institutional readiness planning by 30–50%, and provide C-suite executives with a reliable, real-time overview of the CGT pipeline most relevant to their patient population.

---

## 2. Problem Statement

Cell and gene therapies are advancing at an unprecedented pace. As of 2026, over 1,000 active CGT clinical trials are registered globally, with dozens approaching FDA approval or recently approved. For hospital systems and academic medical centers, monitoring this landscape is a full-time research function that most institutions cannot adequately staff.

**Key pain points:**

- **Information fragmentation:** Relevant data lives in ClinicalTrials.gov, the FDA's OpenFDA database, PubMed, manufacturer press releases, and industry news—none of which share a common data model.
- **Operational lag:** Institutions often begin readiness planning only after a therapy receives approval, losing months of preparation time that could have begun during Phase 3.
- **No institution-level context:** Public databases provide no way to annotate therapies with local patient estimates, internal owners, or readiness stages.
- **Executive visibility gaps:** C-suite leaders lack a consolidated, non-technical view of which therapies matter to their institution and what action is required.
- **AI trust deficit:** Teams that have experimented with AI summarization tools lack confidence that AI outputs are accurate without a structured review and correction workflow.

---

## 3. User Personas

### 3.1 Hospital Program Director

**Profile:** Physician or advanced practice provider leading a disease-specific program (e.g., hematology, neurology, rare disease). Often the clinical champion for evaluating and adopting new therapies.

**Goals:**
- Identify therapies relevant to their patient population early (Phase 2–3).
- Track trial status, key milestones, and FDA submission timelines.
- Communicate pipeline status to department chairs and C-suite.
- Understand which therapies their institution should prepare for.

**Pain Points:**
- Spends hours per week manually reviewing FDA, ClinicalTrials.gov, and PubMed.
- No structured way to record readiness status for individual therapies.
- Loses institutional knowledge when staff turn over.

**Key Features Used:** Therapy search and filtering, watchlists, therapy detail pages, milestone tracking, AI plain-language summaries.

---

### 3.2 Clinical Operations Team

**Profile:** Coordinators, project managers, and operations analysts responsible for executing the operational work required to stand up new therapy programs. Typically non-clinical but deeply familiar with hospital operations.

**Goals:**
- Manage task lists and milestones for each therapy under evaluation.
- Track assigned owners across clinical, pharmacy, and financial workstreams.
- Document barriers and escalate blockers to leadership.
- Coordinate with manufacturers and understand REMS/certification requirements.

**Pain Points:**
- Uses spreadsheets or generic project management tools with no CGT-specific context.
- No single system of record for readiness status across therapies.
- Difficulty surfacing upcoming due dates and overdue actions across a portfolio of therapies.

**Key Features Used:** Operational readiness tracker, task management, document storage, notifications/reminders, operational dashboard.

---

### 3.3 Pharmacy Director

**Profile:** Clinical pharmacist or pharmacy administrator responsible for evaluating drug acquisition, REMS certification, cold chain logistics, specialty pharmacy contracting, and drug administration protocols.

**Goals:**
- Understand distribution model and specialty pharmacy requirements for each therapy.
- Track REMS certification status and required training.
- Estimate drug costs and negotiate with manufacturers.
- Ensure storage and handling infrastructure is in place before a therapy is offered.

**Pain Points:**
- REMS certification requirements and distribution restrictions are scattered across FDA documents.
- No structured way to track pharmacy-specific readiness tasks tied to a specific therapy.
- Cold chain and administration requirements often discovered late in the planning cycle.

**Key Features Used:** Therapy detail pages (regulatory and label sections), operational readiness tracker (pharmacy workstream), AI operational summaries, document storage for pharmacy protocols.

---

### 3.4 C-Suite Executive (CEO, CMO, CFO, CSO)

**Profile:** Senior hospital leadership making portfolio-level strategic decisions about which CGT programs to invest in, what infrastructure to build, and how to position the institution competitively.

**Goals:**
- Understand the CGT pipeline relevant to their patient population at a high level.
- See overall institutional readiness posture across all therapies under consideration.
- Identify therapies requiring immediate strategic attention or capital investment.
- Benchmark the institution's CGT program maturity.

**Pain Points:**
- No consolidated executive view of the CGT landscape tied to institutional context.
- Reports from clinical teams are inconsistent in format and frequency.
- Difficult to assess financial exposure or opportunity from the CGT pipeline.

**Key Features Used:** Executive dashboard, portfolio-level visualizations, summary reports, key milestone alerts, institution-level readiness heatmap.

---

## 4. Functional Requirements

### 4.1 Therapy Master Database

The therapy master database is the central data asset of the platform. It stores structured, normalized records for every tracked CGT.

#### 4.1.1 Therapy Record Structure

Each therapy record must capture:

| Category | Fields |
|---|---|
| **Identity** | Product name, generic name, brand name (post-approval), manufacturer, sponsor |
| **Classification** | Therapy type, vector/platform, disease indication, disease category, ICD codes |
| **Population** | Pediatric relevance, rare disease flag, orphan drug designation |
| **Regulatory Designations** | Breakthrough Therapy, RMAT, Fast Track, Priority Review |
| **Clinical Status** | Clinical phase, trial identifiers (NCT numbers), trial status |
| **Timeline** | Primary completion date, study completion date, expected readout dates, PDUFA date, advisory committee date, key milestones |
| **Approval Status** | FDA approval status (enum), approval date, approval type (full/accelerated), label limitations, required confirmatory studies, post-marketing commitments |
| **Regulatory Documents** | Links to FDA documents (BLA, prescribing information, REMS, FDA review memos) |
| **News & Intelligence** | Recent news items with source, date, and relevance score |
| **Epidemiology** | Global prevalence, national prevalence, pediatric prevalence, addressable population (all with source and date) |
| **AI Content** | Plain-language summary, operational summary, summary generation timestamp |
| **Data Quality** | Source confidence score, data sources list, last updated, needs human review flag |

#### 4.1.2 Therapy Search & Filtering

- Full-text search across product name, generic name, indication, manufacturer.
- Filter by: therapy type, clinical phase, FDA approval status, disease category, pediatric relevance, rare disease, regulatory designations (RMAT, Breakthrough, etc.).
- Sort by: name, approval date, PDUFA date, last updated, confidence score.
- Saved search configurations per user.

#### 4.1.3 Therapy Detail Page

- Tabbed layout: Overview, Clinical, Regulatory, Epidemiology, News, Operational (institution-specific).
- Timeline visualization of key milestones.
- Expandable source citations for all data fields.
- Inline display of AI summaries with generation date and governance status.
- Change history log showing what changed and when.
- Quick-add to personal watchlist or institution priority list.

#### 4.1.4 Data Quality Indicators

- Visual confidence score badge (0–100) on each therapy record.
- "Needs Human Review" flag surfaced prominently in the UI.
- Per-field source citation with link to originating document.
- Last-verified timestamps distinct from last-updated timestamps.

---

### 4.2 Data Ingestion Pipeline

The ingestion pipeline is responsible for discovering, fetching, normalizing, and loading therapy data from external sources on a scheduled and on-demand basis.

#### 4.2.1 Data Sources

| Source | Data Fetched | Update Frequency |
|---|---|---|
| ClinicalTrials.gov API | Trial status, phase, arms, sites, completion dates, sponsor | Daily |
| FDA OpenFDA API | Approval status, label data, REMS, adverse events, post-marketing commitments | Daily |
| PubMed API | Key publications, trial results, systematic reviews | Weekly |
| Web Search (SerpAPI or equivalent) | News articles, press releases, analyst reports | Daily |
| Manual Entry | Any field can be manually entered or overridden by authorized users | On-demand |

#### 4.2.2 Pipeline Stages

Each ingestion run executes the following stages:

1. **Fetch:** Retrieve raw data from external APIs with retry logic and exponential backoff.
2. **Parse & Normalize:** Extract structured fields from raw API responses using field-specific parsers.
3. **Entity Resolution:** Match incoming records to existing therapy records by NCT number, product name, and sponsor.
4. **Conflict Detection:** Compare incoming values to stored values; flag fields where source data conflicts with existing records.
5. **AI Enrichment:** Submit normalized data to Claude API for plain-language and operational summaries, confidence scoring, and flag suggestions.
6. **Human Review Flagging:** Mark records meeting defined criteria for human review before publication.
7. **Load:** Write validated records to the database, creating version history entries for changed fields.
8. **Notification Dispatch:** Queue notifications for users watching therapies that have changed.

#### 4.2.3 Pipeline Configuration

- Configurable ingestion schedules per source.
- Ability to trigger on-demand ingestion for specific therapies by authorized users.
- Configurable confidence thresholds that trigger automatic human review flags.
- Pipeline run logs with per-record success/failure tracking stored in `ingestion_jobs`.

#### 4.2.4 Conflict Resolution Rules

- Newer source data takes precedence over older data for time-stamped fields (e.g., trial status, approval status).
- Manual entries by authorized users override AI-extracted or API-sourced values.
- When multiple authoritative sources conflict, the field is flagged for human review rather than automatically resolved.

---

### 4.3 User & Institution Management

#### 4.3.1 Authentication

- Authentication is handled exclusively via Firebase Authentication.
- Supported sign-in methods (MVP): Email/password, Google OAuth.
- All backend API calls require a valid Firebase JWT in the `Authorization: Bearer <token>` header.
- Backend validates tokens using Firebase Admin SDK on every request.
- Session tokens expire after 1 hour; clients must refresh silently.

#### 4.3.2 Authorization & Role Model

| Role | Description |
|---|---|
| `admin` | Platform-level superuser. Can manage all institutions, all users, and all therapy records. Can approve/reject AI review flags globally. |
| `institution_admin` | Manages users within their institution. Can configure institution-level settings, priorities, and operational readiness records. Can approve/reject AI review flags for their institution's data. |
| `user` | Standard authenticated user. Can view all public therapy data, manage personal watchlists, and view/edit operational readiness records for their institution (subject to ownership assignment). |

#### 4.3.3 Institution Management

- Each user belongs to exactly one institution.
- Institution records store: name, type (hospital/academic/health_system/specialty_program), location, contact info, and configurable settings (e.g., default notification preferences, enabled modules).
- Institution admins can invite users via email; invited users receive a registration link.
- Institution admins can deactivate users within their institution.
- Platform admins can create, modify, and deactivate institutions.

#### 4.3.4 User Profile & Preferences

- Users can update their display name, notification preferences, and default dashboard view.
- Preferences stored as JSONB to allow flexible, schema-free configuration expansion.
- Users can configure per-therapy notification thresholds within their watchlist.

---

### 4.4 Watchlists

#### 4.4.1 Personal Watchlists

- Each user can watch any number of therapies.
- For each watched therapy, the user can set:
  - Custom priority (1–5 stars).
  - Personal notes (free text, not visible to other users).
  - Per-therapy notification settings (override global preferences).
- Watchlist view shows a filterable, sortable list of watched therapies with their current status and most recent change.
- Users can export their watchlist to CSV.

#### 4.4.2 Institution Priority Lists

- Institution admins and assigned users can designate therapies as institutional priorities.
- Institution priority records capture:
  - Priority level (1–5).
  - Strategic notes visible to all institution users.
  - Local patient population estimate.
  - Whether the institution is or plans to be a trial site and/or treatment site.
- Institution priority list is visible to all users within the institution.
- Therapies on the institution priority list are highlighted in search results for institution users.

---

### 4.5 Operational Readiness Tracking

The operational readiness module provides a structured workflow for institutions to plan and track the work required to offer a cell or gene therapy to patients.

#### 4.5.1 Readiness Stages

Each therapy can be assigned to one of 23 defined readiness stages for a given institution:

| Stage Key | Stage Label |
|---|---|
| `not_reviewed` | Not Yet Reviewed |
| `initial_awareness` | Initial Awareness |
| `feasibility_assessment` | Feasibility Assessment |
| `leadership_review` | Leadership Review |
| `strategic_decision_made` | Strategic Decision Made |
| `manufacturer_outreach` | Manufacturer Outreach Initiated |
| `site_qualification` | Site Qualification in Progress |
| `contract_negotiation` | Contract Negotiation |
| `rems_enrollment` | REMS Enrollment |
| `staff_training_planning` | Staff Training Planning |
| `staff_training_active` | Staff Training Active |
| `staff_training_complete` | Staff Training Complete |
| `pharmacy_preparation` | Pharmacy Preparation |
| `pharmacy_certified` | Pharmacy Certified |
| `clinical_protocol_development` | Clinical Protocol Development |
| `irb_submission` | IRB/Ethics Submission |
| `irb_approved` | IRB/Ethics Approved |
| `payer_strategy` | Payer Strategy Development |
| `payer_contracts` | Payer Contracting |
| `first_patient_planning` | First Patient Planning |
| `operational_rehearsal` | Operational Rehearsal |
| `first_patient_treated` | First Patient Treated |
| `active_program` | Active Program |

#### 4.5.2 Ownership Assignment

Each operational readiness record supports four owner fields:
- **Clinical Owner:** Physician champion or clinical program director.
- **Operational Owner:** Operations coordinator or project manager.
- **Pharmacy Owner:** Pharmacist or pharmacy director.
- **Financial Owner:** Finance or contracting lead.

Owners receive automatic notifications when tasks assigned to them approach due dates.

#### 4.5.3 Task Management

- Each operational readiness record can have multiple tasks.
- Tasks have: title, description, assigned user, due date, completion timestamp.
- Task list is displayed in the operational readiness detail view sorted by due date.
- Overdue tasks are visually highlighted.
- Users can mark tasks complete with a single click.

#### 4.5.4 Document Storage

- Each operational readiness record can have associated documents.
- Documents are uploaded to Cloud Storage; metadata is stored in `operational_documents`.
- Document types: Contract, Protocol, Training Certificate, REMS Certificate, Meeting Notes, Other.
- Uploaded by user and timestamp are tracked for audit purposes.

#### 4.5.5 Barriers & Notes

- Free-text barriers field for documenting known obstacles.
- Free-text notes field for general operational context.
- Both fields are indexed for full-text search within the institution context.

---

### 4.6 Visualizations & Dashboards

#### 4.6.1 Personal Dashboard

- Summary cards: therapies watched, institution priorities, upcoming milestones (next 90 days), unread notifications.
- Recent activity feed showing changes to watched therapies.
- Quick-access links to recently viewed therapies.

#### 4.6.2 Institution Dashboard

- Portfolio heatmap: therapies on institution priority list plotted by readiness stage and priority level.
- Pipeline funnel: count of therapies at each readiness stage.
- Upcoming milestones calendar: PDUFA dates, trial completion dates, advisory committee dates for institution priorities.
- Overdue tasks summary across all operational readiness records.
- Owner workload summary: task counts and overdue items by assigned owner.

#### 4.6.3 Therapy Pipeline Visualizations

- Global pipeline chart: all tracked therapies by phase and disease category (D3.js bubble or scatter chart).
- Approval timeline: waterfall chart of expected and actual approval dates.
- Disease category distribution: donut or treemap chart.
- Filtering on all pipeline charts mirrors the search/filter functionality.

#### 4.6.4 Executive Summary View

- Read-only view designed for C-suite consumption.
- High-level KPIs: therapies in Phase 3, therapies with PDUFA dates in next 12 months, institution readiness by stage count.
- Therapies requiring immediate executive attention (flagged by institution admin).
- Exportable as PDF or shareable via secure link.

---

### 4.7 Notifications & Alerts

#### 4.7.1 Notification Triggers

The following events generate notifications:

| Trigger | Recipients |
|---|---|
| Therapy phase change | Users watching the therapy |
| FDA approval status change | Users watching the therapy; institution admin if on priority list |
| PDUFA date added or changed | Users watching the therapy |
| New milestone date within 90 days | Users watching the therapy |
| Therapy added to institution priority list | All institution users |
| Operational readiness stage changed | Assigned owners; institution admin |
| Task due date approaching (3 days) | Assigned user |
| Task overdue | Assigned user; operational owner |
| AI review flag requires human review | Institution admin (for institution data); platform admin (for therapy master data) |
| Data ingestion failure | Platform admin |

#### 4.7.2 Notification Delivery

- In-app notification center (bell icon with unread count).
- Email notifications (configurable per notification type in user preferences).
- Notifications stored in `notifications` table with read/unread state.
- Users can mark all as read or dismiss individual notifications.

#### 4.7.3 Notification Preferences

- Users configure notification preferences at account level.
- Per-watchlist-entry overrides allow users to mute or escalate notifications for specific therapies.
- Institution admins can configure institution-level defaults.

---

### 4.8 AI Features

#### 4.8.1 Plain-Language Therapy Summaries

- For each therapy, the AI generates a 3–5 paragraph plain-language summary covering:
  - What the therapy is, how it works, and what disease it treats.
  - Current clinical stage and most important recent trial results.
  - Regulatory status, designations, and path to approval.
  - Key uncertainties, risks, or open questions.
- Summaries are generated at ingestion time and regenerated when source data changes significantly.
- Summary generation timestamp and source data version are stored for auditability.

#### 4.8.2 Operational Readiness Summaries

- For approved or late-phase therapies, the AI generates an operationally focused summary covering:
  - Administration requirements (infusion center, inpatient bed, ICU backup).
  - REMS or certification requirements.
  - Specialty pharmacy and distribution model.
  - Typical patient journey and monitoring requirements.
  - Known manufacturer support programs for site setup.
- Operational summaries are clearly distinguished from plain-language summaries in the UI.

#### 4.8.3 Confidence Scoring

- For each therapy record, the AI assesses source coverage and consistency and assigns a confidence score (0–100).
- Score is decomposed into per-category sub-scores where possible (clinical data confidence, regulatory data confidence, epidemiology confidence).
- Low confidence scores trigger human review flags.

#### 4.8.4 AI-Assisted Watchlist Recommendations

- Based on a user's existing watchlist and institution priorities, the AI proactively recommends therapies the user may not be tracking.
- Recommendations surface in a "Suggested for You" section on the personal dashboard.
- Users can dismiss recommendations.

#### 4.8.5 Natural Language Query

- Users can ask natural language questions about therapies in a chat interface.
- The AI answers based on structured therapy data from the database, with citations.
- Responses are scoped to therapies in the platform's database—the AI does not perform live web search within the chat interface.
- All queries and responses are logged for audit and quality improvement.

---

### 4.9 AI Governance

#### 4.9.1 Human Review Workflow

- All AI-generated content is subject to a human review workflow before it is displayed as "verified."
- AI content that has not yet been reviewed is displayed with a visible "AI-generated, pending review" badge.
- Platform admins and institution admins can review, approve, reject, or correct AI-generated values for any field.
- Corrections are stored in `ai_review_flags` with the human-reviewed value and reviewer identity.

#### 4.9.2 Review Queue

- A dedicated review queue UI surfaces all pending AI review flags.
- Reviewers can filter the queue by therapy, field type, and flag age.
- Batch approve/reject is supported for low-risk field types.
- Review actions are logged in both `ai_review_flags` and `audit_logs`.

#### 4.9.3 AI Content Provenance

- Every AI-generated field is tagged with:
  - Model version used.
  - Prompt version used.
  - Source data snapshot hash.
  - Generation timestamp.
- This metadata is available in the therapy detail page for admin users.

#### 4.9.4 Feedback Loop

- Reviewers can leave notes on corrections.
- Aggregated correction patterns are surfaced in a platform admin analytics view to identify systematic AI errors.
- Correction data can be used to refine prompts in future pipeline runs.

---

## 5. Non-Functional Requirements

### 5.1 Security

- All data in transit encrypted via TLS 1.2+.
- All data at rest encrypted using Google-managed encryption keys (Cloud SQL and Cloud Storage default encryption).
- Firebase JWT validation on every API request; no unauthenticated endpoints except health checks.
- Role-based access control enforced at the application layer; row-level security policies defined in the database as a defense-in-depth measure.
- Secrets (API keys, database credentials) stored in Google Secret Manager; never in source code or environment variable files.
- All user actions against sensitive resources logged in `audit_logs` with IP address and timestamp.
- Regular dependency vulnerability scanning in CI/CD pipeline.
- Penetration testing required before GA launch.

### 5.2 Privacy & HIPAA-Conscious Design

- The platform tracks therapies, not patients. No Protected Health Information (PHI) is collected, stored, or processed in the MVP.
- Local patient population estimates entered by institution users are aggregate counts, not individual patient records.
- If future phases introduce patient-level data, a formal HIPAA Business Associate Agreement (BAA) process and PHI data classification policy must be implemented before any patient data is stored.
- User email addresses and names are treated as PII; access is restricted by role.
- Data retention policy: user data is retained for the duration of the subscription plus 90 days post-termination; therapy master data is retained indefinitely.
- Users can request deletion of their personal data (watchlist notes, preferences) consistent with applicable privacy law.

### 5.3 Performance

| Metric | Target |
|---|---|
| Therapy list page load (p95) | < 1.5 seconds |
| Therapy detail page load (p95) | < 2.0 seconds |
| Dashboard load (p95) | < 2.5 seconds |
| Search results returned (p95) | < 1.0 second |
| API response time, non-AI endpoints (p95) | < 500 ms |
| AI summary generation (async, background) | < 60 seconds |
| Data ingestion job completion | < 4 hours for full pipeline run |

### 5.4 Scalability

- Cloud Run services auto-scale horizontally based on request load.
- Database connection pooling via PgBouncer or Cloud SQL Auth Proxy pooling mode to prevent connection exhaustion.
- Redis cache for frequently accessed therapy records, search results, and dashboard aggregates.
- Background jobs offloaded to Cloud Tasks to prevent API latency spikes.
- Architecture supports sharding or read replicas if single PostgreSQL instance cannot sustain read load at scale.

### 5.5 Availability & Reliability

- Target SLA: 99.5% monthly uptime during MVP.
- Graceful degradation: if the AI service is unavailable, therapy pages display last-generated summaries with a stale data warning.
- If an external API (ClinicalTrials.gov, FDA) is unavailable, the ingestion pipeline logs the failure and retries on next scheduled run without affecting the user-facing application.
- Database automated daily backups with point-in-time recovery retained for 30 days.

### 5.6 Accessibility

- All UI components must meet WCAG 2.1 Level AA standards.
- Color is not the sole means of conveying information (confidence scores, status indicators include text labels).
- Keyboard navigation supported throughout.
- Screen reader compatibility tested with NVDA and VoiceOver.

---

## 6. Integration Requirements

### 6.1 ClinicalTrials.gov API

- **Endpoint:** `https://clinicaltrials.gov/api/v2/studies`
- **Authentication:** None (public API); rate limiting must be respected.
- **Data Fetched:** Study protocol, status, phase, sponsors, eligibility criteria, primary outcome measures, completion dates, sites.
- **Entity Matching:** Match by NCT number (primary), then product name + sponsor.
- **Update Frequency:** Daily differential update; weekly full refresh.
- **Error Handling:** Exponential backoff on 429/503; log failures to `ingestion_jobs`.

### 6.2 FDA OpenFDA API

- **Endpoint:** `https://api.fda.gov/drug/`
- **Authentication:** API key (stored in Secret Manager).
- **Data Fetched:** Approval status, NDA/BLA number, labeling data, REMS information, drug shortage status.
- **Entity Matching:** Match by BLA/NDA number, then active ingredient, then product name.
- **Update Frequency:** Daily differential; weekly full label refresh.
- **Error Handling:** Exponential backoff; store raw API responses in `data_source_records` for debugging.

### 6.3 PubMed API (NCBI E-utilities)

- **Endpoint:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
- **Authentication:** API key (stored in Secret Manager).
- **Data Fetched:** Publications associated with therapy by product name and NCT number; abstract, authors, journal, publication date, DOI.
- **Update Frequency:** Weekly.
- **Error Handling:** Respect NCBI rate limits (3 req/sec without key, 10 req/sec with key).

### 6.4 Web Search (SerpAPI or Equivalent)

- **Purpose:** Discover recent news articles, press releases, and analyst reports not captured by structured APIs.
- **Queries Executed:** Product name + "clinical trial," product name + "FDA," product name + "approval," manufacturer name + therapy disease area.
- **Data Fetched:** Article title, source, URL, snippet, publication date.
- **Entity Attribution:** AI classifies retrieved articles as relevant to a therapy with a relevance confidence score.
- **Update Frequency:** Daily for therapies in Phase 3 or later; weekly for earlier phases.
- **Cost Control:** Results are cached in Redis for 24 hours; duplicate URLs are deduplicated before storage.

### 6.5 Firebase Authentication

- **SDK:** Firebase Admin SDK (Python) on backend for token verification.
- **Client SDK:** Firebase JS SDK v10 on React frontend.
- **Token Validation:** Every API request validated server-side; no trust of client-side role claims.
- **User Sync:** On first verified login, the backend creates or updates the `users` record synchronized from the Firebase user profile.

### 6.6 Anthropic Claude API

- **Model:** Claude Sonnet (current production version) with optional escalation to Opus for complex summarization tasks.
- **Use Cases:** Plain-language summaries, operational summaries, confidence scoring, watchlist recommendations, natural language query responses.
- **Request Pattern:** All Claude API calls are made from backend services; the frontend never calls the Claude API directly.
- **Rate Limiting:** Requests queued through Cloud Tasks to respect API rate limits.
- **Cost Control:** Caching of AI outputs keyed by source data hash; avoid regeneration when source data has not changed.

---

## 7. MVP Scope vs. Future Phases

### 7.1 MVP (Phase 1)

**Included in MVP:**
- Therapy master database with full data model.
- Automated ingestion from ClinicalTrials.gov and FDA OpenFDA APIs.
- Manual therapy entry and override for all fields.
- User authentication and role management (admin, institution_admin, user).
- Institution management (single institution per deployment initially).
- Personal watchlists with priority and notes.
- Institution priority lists.
- Operational readiness tracking with 23 stages, task management, and document storage.
- Personal and institution dashboards.
- Therapy pipeline visualization (bubble chart and timeline).
- In-app notifications.
- AI plain-language summaries with human review workflow.
- AI confidence scoring with human review flags.
- Basic audit logging.

**Explicitly Out of MVP:**
- PubMed ingestion (Phase 2).
- Web search ingestion (Phase 2).
- Email notifications (Phase 2).
- AI operational readiness summaries (Phase 2).
- AI watchlist recommendations (Phase 2).
- Natural language query (Phase 2).
- Executive PDF report export (Phase 2).
- Multi-institution comparative views (Phase 3).
- Patient-level data or EHR integration (Phase 4).
- Mobile application (Phase 3).
- Payer coverage tracking (Phase 3).

### 7.2 Phase 2 (3–6 months post-MVP)

- PubMed and web search ingestion pipelines.
- Email notification delivery.
- AI operational summaries (pharmacy/admin focused).
- AI watchlist recommendations.
- Natural language query interface.
- Executive summary export (PDF, shareable link).
- Enhanced visualizations (payer landscape, cost comparisons).
- Improved conflict resolution UI for data quality.

### 7.3 Phase 3 (6–12 months post-MVP)

- Multi-institution comparative dashboards (opt-in, anonymized benchmarking).
- Payer coverage and reimbursement tracking module.
- Mobile-responsive PWA with push notifications.
- Advanced analytics (cohort modeling, readiness benchmark scoring).
- Institution-to-institution secure messaging for shared programs.

### 7.4 Phase 4 (12+ months)

- EHR integration for actual patient identification (requires BAA, PHI handling).
- Outcomes tracking for treated patients (aggregate, anonymized).
- Manufacturer portal for direct data submission.
- Regulatory submission tracking integration (FDA ANDA/BLA dockets).

---

## 8. Success Metrics

### 8.1 Adoption Metrics

| Metric | MVP Target (6 months post-launch) |
|---|---|
| Institutions onboarded | 5 |
| Active users (logged in past 30 days) | 50 |
| Therapies tracked in database | 200 |
| Watchlist entries created | 500 |
| Operational readiness records created | 100 |

### 8.2 Engagement Metrics

| Metric | Target |
|---|---|
| Average session duration | > 8 minutes |
| Therapy detail page views per session | > 3 |
| Notification click-through rate | > 40% |
| AI summary "helpful" rating | > 75% |

### 8.3 Quality Metrics

| Metric | Target |
|---|---|
| Data ingestion success rate | > 95% |
| AI review flag resolution time (median) | < 48 hours |
| AI content correction rate (post-review) | < 20% |
| Source confidence score (average) | > 70 |

### 8.4 Operational Impact Metrics (User-reported, 6-month survey)

- 70% of users report spending less time on manual CGT research than before the platform.
- 50% of institutions report beginning readiness planning earlier in the therapy development cycle.
- 80% of institution admins report improved visibility into their CGT pipeline for leadership reporting.

---

## 9. Assumptions & Constraints

- The platform does not store, process, or display PHI in the MVP; all patient counts are aggregate institutional estimates entered by users.
- ClinicalTrials.gov and FDA OpenFDA remain publicly accessible APIs with acceptable rate limits.
- Anthropic Claude API maintains availability and consistent output quality; the platform does not depend on real-time Claude responses in user-facing request paths (all AI calls are async).
- Google Cloud Platform services (Cloud Run, Cloud SQL, Cloud Memorystore, Cloud Tasks, Cloud Storage) are available in the chosen deployment region.
- The team has access to Firebase project credentials for authentication setup.
- All institution users access the platform via a modern web browser (Chrome, Firefox, Edge, Safari—current version and one major version back).

---

## 10. Open Questions

1. **Multi-tenancy model:** Should the platform be a single multi-tenant deployment shared across all institutions, or should each institution get an isolated deployment? MVP assumes multi-tenant with row-level isolation.
2. **Therapy scope:** Does the initial database focus exclusively on FDA-regulated CGTs, or does it include EMA and other jurisdictions from day one?
3. **Pricing model:** Subscription per institution? Per seat? Tiered by institution size? This affects how institution and user limits are enforced in the platform.
4. **REMS data structure:** REMS requirements vary significantly by therapy. Should REMS data be structured (typed fields per requirement) or unstructured (stored as document + AI-extracted summary)?
5. **Manufacturer data sharing:** Will any manufacturers provide direct data feeds or API access to trial data? This would improve data quality significantly for in-scope therapies.
6. **Advisory committee integration:** Should the platform track the full docket of ODAC and other advisory committee meetings, or only meetings relevant to tracked therapies?
