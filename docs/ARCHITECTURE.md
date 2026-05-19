# Technical Architecture
## Cell & Gene Therapy Tracking Platform

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-05-19  
**Owner:** Engineering Team

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Breakdown](#3-component-breakdown)
   - 3.1 [Frontend (React SPA)](#31-frontend-react-spa)
   - 3.2 [Backend API (FastAPI)](#32-backend-api-fastapi)
   - 3.3 [Data Pipeline Worker](#33-data-pipeline-worker)
   - 3.4 [PostgreSQL Database](#34-postgresql-database)
   - 3.5 [Redis Cache (Cloud Memorystore)](#35-redis-cache-cloud-memorystore)
   - 3.6 [Cloud Tasks Queue](#36-cloud-tasks-queue)
   - 3.7 [Cloud Storage](#37-cloud-storage)
   - 3.8 [Firebase Authentication](#38-firebase-authentication)
4. [Data Flow Descriptions](#4-data-flow-descriptions)
   - 4.1 [User Authentication Flow](#41-user-authentication-flow)
   - 4.2 [Therapy Data Read Flow](#42-therapy-data-read-flow)
   - 4.3 [Data Ingestion Flow](#43-data-ingestion-flow)
   - 4.4 [AI Enrichment Flow](#44-ai-enrichment-flow)
   - 4.5 [Notification Flow](#45-notification-flow)
5. [Security Model](#5-security-model)
6. [API Design Principles](#6-api-design-principles)
7. [Caching Strategy](#7-caching-strategy)
8. [Background Job Architecture](#8-background-job-architecture)
9. [AI Integration Architecture](#9-ai-integration-architecture)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Backup & Recovery Strategy](#11-backup--recovery-strategy)
12. [Infrastructure as Code](#12-infrastructure-as-code)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Cost-Conscious Design](#14-cost-conscious-design)
15. [Scalability Path](#15-scalability-path)
16. [Dependency Map](#16-dependency-map)

---

## 1. System Overview

The platform is a cloud-native, containerized web application hosted entirely on Google Cloud Platform. It follows a three-tier architecture: a React single-page application served via Cloud Run, a FastAPI backend API running on Cloud Run, and a PostgreSQL database on Cloud SQL. A separate Cloud Run service handles background data ingestion and AI enrichment workloads, decoupled from the request-serving API.

External integrations (ClinicalTrials.gov, FDA OpenFDA, PubMed, SerpAPI, Anthropic Claude) are accessed exclusively from the backend; the browser never calls external APIs directly. Firebase Authentication provides identity services without requiring a custom auth server.

The architecture prioritizes operational simplicity for the MVP while establishing clean separation of concerns that enables independent scaling and evolution of each subsystem.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                 │
│                    React 18 SPA (Vite + TypeScript)                     │
│              TanStack Query  │  React Router v6  │  D3.js               │
└────────────────────────┬────────────────────────────────────────────────┘
                         │  HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD PLATFORM                                 │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Cloud Run Services                             │  │
│  │                                                                   │  │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────┐  │  │
│  │  │  frontend        │   │  backend-api     │   │  pipeline-    │  │
│  │  │  (nginx + SPA)   │   │  (FastAPI 3.11)  │   │  worker       │  │
│  │  │                 │   │                 │   │  (FastAPI     │  │  │
│  │  │  Serves static  │   │  REST API       │   │  3.11)        │  │  │
│  │  │  assets only    │   │  /api/v1/...    │   │               │  │  │
│  │  │                 │   │                 │   │  Triggered by │  │  │
│  │  │  Port: 8080     │   │  Port: 8080     │   │  Cloud Tasks  │  │  │
│  │  └────────┬────────┘   └────────┬────────┘   └───────┬───────┘  │  │
│  │           │                     │                     │           │  │
│  └───────────┼─────────────────────┼─────────────────────┼───────────┘  │
│              │                     │                     │              │
│              │            ┌────────▼──────────────────── ▼──────┐      │
│              │            │       Internal VPC Network          │      │
│              │            │                                     │      │
│              │            │  ┌──────────────┐  ┌────────────┐  │      │
│              │            │  │  Cloud SQL   │  │   Cloud    │  │      │
│              │            │  │  PostgreSQL  │  │ Memorystore│  │      │
│              │            │  │  (Primary +  │  │   Redis    │  │      │
│              │            │  │   Replica)   │  │            │  │      │
│              │            │  └──────────────┘  └────────────┘  │      │
│              │            │                                     │      │
│              │            │  ┌──────────────┐  ┌────────────┐  │      │
│              │            │  │ Cloud Tasks  │  │   Secret   │  │      │
│              │            │  │   Queue      │  │  Manager   │  │      │
│              │            │  └──────────────┘  └────────────┘  │      │
│              │            │                                     │      │
│              │            │  ┌──────────────┐                   │      │
│              │            │  │    Cloud     │                   │      │
│              │            │  │   Storage    │                   │      │
│              │            │  │  (Buckets)   │                   │      │
│              │            │  └──────────────┘                   │      │
│              │            └─────────────────────────────────────┘      │
│              │                                                           │
│  ┌───────────▼───────────────────────────────────────────────────────┐  │
│  │          Cloud Logging  │  Cloud Monitoring  │  Cloud Build       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│    Firebase      │   │   External APIs       │   │  Anthropic Claude   │
│  Authentication  │   │                       │   │        API           │
│                  │   │ - ClinicalTrials.gov  │   │                      │
│  Identity tokens │   │ - FDA OpenFDA         │   │  - Summaries         │
│  Google OAuth    │   │ - PubMed (NCBI)       │   │  - Confidence scores │
│  Email/password  │   │ - SerpAPI (web search)│   │  - NL query          │
└──────────────────┘   └──────────────────────┘   └──────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Frontend (React SPA)

**Cloud Run Service Name:** `frontend`  
**Container:** nginx serving Vite build output  
**Port:** 8080

The frontend is a static single-page application built with React 18 and TypeScript, compiled by Vite into optimized static assets. It is served by an nginx container deployed on Cloud Run. All routing is handled client-side by React Router v6.

**Key Libraries:**

| Library | Purpose |
|---|---|
| React 18 | UI rendering with concurrent mode and Suspense |
| TypeScript 5.x | Type safety across all components and API calls |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling; purged in production builds |
| React Router v6 | Client-side routing with data loaders |
| TanStack Query v5 | Server state management, caching, and background refetch |
| D3.js | Custom data visualizations (pipeline charts, timelines) |
| Firebase JS SDK v10 | Client-side Firebase Authentication |
| Axios | HTTP client for backend API calls |

**Design Patterns:**

- Feature-based directory structure (`/features/therapies/`, `/features/watchlists/`, etc.).
- TanStack Query hooks encapsulate all API calls; components do not call `fetch` directly.
- React Context used sparingly; only for authentication state and global UI state.
- All sensitive environment variables are build-time only and do not include secrets (only Firebase public config and the backend API base URL).

**nginx Configuration:**

- All non-asset requests fall through to `index.html` to support client-side routing.
- Static assets served with long-lived `Cache-Control: max-age=31536000, immutable` headers (Vite content-hashes filenames).
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` restricting script sources.

---

### 3.2 Backend API (FastAPI)

**Cloud Run Service Name:** `backend-api`  
**Container:** Python 3.11 (slim) + uvicorn + gunicorn  
**Port:** 8080  
**Min Instances:** 1 (to prevent cold start on first request)  
**Max Instances:** 20 (MVP)

The backend API is a FastAPI application exposing a versioned REST API. It handles all business logic, database access, cache reads/writes, Cloud Tasks dispatch, and Firebase token validation.

**Directory Structure:**

```
backend/
├── app/
│   ├── main.py                  # FastAPI app factory, middleware, router registration
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Aggregate router for v1
│   │       ├── therapies.py     # Therapy CRUD and search endpoints
│   │       ├── users.py         # User profile management
│   │       ├── institutions.py  # Institution management
│   │       ├── watchlists.py    # Personal watchlist endpoints
│   │       ├── priorities.py    # Institution priority list endpoints
│   │       ├── readiness.py     # Operational readiness endpoints
│   │       ├── tasks.py         # Operational task endpoints
│   │       ├── notifications.py # Notification management endpoints
│   │       ├── ai.py            # AI query and recommendation endpoints
│   │       └── admin.py         # Platform admin endpoints
│   ├── core/
│   │   ├── config.py            # Settings from environment (pydantic-settings)
│   │   ├── security.py          # Firebase token validation, RBAC decorators
│   │   ├── database.py          # SQLAlchemy engine, session factory
│   │   ├── cache.py             # Redis client and cache decorators
│   │   └── exceptions.py        # Custom exception classes and handlers
│   ├── models/
│   │   └── *.py                 # SQLAlchemy ORM models (one file per table group)
│   ├── schemas/
│   │   └── *.py                 # Pydantic request/response schemas
│   ├── services/
│   │   ├── therapy_service.py   # Therapy business logic
│   │   ├── notification_service.py
│   │   ├── ai_service.py        # Claude API integration
│   │   └── storage_service.py   # Cloud Storage operations
│   └── workers/
│       └── tasks.py             # Cloud Tasks handler endpoints
├── alembic/                     # Database migration scripts
├── Dockerfile
├── requirements.txt
└── pyproject.toml
```

**Key Libraries:**

| Library | Purpose |
|---|---|
| FastAPI | Async web framework with automatic OpenAPI docs |
| SQLAlchemy 2.x | ORM with async engine support |
| Alembic | Database migration management |
| Pydantic v2 | Request/response validation and settings management |
| firebase-admin | Firebase JWT verification |
| anthropic | Anthropic Claude API client |
| redis[asyncio] | Async Redis client |
| google-cloud-tasks | Cloud Tasks API client |
| google-cloud-storage | Cloud Storage client |
| google-cloud-secret-manager | Secret Manager client |
| httpx | Async HTTP client for external API calls |
| structlog | Structured JSON logging |

**Middleware Stack (applied in order):**

1. CORS middleware (restrict to known frontend origins).
2. Request ID injection (UUID per request, added to all log lines).
3. Structured request logging (method, path, status, duration).
4. Firebase JWT validation (all routes except `/health` and `/api/v1/auth/*`).
5. Rate limiting (per user, per endpoint; limits stored in Redis).

---

### 3.3 Data Pipeline Worker

**Cloud Run Service Name:** `pipeline-worker`  
**Container:** Python 3.11 (slim) + uvicorn  
**Port:** 8080  
**Min Instances:** 0 (scales to zero when idle)  
**Max Instances:** 5 (MVP)

The pipeline worker is a separate Cloud Run service that handles all asynchronous, long-running background jobs. It exposes HTTP endpoints that are called by Cloud Tasks. It shares the same codebase as the backend API but runs as a separate service to isolate resource usage and allow independent scaling.

**Endpoints exposed by pipeline-worker:**

| Endpoint | Triggered By | Description |
|---|---|---|
| `POST /tasks/ingest/clinicaltrials` | Cloud Scheduler → Cloud Tasks | Fetch and process ClinicalTrials.gov data |
| `POST /tasks/ingest/fda` | Cloud Scheduler → Cloud Tasks | Fetch and process FDA OpenFDA data |
| `POST /tasks/ingest/pubmed` | Cloud Scheduler → Cloud Tasks | Fetch and process PubMed publications |
| `POST /tasks/ingest/news` | Cloud Scheduler → Cloud Tasks | Fetch and process web search results |
| `POST /tasks/ingest/therapy/{id}` | On-demand via backend-api | Re-ingest a single therapy |
| `POST /tasks/ai/generate-summary` | Cloud Tasks | Generate AI summary for a therapy |
| `POST /tasks/ai/score-confidence` | Cloud Tasks | Score confidence for a therapy record |
| `POST /tasks/notifications/dispatch` | Cloud Tasks | Send pending notifications |

All pipeline-worker endpoints validate a shared secret header (`X-CloudTasks-QueueName` and a custom `X-Internal-Secret`) to prevent unauthorized invocation. The service is not publicly accessible via Cloud Run's URL; Cloud Tasks calls it over the internal network.

---

### 3.4 PostgreSQL Database

**Service:** Cloud SQL for PostgreSQL 15  
**Tier (MVP):** `db-g1-small` (1 vCPU, 1.7 GB RAM)  
**Storage:** 50 GB SSD with auto-growth enabled  
**High Availability:** Regional (primary + standby replica in same region)  
**Connection Method:** Cloud SQL Auth Proxy (sidecar in Cloud Run) with IAM database authentication

**Connection Pooling:**

The Cloud SQL Auth Proxy runs as a sidecar container in both the `backend-api` and `pipeline-worker` Cloud Run services. SQLAlchemy's connection pool is configured as follows:

```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=5,          # Persistent connections per instance
    max_overflow=10,       # Burst connections (pool_size + max_overflow = 15 max)
    pool_timeout=30,       # Wait up to 30s for a connection
    pool_recycle=1800,     # Recycle connections after 30 minutes
    pool_pre_ping=True,    # Verify connection health before use
)
```

With Cloud Run's default 80 concurrent request limit per instance and up to 20 instances, peak connection demand is managed by keeping `pool_size` conservative. If connection limits become a bottleneck at scale, PgBouncer is introduced as a connection pooler between the Auth Proxy and PostgreSQL.

**Database Users:**

| User | Permissions | Used By |
|---|---|---|
| `app_user` | SELECT, INSERT, UPDATE, DELETE on app schema | backend-api, pipeline-worker |
| `migration_user` | DDL permissions (CREATE, ALTER, DROP) | Alembic migrations in CI/CD |
| `readonly_user` | SELECT on app schema | Monitoring queries, read replicas |

---

### 3.5 Redis Cache (Cloud Memorystore)

**Service:** Cloud Memorystore for Redis 7.x  
**Tier (MVP):** Basic, 1 GB  
**Access:** Private IP within VPC (no public endpoint)

Redis is used for four purposes:

1. **Application-level caching** of expensive or frequently requested data (see Section 7).
2. **Rate limiting** counters keyed by user ID and endpoint.
3. **Session/nonce storage** for any transient state (e.g., OAuth state parameters).
4. **Deduplication** of ingestion records (e.g., "have we processed this NCT number today?").

All cache keys are namespaced by prefix: `cgt:therapy:`, `cgt:user:`, `cgt:rate:`, `cgt:ingest:`.

---

### 3.6 Cloud Tasks Queue

**Service:** Google Cloud Tasks  
**Queues (MVP):**

| Queue Name | Purpose | Rate Limit | Max Retries |
|---|---|---|---|
| `ingestion-daily` | Scheduled data source ingestion | 10 tasks/sec | 3 |
| `ai-enrichment` | AI summary and scoring jobs | 5 tasks/sec | 3 |
| `notification-dispatch` | User notification sending | 20 tasks/sec | 5 |
| `on-demand-ingest` | User-triggered single-therapy ingestion | 2 tasks/sec | 2 |

Tasks are enqueued by the `backend-api` service and delivered to the `pipeline-worker` service via HTTPS. Tasks include a JSON payload with the job parameters and a HMAC signature for request authenticity verification.

---

### 3.7 Cloud Storage

**Service:** Google Cloud Storage  
**Buckets:**

| Bucket | Contents | Retention | Access |
|---|---|---|---|
| `cgt-documents-{env}` | User-uploaded operational documents | Indefinite | Authenticated via signed URLs (1-hour expiry) |
| `cgt-exports-{env}` | Generated report exports (PDF, CSV) | 7 days | Authenticated via signed URLs |
| `cgt-pipeline-raw-{env}` | Raw API responses from ingestion runs | 90 days | Internal service account only |
| `cgt-backups-{env}` | Database dump backups (secondary) | 30 days | Internal service account only |

All buckets have versioning enabled, uniform bucket-level access control (no per-object ACLs), and are located in the same region as Cloud Run services.

---

### 3.8 Firebase Authentication

Firebase Authentication is used as the identity provider. It is not hosted on GCP directly but is configured as a Firebase project linked to the GCP project.

**Frontend Flow:**
1. User signs in via Firebase JS SDK (email/password or Google OAuth).
2. Firebase returns a signed JWT (ID token) valid for 1 hour.
3. The React app stores the token in memory (not localStorage) and attaches it to every API request as `Authorization: Bearer <token>`.
4. TanStack Query's `queryClient` is configured with an `onError` handler that triggers token refresh on 401 responses.

**Backend Flow:**
1. Every request arrives at the FastAPI security middleware.
2. The Firebase Admin SDK's `auth.verify_id_token()` verifies the JWT signature, expiry, and audience.
3. The decoded claims (Firebase UID, email) are used to look up the user record in PostgreSQL.
4. The user's role and institution ID are loaded from the database (never from the JWT) and attached to the request context.

---

## 4. Data Flow Descriptions

### 4.1 User Authentication Flow

```
Browser                   Firebase               backend-api           PostgreSQL
   │                          │                      │                     │
   │──── signInWithEmail ─────▶│                      │                     │
   │◀─── ID Token (JWT) ───────│                      │                     │
   │                          │                      │                     │
   │──── GET /api/v1/me ──────────────────────────────▶│                     │
   │     Authorization: Bearer <JWT>                  │                     │
   │                          │                      │                     │
   │                          │   verify_id_token()  │                     │
   │                          │◀─────────────────────│                     │
   │                          │──── decoded claims ──▶│                     │
   │                          │                      │──── SELECT users ──▶│
   │                          │                      │◀─── user row ───────│
   │                          │                      │                     │
   │                          │   (if new user)      │──── INSERT users ──▶│
   │                          │                      │                     │
   │◀──── 200 UserProfile ────────────────────────────│                     │
```

### 4.2 Therapy Data Read Flow

```
Browser            backend-api           Redis               PostgreSQL
   │                    │                  │                      │
   │── GET /therapies ──▶│                  │                      │
   │                    │── GET cgt:therapy:list:hash ──▶│         │
   │                    │◀── MISS ─────────────────────-──│         │
   │                    │                  │              │         │
   │                    │────────────────────────────────── SELECT ▶│
   │                    │◀─────────────────────────────── rows ─────│
   │                    │                  │                         │
   │                    │── SET cgt:therapy:list:hash TTL 300 ──▶│  │
   │                    │                  │                         │
   │◀── 200 TherapyList──│                  │                         │
   │                    │                  │                         │
   │ (subsequent req)   │                  │                         │
   │── GET /therapies ──▶│                  │                         │
   │                    │── GET cgt:therapy:list:hash ──▶│           │
   │                    │◀── HIT (serialized JSON) ──────│           │
   │◀── 200 TherapyList──│                  │                         │
```

### 4.3 Data Ingestion Flow

```
Cloud Scheduler       Cloud Tasks          pipeline-worker        External API
      │                    │                     │                      │
      │──── trigger ───────▶│                     │                      │
      │                    │──── HTTPS POST ─────▶│                      │
      │                    │    /tasks/ingest/    │                      │
      │                    │    clinicaltrials    │                      │
      │                    │                     │──── GET /studies ────▶│
      │                    │                     │◀─── raw JSON ─────────│
      │                    │                     │                      │
      │                    │              ┌──────▼──────────────────┐
      │                    │              │  Parse & Normalize       │
      │                    │              │  Entity Resolution       │
      │                    │              │  Conflict Detection      │
      │                    │              └──────┬──────────────────┘
      │                    │                     │
      │                    │              ┌──────▼──────────────────┐
      │                    │              │  Write to PostgreSQL     │
      │                    │              │  - therapy records       │
      │                    │              │  - data_source_records   │
      │                    │              │  - version_history       │
      │                    │              │  - ingestion_jobs        │
      │                    │              └──────┬──────────────────┘
      │                    │                     │
      │                    │◀──── Enqueue AI tasks (Cloud Tasks)
      │                    │◀──── Enqueue notification tasks
```

### 4.4 AI Enrichment Flow

```
pipeline-worker          Cloud Tasks         pipeline-worker        Anthropic API
      │                      │                     │                      │
      │── Enqueue AI task ───▶│                     │                      │
      │                      │──── HTTPS POST ─────▶│                      │
      │                      │    /tasks/ai/        │                      │
      │                      │    generate-summary  │                      │
      │                      │                     │                      │
      │                      │              ┌──────▼──────────────────┐
      │                      │              │  Load therapy from DB    │
      │                      │              │  Check Redis cache (hash)│
      │                      │              │  Skip if unchanged       │
      │                      │              └──────┬──────────────────┘
      │                      │                     │──── messages.create ▶│
      │                      │                     │◀─── summary text ─────│
      │                      │                     │                      │
      │                      │              ┌──────▼──────────────────┐
      │                      │              │  Store in ai_review_flags│
      │                      │              │  Update therapy record   │
      │                      │              │  (pending review status) │
      │                      │              └─────────────────────────┘
```

### 4.5 Notification Flow

```
backend-api / pipeline-worker    Cloud Tasks        pipeline-worker      PostgreSQL
           │                          │                    │                  │
           │── Event occurs ──────────│                    │                  │
           │   (status change, etc.)  │                    │                  │
           │── Enqueue notification ──▶│                    │                  │
           │                          │──── POST ──────────▶│                  │
           │                          │  /tasks/            │                  │
           │                          │  notifications/     │──── SELECT ─────▶│
           │                          │  dispatch           │   watchers       │
           │                          │                     │◀─── user rows ───│
           │                          │                     │                  │
           │                          │                     │──── INSERT ─────▶│
           │                          │                     │  notifications   │
           │                          │                     │  (one per user)  │
           │                          │              (Phase 2: send email)     │
```

---

## 5. Security Model

### 5.1 Authentication & Authorization Layers

The platform implements defense-in-depth with three distinct authorization layers:

**Layer 1 — Firebase JWT Verification**

All requests to the `backend-api` (except `/health`) must carry a valid Firebase ID token. The Firebase Admin SDK validates:
- Token signature (against Firebase's public keys).
- Token expiry (`exp` claim).
- Token audience (`aud` claim must match the Firebase project ID).
- Token issuer (`iss` claim).

An invalid or expired token returns HTTP 401. The user's Firebase UID from the decoded token is used to look up the internal user record.

**Layer 2 — Application-Level RBAC**

After authentication, FastAPI dependency injection applies role checks on each endpoint:

```python
# Example: Only institution_admin or admin can update institution settings
@router.put("/institutions/{institution_id}")
async def update_institution(
    institution_id: UUID,
    current_user: User = Depends(require_role(["admin", "institution_admin"])),
    ...
):
```

RBAC checks also enforce that `institution_admin` users can only modify records belonging to their own institution. Cross-institution data access is blocked at the application layer.

**Layer 3 — Database Row-Level Security (RLS)**

PostgreSQL RLS policies are defined as a final backstop. Even if the application layer has a bug, the database will refuse to return rows that the connecting user is not authorized to see. RLS is enabled on tables containing institution-specific data (`operational_readiness`, `institution_therapy_priorities`, `operational_tasks`, `operational_documents`).

RLS policies pass the current user's institution ID via a session-level parameter set at connection time:

```sql
-- Set at the start of each database session
SET LOCAL app.current_institution_id = '<institution_uuid>';
SET LOCAL app.current_user_role = 'institution_admin';

-- RLS policy example
CREATE POLICY institution_isolation ON operational_readiness
    USING (institution_id = current_setting('app.current_institution_id')::uuid
           OR current_setting('app.current_user_role') = 'admin');
```

### 5.2 Network Security

- All Cloud Run services are deployed with HTTPS-only ingress.
- `pipeline-worker` is configured with `--ingress=internal-and-cloud-load-balancing`; it does not accept public traffic.
- Cloud SQL and Cloud Memorystore are accessible only via private IP within the VPC; no public IP is assigned.
- Cloud Run services access Cloud SQL via the Cloud SQL Auth Proxy, which handles IAM-based authentication and TLS.
- Outbound internet access from Cloud Run (for external API calls) is routed through Cloud NAT with a static IP, allowing external APIs to whitelist that IP.

### 5.3 Secrets Management

All sensitive configuration is loaded from Secret Manager at container startup (not from environment variables in the Dockerfile). The Cloud Run service account has IAM permission `roles/secretmanager.secretAccessor` scoped only to the secrets it needs.

Secrets include:
- Database connection string.
- Redis connection string.
- Anthropic API key.
- SerpAPI key.
- PubMed API key.
- Internal Cloud Tasks HMAC secret.
- Firebase service account JSON.

### 5.4 Audit Logging

All mutating actions on sensitive resources are written to the `audit_logs` table, including:
- User creation, modification, deactivation.
- Therapy record creation and modification (when done manually).
- AI review flag creation, approval, rejection, correction.
- Institution priority and operational readiness changes.
- Document upload and deletion.

Audit logs are also streamed to Cloud Logging for long-term retention and security alerting.

### 5.5 Data Encryption

| Data State | Encryption |
|---|---|
| In transit (browser ↔ Cloud Run) | TLS 1.2+ (managed by Google Cloud Load Balancer) |
| In transit (Cloud Run ↔ Cloud SQL) | TLS via Cloud SQL Auth Proxy |
| In transit (Cloud Run ↔ Redis) | TLS via Cloud Memorystore in-transit encryption |
| At rest (Cloud SQL) | AES-256 (Google-managed keys) |
| At rest (Cloud Storage) | AES-256 (Google-managed keys) |
| At rest (Cloud Memorystore) | Not encrypted at rest in Basic tier; upgrade to Standard for encryption |

---

## 6. API Design Principles

### 6.1 REST Conventions

- Base path: `/api/v1/`
- Resources named as plural nouns: `/therapies/`, `/users/`, `/institutions/`.
- HTTP verbs follow REST semantics: GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE (soft delete).
- Responses always return the updated resource after a mutating operation.
- Errors return a consistent JSON structure: `{"error": {"code": "...", "message": "...", "details": {...}}}`.

### 6.2 Versioning

- The API is versioned at the URL path level (`/api/v1/`).
- Breaking changes (field removal, type changes) require a new version (`/api/v2/`).
- Non-breaking additions (new optional fields, new endpoints) may be added to the existing version.
- Old versions are supported for a minimum of 6 months after a new version is released.

### 6.3 Pagination

- All list endpoints use cursor-based pagination for consistent performance on large datasets.
- Request parameters: `cursor` (opaque token from previous response), `limit` (default 20, max 100).
- Response envelope: `{"items": [...], "next_cursor": "...", "total_count": N}`.
- `total_count` is an estimate for large tables (using PostgreSQL statistics) to avoid expensive `COUNT(*)` queries.

### 6.4 Search & Filtering

- Therapy search uses PostgreSQL full-text search (`tsvector`/`tsquery`) with GIN indexes.
- Filter parameters are passed as query strings: `?phase=phase_3&disease_category=hematology`.
- Multi-value filters use repeated parameters: `?phase=phase_3&phase=phase_2`.
- Sort: `?sort_by=pdufa_date&sort_order=asc`.

### 6.5 OpenAPI Documentation

FastAPI generates OpenAPI 3.1 documentation automatically. It is available at:
- `/api/v1/docs` (Swagger UI, disabled in production).
- `/api/v1/openapi.json` (machine-readable schema, accessible to authenticated admin users only in production).

### 6.6 Rate Limiting

- Standard users: 100 requests/minute per user.
- Admin users: 500 requests/minute per user.
- AI query endpoint: 10 requests/minute per user (due to Anthropic API cost).
- Rate limit state stored in Redis; exceeded limits return HTTP 429 with a `Retry-After` header.

---

## 7. Caching Strategy

### 7.1 Cache Layers

**Layer 1 — TanStack Query (Browser)**
- All API responses are cached in-memory in the browser for the duration of the session.
- Default `staleTime`: 60 seconds (data is considered fresh for 60s before a background refetch is triggered).
- Default `gcTime`: 5 minutes (unused cache entries are garbage collected after 5 minutes).
- Per-resource overrides: therapy list refetches every 5 minutes; therapy detail refetches every 10 minutes; dashboard aggregates refetch every 2 minutes.

**Layer 2 — Redis (Server)**
- Server-side cache for database query results and computed aggregates.
- Cache keys are deterministic hashes of the query parameters.

| Cache Key Pattern | TTL | Contents |
|---|---|---|
| `cgt:therapy:detail:{id}` | 10 minutes | Full therapy record (serialized Pydantic model) |
| `cgt:therapy:list:{hash}` | 5 minutes | Paginated therapy list for a specific filter/sort combo |
| `cgt:dashboard:institution:{id}` | 2 minutes | Institution dashboard aggregate data |
| `cgt:search:{hash}` | 3 minutes | Full-text search results |
| `cgt:user:{firebase_uid}` | 15 minutes | User profile and permissions |
| `cgt:ai:summary:{therapy_id}:{source_hash}` | 24 hours | AI-generated summary (keyed by source data hash) |

**Cache Invalidation:**
- Therapy records: invalidated on write to the `therapies` table (write-through invalidation from the service layer).
- Institution dashboard: invalidated when any `operational_readiness` or `institution_therapy_priorities` record for that institution changes.
- User cache: invalidated on user role or institution change.
- AI summaries: invalidated when the source data hash changes (triggering a re-generation job).

### 7.2 Cache-Aside Pattern

The standard pattern used throughout:

```python
async def get_therapy(therapy_id: UUID, cache: Redis, db: AsyncSession) -> TherapyDetail:
    cache_key = f"cgt:therapy:detail:{therapy_id}"
    cached = await cache.get(cache_key)
    if cached:
        return TherapyDetail.model_validate_json(cached)

    therapy = await db.get(Therapy, therapy_id)
    if not therapy:
        raise TherapyNotFoundError(therapy_id)

    result = TherapyDetail.model_validate(therapy)
    await cache.setex(cache_key, 600, result.model_dump_json())
    return result
```

---

## 8. Background Job Architecture

### 8.1 Job Dispatch Model

Background jobs are dispatched via Cloud Tasks rather than a traditional job queue. This eliminates the need to manage a message broker and leverages Cloud Tasks' built-in retry logic, rate limiting, and delivery guarantees.

**Enqueue Pattern (from backend-api):**

```python
async def enqueue_ai_summary(therapy_id: UUID, tasks_client: CloudTasksClient):
    task = {
        "http_request": {
            "http_method": "POST",
            "url": f"{PIPELINE_WORKER_URL}/tasks/ai/generate-summary",
            "headers": {
                "Content-Type": "application/json",
                "X-Internal-Secret": INTERNAL_SECRET,
            },
            "body": json.dumps({"therapy_id": str(therapy_id)}).encode(),
        }
    }
    tasks_client.create_task(parent=AI_QUEUE_PATH, task=task)
```

### 8.2 Scheduled Jobs (Cloud Scheduler)

| Job | Schedule (UTC) | Queue | Description |
|---|---|---|---|
| ClinicalTrials.gov ingestion | 02:00 daily | `ingestion-daily` | Full differential update |
| FDA OpenFDA ingestion | 03:00 daily | `ingestion-daily` | Full differential update |
| PubMed ingestion | 04:00 Sunday | `ingestion-daily` | Weekly refresh |
| Web search ingestion | 05:00 daily | `ingestion-daily` | Daily news fetch |
| Notification digest | 08:00 daily | `notification-dispatch` | Daily summary emails (Phase 2) |
| Database statistics refresh | 06:00 daily | — | `ANALYZE` on frequently queried tables |

### 8.3 Retry and Error Handling

- Cloud Tasks retries failed tasks with exponential backoff (min: 10s, max: 1 hour, max retries: configured per queue).
- After exhausting retries, the task is moved to a dead-letter queue and an alert is fired.
- Each task handler begins by checking `ingestion_jobs` for a duplicate in-progress record (idempotency check).
- All task handlers write their results (success, failure, records processed, errors) to `ingestion_jobs`.

---

## 9. AI Integration Architecture

### 9.1 Claude API Usage Patterns

All Claude API calls are made from the `pipeline-worker` service (never from user-facing request paths). This ensures:
- API latency does not affect user-facing response times.
- Claude API rate limits are managed centrally.
- Costs can be controlled by rate-limiting the `ai-enrichment` queue.

**Prompt Architecture:**

Each use case has a dedicated prompt template stored as versioned files in the codebase (not in the database). Prompt versions are tracked; changes to prompts trigger re-evaluation of the affected AI content.

```
backend/
└── prompts/
    ├── v1/
    │   ├── plain_language_summary.txt
    │   ├── operational_summary.txt
    │   ├── confidence_scoring.txt
    │   ├── watchlist_recommendations.txt
    │   └── natural_language_query.txt
    └── v2/   (future)
```

**Request Structure:**

```python
response = anthropic_client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=2048,
    system=load_prompt("plain_language_summary"),
    messages=[
        {
            "role": "user",
            "content": f"Generate a plain-language summary for this therapy:\n\n{therapy_data_json}"
        }
    ]
)
```

### 9.2 AI Output Governance Pipeline

```
AI generates content
        │
        ▼
Store in ai_review_flags (status: 'pending')
        │
        ▼
Display in UI with "AI-generated, pending review" badge
        │
        ▼
Reviewer approves / rejects / corrects
        │
   ┌────┴────┐
   │         │
approved   corrected / rejected
   │         │
   ▼         ▼
Update therapy   Store human_reviewed_value
record with      in ai_review_flags
AI value         Update therapy record with
                 human value
        │
        ▼
Log action in audit_logs
```

### 9.3 Cost Controls

- AI summaries are cached by source data hash; regeneration only occurs when source data changes.
- A maximum of 50 AI tasks are queued concurrently (Cloud Tasks queue rate limit).
- Prompt token counts are logged and monitored; alerts fire if average prompt size increases unexpectedly.
- Natural language query endpoint has a per-user rate limit of 10 requests/minute.
- Monthly Claude API spend is monitored via Cloud Billing alerts.

### 9.4 Natural Language Query Implementation

The NL query feature uses a retrieval-augmented generation (RAG) pattern:

1. User submits a natural language question.
2. Backend extracts entities (therapy names, disease areas) from the question using Claude.
3. Relevant therapy records are retrieved from PostgreSQL using full-text search and entity matching.
4. Retrieved records are serialized and included in the Claude prompt as context.
5. Claude generates a response with citations pointing to specific therapy records.
6. The response and citations are returned to the frontend; citations link to therapy detail pages.

The system prompt explicitly instructs Claude to answer only from the provided context and to indicate when it cannot find relevant information.

---

## 10. Monitoring & Observability

### 10.1 Logging

**Structured Logging:**

All application logs are written as structured JSON using `structlog`. Every log entry includes:
- `request_id`: UUID per HTTP request.
- `service`: Service name (`backend-api`, `pipeline-worker`, `frontend`).
- `level`: Log level.
- `message`: Human-readable message.
- `timestamp`: ISO 8601.
- Contextual fields: `user_id`, `therapy_id`, `endpoint`, `duration_ms`, etc.

Logs are written to stdout and automatically collected by Cloud Logging. Log-based metrics are defined in Cloud Monitoring for:
- HTTP 5xx error rate.
- Database query duration (p95, p99).
- Cache hit rate.
- AI API call failure rate.
- Ingestion job failure count.

### 10.2 Metrics & Alerting

**Key Metrics Tracked (Cloud Monitoring):**

| Metric | Alert Threshold |
|---|---|
| HTTP 5xx rate (backend-api) | > 1% over 5 minutes |
| API p95 latency | > 2 seconds over 5 minutes |
| Database connection utilization | > 80% |
| Cloud Run instance count (backend-api) | > 15 (approaching max) |
| Ingestion job failure rate | > 20% in any 24-hour period |
| AI review flags pending > 48h | > 10 flags |
| Redis memory utilization | > 80% |

Alert notifications are sent to the engineering team via email and PagerDuty (or equivalent) for P1 alerts.

### 10.3 Health Checks

**Endpoints:**
- `GET /health` — Backend liveness probe. Returns `{"status": "ok"}` with HTTP 200. No authentication required.
- `GET /health/ready` — Backend readiness probe. Checks database connectivity and Redis connectivity. Returns 200 only when all dependencies are healthy.

Cloud Run is configured with startup probes (30-second timeout) and liveness/readiness probes on these endpoints.

### 10.4 Distributed Tracing

Cloud Trace is enabled on Cloud Run services. The `X-Cloud-Trace-Context` header is propagated through all service-to-service calls. This allows correlation of a user's request through the `backend-api`, any downstream `pipeline-worker` tasks, and database query execution.

### 10.5 Error Tracking

Unhandled exceptions are captured by a FastAPI exception handler, logged as structured JSON with full stack traces, and forwarded to Cloud Error Reporting. Error grouping, first-seen/last-seen tracking, and resolution status are managed in the Cloud Error Reporting console.

---

## 11. Backup & Recovery Strategy

### 11.1 Database Backups

| Backup Type | Frequency | Retention | Storage |
|---|---|---|---|
| Cloud SQL automated backup | Daily (02:00 UTC) | 30 days | Cloud SQL managed |
| Cloud SQL PITR (point-in-time) | Continuous (transaction logs) | 7 days | Cloud SQL managed |
| pg_dump export (secondary) | Weekly (Sunday 01:00 UTC) | 4 weeks | `cgt-backups-{env}` Cloud Storage bucket |

**Recovery Time Objective (RTO):** 4 hours (time to restore from backup and verify integrity).  
**Recovery Point Objective (RPO):** 1 hour (maximum data loss in a worst-case scenario using PITR).

### 11.2 Recovery Procedures

- **Point-in-time recovery:** Use Cloud SQL's built-in PITR to restore to any point within the 7-day window.
- **Full backup restore:** Restore the most recent automated backup to a new Cloud SQL instance; update the connection string in Secret Manager; restart Cloud Run services.
- **Partial data recovery:** Use the secondary `pg_dump` to extract specific tables or records when targeted data recovery is needed without a full restore.

### 11.3 Other Data Recovery

- **Cloud Storage documents:** Versioning is enabled on all buckets; deleted or overwritten files can be recovered from version history.
- **Redis:** Redis data is ephemeral cache; loss is non-catastrophic. All cached data can be reconstructed from the database.
- **Cloud Run services:** Container images are stored in Artifact Registry; any previously deployed version can be re-deployed within minutes.

---

## 12. Infrastructure as Code

All GCP infrastructure is defined using Terraform and stored in the `infrastructure/` directory of the monorepo.

**Module Structure:**

```
infrastructure/
├── environments/
│   ├── dev/
│   │   └── main.tf            # Dev environment variables
│   └── prod/
│       └── main.tf            # Production environment variables
├── modules/
│   ├── cloud_run/             # Cloud Run service definitions
│   ├── cloud_sql/             # PostgreSQL instance and users
│   ├── memorystore/           # Redis instance
│   ├── cloud_tasks/           # Task queue definitions
│   ├── cloud_storage/         # Bucket definitions and IAM
│   ├── secret_manager/        # Secret definitions (not values)
│   ├── vpc/                   # VPC, subnets, Cloud NAT
│   ├── iam/                   # Service accounts and IAM bindings
│   └── monitoring/            # Alert policies and dashboards
└── backend.tf                 # Terraform state backend (Cloud Storage)
```

**Key Practices:**
- Terraform state is stored in a Cloud Storage bucket with versioning enabled.
- Separate state files per environment (dev, staging, prod).
- Infrastructure changes require plan review in CI/CD before apply.
- Service account credentials are never stored in Terraform state; IAM bindings are used instead.

---

## 13. CI/CD Pipeline

**CI/CD Platform:** Google Cloud Build

**Trigger Configuration:**

| Trigger | Branch | Action |
|---|---|---|
| Push to `main` | `main` | Run tests → Build images → Deploy to staging |
| Push to `prod` | `prod` | Run tests → Build images → Deploy to production |
| Pull request | Any | Run tests only (no build/deploy) |

**Pipeline Steps:**

```yaml
# cloudbuild.yaml (simplified)
steps:
  # 1. Run backend tests
  - name: 'python:3.11'
    entrypoint: 'bash'
    args: ['-c', 'pip install -r requirements.txt && pytest --cov']

  # 2. Run frontend tests and build
  - name: 'node:20'
    entrypoint: 'bash'
    args: ['-c', 'npm ci && npm test && npm run build']

  # 3. Security scan (dependency vulnerabilities)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['gcloud', 'artifacts', 'packages', 'scan', ...]

  # 4. Build Docker images
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '$_IMAGE_TAG', './backend']

  # 5. Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '$_IMAGE_TAG']

  # 6. Run database migrations
  - name: '$_BACKEND_IMAGE'
    entrypoint: 'alembic'
    args: ['upgrade', 'head']

  # 7. Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['gcloud', 'run', 'deploy', 'backend-api', '--image', '$_IMAGE_TAG', ...]
```

**Deployment Strategy:**
- Cloud Run performs zero-downtime deployments by routing traffic gradually from the old revision to the new revision.
- If health checks fail on the new revision, traffic is automatically rolled back to the previous revision.
- Database migrations run before the new Cloud Run revision receives traffic; migrations must be backward compatible (no breaking schema changes without a multi-step migration).

---

## 14. Cost-Conscious Design

### 14.1 MVP Cost Optimization

| Resource | MVP Configuration | Cost Approach |
|---|---|---|
| Cloud Run (backend-api) | Min instances: 1, Max: 20 | Min=1 prevents cold starts; max=20 caps burst cost |
| Cloud Run (pipeline-worker) | Min instances: 0, Max: 5 | Scales to zero when idle; only active during ingestion |
| Cloud Run (frontend) | Min instances: 0, Max: 10 | Static files; cold start is acceptable |
| Cloud SQL | `db-g1-small` (shared CPU) | Start small; upgrade to dedicated when needed |
| Cloud Memorystore | 1 GB Basic tier | Basic is sufficient for MVP cache volume |
| Cloud Storage | Standard storage class | Transition old pipeline-raw files to Nearline after 30 days |
| Anthropic API | Claude Sonnet (not Opus) | Use Sonnet for summaries; Opus only for complex NL queries |
| External APIs | Caching in Redis | Cache ClinicalTrials.gov/FDA responses for 24h to reduce API calls |

### 14.2 Cost Monitoring

- Cloud Billing budgets with alerts at 50%, 80%, and 100% of monthly budget.
- Per-service cost breakdown tracked with labels (`service=backend-api`, `env=prod`).
- Anthropic API costs tracked separately via usage metrics in the AI service.

---

## 15. Scalability Path

The MVP architecture is designed for a small number of institutions (5–20) and a moderate therapy database (200–500 therapies). The following scaling decisions are deferred until warranted by usage:

| Trigger | Scaling Action |
|---|---|
| API p95 latency > 1s under normal load | Increase Cloud Run min instances; profile hot queries |
| Database CPU > 60% sustained | Upgrade to `db-n1-standard-2`; add read replica for read-heavy queries |
| Redis memory > 80% | Increase Memorystore instance size |
| > 100 concurrent users | Enable Cloud Run CPU boost; review connection pool sizing |
| > 1,000 therapies | Evaluate full-text search performance; consider Elasticsearch if needed |
| > 50 institutions | Evaluate database partitioning for institution-scoped tables |
| > 500 institutions | Evaluate multi-region deployment; dedicated database per tier |

---

## 16. Dependency Map

```
frontend
  └── backend-api
        ├── Cloud SQL (PostgreSQL)
        ├── Cloud Memorystore (Redis)
        ├── Cloud Storage
        ├── Firebase Admin SDK
        │     └── Firebase Authentication (Google-managed)
        ├── Cloud Tasks (enqueues jobs)
        │     └── pipeline-worker
        │           ├── Cloud SQL (PostgreSQL)
        │           ├── Cloud Memorystore (Redis)
        │           ├── Anthropic Claude API (external)
        │           ├── ClinicalTrials.gov API (external)
        │           ├── FDA OpenFDA API (external)
        │           ├── PubMed API (external)
        │           └── SerpAPI (external)
        └── Secret Manager
```

All external dependencies are accessed via the `pipeline-worker` only. The `backend-api` does not make outbound calls to external APIs (except Firebase and Secret Manager at startup). This design isolates external API failures from user-facing request paths.
