# Cell & Gene Therapy Tracking Platform

A production-grade platform for tracking cell and gene therapy clinical programs -- aggregating data from ClinicalTrials.gov, the FDA, and other sources into a single searchable interface with AI-generated summaries, milestone alerts, and portfolio analytics.

---

## Architecture Overview

```
                          +--------------------------------------+
                          |          Google Cloud Platform       |
                          |                                      |
  Users ---- HTTPS ------►|  Cloud Run (Frontend)                |
                          |  nginx serving React/Vite SPA        |
                          |           |                          |
                          |           | API calls                |
                          |           v                          |
                          |  Cloud Run (Backend)                 |
                          |  FastAPI + SQLAlchemy                |
                          |      |          |          |         |
                          |      v          v          v         |
                          |  Cloud SQL   Memorystore  GCS        |
                          |  Postgres 15  Redis 7    Documents   |
                          |                          Raw Ingest  |
                          |                                      |
                          |  Cloud Scheduler Jobs                |
                          |  +--------------------------------+  |
                          |  | 2:00 AM -> ClinicalTrials sync|  |
                          |  | 3:00 AM -> FDA approval sync  |  |
                          |  | Mon 6AM -> Milestone check    |  |
                          |  +--------------------------------+  |
                          |                                      |
                          |  Secret Manager  Artifact Registry   |
                          |  Cloud Build CI/CD                   |
                          +--------------------------------------+
```

**Authentication:** Firebase Auth (JWT validation in FastAPI middleware)
**AI Summaries:** Claude via Anthropic API (claude-3-5-haiku)
**Email Alerts:** SendGrid Dynamic Templates

---

## Quick Start -- Local Development

### Prerequisites

- Docker and Docker Compose
- Node 20+, Python 3.11+
- A `.env` file (copy from `ENV_TEMPLATE.txt`)

### 1. Clone and configure environment

```bash
git clone https://github.com/your-org/therapy-tracker.git
cd therapy-tracker
cp ENV_TEMPLATE.txt .env
# Edit .env with your values
```

### 2. Start all services

```bash
docker compose up --build
```

Services started:

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:8000 |
| Postgres | localhost:5432        |
| Redis    | localhost:6379        |

### 3. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Run the data pipeline locally (optional)

```bash
cd data_pipeline
pip install -r requirements.txt

# Dry run -- no DB writes
python clinicaltrials_sync.py --dry-run --max-results 50
python fda_sync.py --dry-run --days-back 30
python milestone_checker.py --dry-run
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key for AI summaries |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin SDK service account JSON (string) |
| `SENDGRID_API_KEY` | No | SendGrid API key for email alerts |
| `GCP_PROJECT_ID` | Prod | GCP project ID |
| `CLOUD_SQL_CONNECTION_NAME` | Prod | Cloud SQL proxy connection name |
| `GCS_DOCUMENTS_BUCKET` | Prod | GCS bucket for therapy documents |
| `GCS_INGESTION_BUCKET` | Prod | GCS bucket for raw pipeline data |
| `ENVIRONMENT` | No | `development` / `staging` / `prod` |
| `OPENFDA_API_KEY` | No | openFDA API key (rate limit increase) |

---

## API Documentation

When the backend is running, interactive API docs are available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/therapies` | List/search therapy records |
| `GET` | `/api/v1/therapies/{id}` | Get therapy detail |
| `POST` | `/api/v1/ingestion/trigger` | Trigger a data sync (scheduler target) |
| `POST` | `/api/v1/milestones/check` | Run milestone check (scheduler target) |
| `GET` | `/api/v1/milestones` | List upcoming milestones |
| `GET` | `/api/v1/notifications` | Get user notifications |
| `GET` | `/health` | Health check |

---

## Deploying to GCP

### Step 1: Create and configure a GCP project

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1

gcloud projects create $PROJECT_ID --name="Therapy Tracker"
gcloud config set project $PROJECT_ID
gcloud auth application-default login
```

### Step 2: Enable required GCP APIs

```bash
gcloud services enable \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  iam.googleapis.com \
  cloudtasks.googleapis.com \
  compute.googleapis.com
```

### Step 3: Initialize Terraform

```bash
cd infrastructure/terraform

# Create a GCS bucket for Terraform state (one-time)
gsutil mb -l $REGION gs://$PROJECT_ID-terraform-state

# Uncomment the backend block in main.tf and set the bucket name

terraform init
terraform workspace new staging
terraform plan -var="project_id=$PROJECT_ID" -var="environment=staging"
terraform apply -var="project_id=$PROJECT_ID" -var="environment=staging"
```

### Step 4: Add secrets to Secret Manager

After Terraform creates the secret resources, populate secret values:

```bash
ENV=staging  # or prod

# Anthropic API key
echo -n "sk-ant-YOUR_KEY" | \
  gcloud secrets versions add ${ENV}-anthropic-api-key --data-file=-

# Firebase service account (download from Firebase Console)
gcloud secrets versions add ${ENV}-firebase-service-account \
  --data-file=firebase-service-account.json

# The db-password and redis-url secrets are auto-populated by Terraform
```

### Step 5: Set up Cloud Build trigger

```bash
# Grant Cloud Build service account necessary roles
CB_SA=$(gcloud projects describe $PROJECT_ID \
  --format='value(projectNumber)')@cloudbuild.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CB_SA" \
  --role="roles/iam.serviceAccountUser"

# Create a trigger (or configure via Cloud Console)
gcloud builds triggers create github \
  --repo-name=therapy-tracker \
  --repo-owner=your-org \
  --branch-pattern="^main$" \
  --build-config=infrastructure/cloudbuild.yaml \
  --substitutions="_ENVIRONMENT=staging,_PROJECT_ID=$PROJECT_ID,_REGION=$REGION"
```

### Step 6: Deploy

Push to `main` -- Cloud Build will:
1. Run backend tests (pytest with coverage)
2. Build and push Docker images to Artifact Registry
3. Deploy backend and frontend to Cloud Run
4. Run Alembic database migrations via a one-off Cloud Run Job

---

## Data Pipeline

Three standalone Python scripts sync external data sources on a schedule:

| Script | Schedule | Source | Description |
|--------|----------|--------|-------------|
| `clinicaltrials_sync.py` | Daily 2 AM UTC | ClinicalTrials.gov API v2 | Upserts gene/cell therapy study records, generates AI summaries for new entries |
| `fda_sync.py` | Daily 3 AM UTC | openFDA + FDA RSS | Captures BLA approvals and press releases, links to therapy records |
| `milestone_checker.py` | Weekly Mon 6 AM UTC | Internal DB | Sends in-app and email alerts for milestones within 7/30/60 days |

Scripts can be run standalone, via Cloud Run Jobs, or triggered through the backend API endpoint `/api/v1/ingestion/trigger`.

```bash
# Run with --help to see all options
python data_pipeline/clinicaltrials_sync.py --help
python data_pipeline/fda_sync.py --help
python data_pipeline/milestone_checker.py --help
```

Search terms covered by the ClinicalTrials sync:
- Gene therapy, cell therapy, CAR-T, CAR T-cell
- Gene editing, CRISPR, base editing, prime editing
- Antisense oligonucleotide, RNA therapy, mRNA, siRNA
- Lentiviral/AAV/retroviral vectors
- Stem cell, NK cell, dendritic cell therapies
- Oncolytic virus, TCR-T, chimeric antigen receptor

---

## Project Structure

```
therapy-tracker/
|-- backend/                  FastAPI application
|   |-- app/
|   |   |-- main.py           App entry point + middleware
|   |   |-- api/              Route handlers
|   |   |-- models/           SQLAlchemy ORM models
|   |   |-- services/         Business logic
|   |   `-- core/             Config, auth, database
|   |-- migrations/           Alembic migration scripts
|   |-- tests/                Pytest test suite
|   |-- Dockerfile            Multi-stage production Dockerfile
|   `-- requirements.txt
|
|-- frontend/                 React + Vite SPA
|   |-- src/
|   |-- Dockerfile            Multi-stage (builder + nginx runtime)
|   `-- nginx.conf            SPA routing + security headers + gzip
|
|-- data_pipeline/            Standalone sync scripts
|   |-- clinicaltrials_sync.py
|   |-- fda_sync.py
|   |-- milestone_checker.py
|   `-- requirements.txt
|
|-- infrastructure/
|   |-- terraform/
|   |   |-- main.tf           All GCP resources (Cloud SQL, Redis, Cloud Run, etc.)
|   |   |-- variables.tf      Variable definitions with defaults
|   |   `-- outputs.tf        Resource URLs, connection strings
|   `-- cloudbuild.yaml       7-step CI/CD pipeline
|
|-- docker-compose.yml        Local development stack (db, redis, backend, frontend)
`-- .gitignore                Python, Node, GCP, Terraform, IDE patterns
```

---

## Contributing

1. Fork the repository and create a feature branch from `main`
2. Follow the local development setup above
3. Write tests for new backend features (`pytest backend/tests/`)
4. Ensure `docker compose up --build` starts cleanly
5. Open a pull request -- Cloud Build will run the full test suite on every push

**Code style:**
- Python: `ruff` for linting, `black` for formatting
- TypeScript: ESLint + Prettier
- Commits: conventional commits format (`feat:`, `fix:`, `chore:`, etc.)

---

## License

Proprietary -- All rights reserved.
