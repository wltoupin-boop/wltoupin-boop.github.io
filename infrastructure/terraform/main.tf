# ============================================================
# Cell & Gene Therapy Tracking Platform
# Terraform — GCP Infrastructure
# ============================================================
#
# Usage:
#   terraform init
#   terraform workspace new staging   # or prod
#   terraform plan  -var="project_id=my-gcp-project"
#   terraform apply -var="project_id=my-gcp-project"
#
# Prerequisites (run once manually or via bootstrap script):
#   gcloud services enable cloudresourcemanager.googleapis.com
# ============================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Uncomment after creating GCS bucket for remote state:
  # backend "gcs" {
  #   bucket = "YOUR_PROJECT_ID-terraform-state"
  #   prefix = "therapy-tracker"
  # }
}

# ----------------------------------------------------------
# Providers
# ----------------------------------------------------------

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone

  default_labels = merge(var.labels, {
    environment = var.environment
  })
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ----------------------------------------------------------
# Enable GCP APIs
# ----------------------------------------------------------

locals {
  required_apis = [
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "iam.googleapis.com",
    "cloudtasks.googleapis.com",
    "compute.googleapis.com",
    "firebase.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}

# ----------------------------------------------------------
# Networking — VPC + private service connection for Cloud SQL
# ----------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = var.vpc_network_name
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = var.vpc_subnetwork_name
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# Reserved IP range for Google-managed services (Cloud SQL, Memorystore)
resource "google_compute_global_address" "private_services_range" {
  name          = "${var.environment}-private-services-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services_range.name]

  depends_on = [google_project_service.apis]
}

# Serverless VPC Access connector — lets Cloud Run reach private VPC resources
resource "google_vpc_access_connector" "connector" {
  name          = "${var.environment}-vpc-connector"
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.10.1.0/28"
  min_instances = 2
  max_instances = 10

  depends_on = [google_project_service.apis]
}

# ----------------------------------------------------------
# Artifact Registry — Docker image repository
# ----------------------------------------------------------

resource "google_artifact_registry_repository" "docker" {
  repository_id = "therapy-tracker"
  location      = var.region
  format        = "DOCKER"
  description   = "Cell & Gene Therapy Tracker Docker images"

  depends_on = [google_project_service.apis]
}

# ----------------------------------------------------------
# Service Account — Backend Cloud Run identity
# ----------------------------------------------------------

resource "google_service_account" "backend_sa" {
  account_id   = "${var.environment}-backend-sa"
  display_name = "Therapy Tracker Backend (${var.environment})"
  description  = "Service account for the backend Cloud Run service"
}

# Secret Manager access — read secrets at runtime
resource "google_project_iam_member" "backend_sa_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud Storage object admin — read/write therapy documents and ingestion data
resource "google_project_iam_member" "backend_sa_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud Tasks enqueuer — for async job dispatch
resource "google_project_iam_member" "backend_sa_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Cloud SQL client — for production direct connections
resource "google_project_iam_member" "backend_sa_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ----------------------------------------------------------
# Secret Manager — Application secrets
# ----------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>?"
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.environment}-db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "${var.environment}-redis-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Redis URL is populated after redis instance is created (see null_resource below)
resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}/0"
}

resource "google_secret_manager_secret" "firebase_service_account" {
  secret_id = "${var.environment}-firebase-service-account"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]

  # NOTE: populate the actual Firebase service account JSON via:
  #   gcloud secrets versions add STAGING-firebase-service-account --data-file=firebase-sa.json
}

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "${var.environment}-anthropic-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]

  # NOTE: populate via:
  #   echo -n "sk-ant-..." | gcloud secrets versions add STAGING-anthropic-api-key --data-file=-
}

# ----------------------------------------------------------
# Cloud SQL — PostgreSQL 15
# ----------------------------------------------------------

locals {
  db_tier = var.environment == "prod" ? "db-custom-2-7680" : "db-f1-micro"
}

resource "google_sql_database_instance" "postgres" {
  name             = "${var.environment}-therapy-tracker-pg-${var.db_instance_name_suffix}"
  database_version = "POSTGRES_15"
  region           = var.region

  deletion_protection = var.db_deletion_protection

  settings {
    tier              = local.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.environment == "prod" ? 100 : 20
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "prod"
      location                       = var.db_backup_location
      transaction_log_retention_days = var.environment == "prod" ? 7 : 3

      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 4 # 4am UTC
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # log queries slower than 1 second
    }
  }

  depends_on = [
    google_service_networking_connection.private_services,
    google_project_service.apis,
  ]
}

resource "google_sql_database" "therapy_tracker" {
  name     = "therapy_tracker"
  instance = google_sql_database_instance.postgres.name
  charset  = "UTF8"
}

resource "google_sql_user" "app" {
  name     = "app"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

# ----------------------------------------------------------
# Cloud Memorystore — Redis
# ----------------------------------------------------------

locals {
  redis_memory_size = var.environment == "prod" ? 4 : 1
}

resource "google_redis_instance" "cache" {
  name           = "${var.environment}-therapy-tracker-redis"
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = local.redis_memory_size
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = "REDIS_7_0"
  display_name      = "Therapy Tracker Cache (${var.environment})"
  reserved_ip_range = "10.10.2.0/29"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 5
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  depends_on = [
    google_service_networking_connection.private_services,
    google_project_service.apis,
  ]
}

# ----------------------------------------------------------
# Cloud Storage — Therapy documents
# ----------------------------------------------------------

resource "google_storage_bucket" "documents" {
  name                        = "${var.project_id}-${var.environment}-therapy-documents"
  location                    = var.documents_bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 5
      with_state         = "ARCHIVED"
    }
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      days_since_noncurrent_time = 90
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 30
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  labels = merge(var.labels, { environment = var.environment })
}

# Grant backend SA access to documents bucket
resource "google_storage_bucket_iam_member" "backend_sa_documents" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ----------------------------------------------------------
# Cloud Storage — Raw ingestion data
# ----------------------------------------------------------

resource "google_storage_bucket" "ingestion_raw" {
  name                        = "${var.project_id}-${var.environment}-ingestion-raw"
  location                    = var.ingestion_bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30 # raw dumps expire after 30 days
    }
  }

  labels = merge(var.labels, {
    environment = var.environment
    purpose     = "data-ingestion"
  })
}

resource "google_storage_bucket_iam_member" "backend_sa_ingestion" {
  bucket = google_storage_bucket.ingestion_raw.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ----------------------------------------------------------
# Cloud Run — Backend (FastAPI)
# ----------------------------------------------------------

locals {
  backend_image  = var.backend_image != "" ? var.backend_image : "${var.region}-docker.pkg.dev/${var.project_id}/therapy-tracker/backend:latest"
  frontend_image = var.frontend_image != "" ? var.frontend_image : "${var.region}-docker.pkg.dev/${var.project_id}/therapy-tracker/frontend:latest"

  backend_cpu    = var.environment == "prod" ? "2" : "1"
  backend_memory = var.environment == "prod" ? "2Gi" : "512Mi"
}

resource "google_cloud_run_service" "backend" {
  name     = "${var.environment}-therapy-tracker-backend"
  location = var.region

  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"         = tostring(var.backend_min_instances)
        "autoscaling.knative.dev/maxScale"         = tostring(var.backend_max_instances)
        "run.googleapis.com/vpc-access-connector"  = google_vpc_access_connector.connector.id
        "run.googleapis.com/vpc-access-egress"     = "private-ranges-only"
        "run.googleapis.com/cloudsql-instances"    = google_sql_database_instance.postgres.connection_name
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }

    spec {
      service_account_name  = google_service_account.backend_sa.email
      container_concurrency = 80
      timeout_seconds       = 300

      containers {
        image = local.backend_image

        resources {
          limits = {
            cpu    = local.backend_cpu
            memory = local.backend_memory
          }
        }

        ports {
          container_port = 8000
        }

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCS_DOCUMENTS_BUCKET"
          value = google_storage_bucket.documents.name
        }

        env {
          name  = "GCS_INGESTION_BUCKET"
          value = google_storage_bucket.ingestion_raw.name
        }

        env {
          name  = "CLOUD_SQL_CONNECTION_NAME"
          value = google_sql_database_instance.postgres.connection_name
        }

        env {
          name  = "DB_NAME"
          value = google_sql_database.therapy_tracker.name
        }

        env {
          name  = "DB_USER"
          value = google_sql_user.app.name
        }

        # Secrets injected as environment variables
        env {
          name = "DB_PASSWORD"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_password.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "REDIS_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.redis_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "ANTHROPIC_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.anthropic_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "FIREBASE_SERVICE_ACCOUNT_JSON"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.firebase_service_account.secret_id
              key  = "latest"
            }
          }
        }

        liveness_probe {
          http_get {
            path = "/health"
            port = 8000
          }
          initial_delay_seconds = 10
          period_seconds        = 30
          failure_threshold     = 3
        }

        startup_probe {
          http_get {
            path = "/health"
            port = 8000
          }
          initial_delay_seconds = 5
          period_seconds        = 10
          failure_threshold     = 12
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  autogenerate_revision_name = true

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_version.redis_url,
    google_project_iam_member.backend_sa_secret_accessor,
  ]
}

# Backend is NOT publicly accessible — requires Firebase JWT
resource "google_cloud_run_service_iam_member" "backend_invoker" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  # Cloud Scheduler and other GCP services use the backend SA to call backend
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ----------------------------------------------------------
# Cloud Run — Frontend (nginx serving React build)
# ----------------------------------------------------------

resource "google_cloud_run_service" "frontend" {
  name     = "${var.environment}-therapy-tracker-frontend"
  location = var.region

  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = tostring(var.frontend_min_instances)
        "autoscaling.knative.dev/maxScale" = tostring(var.frontend_max_instances)
      }
    }

    spec {
      container_concurrency = 1000
      timeout_seconds       = 60

      containers {
        image = local.frontend_image

        resources {
          limits = {
            cpu    = "1"
            memory = "256Mi"
          }
        }

        ports {
          container_port = 80
        }

        env {
          name  = "VITE_API_URL"
          value = google_cloud_run_service.backend.status[0].url
        }

        env {
          name  = "VITE_ENVIRONMENT"
          value = var.environment
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  autogenerate_revision_name = true

  depends_on = [
    google_project_service.apis,
    google_cloud_run_service.backend,
  ]
}

# Frontend is publicly accessible (unauthenticated)
resource "google_cloud_run_service_iam_member" "frontend_public" {
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ----------------------------------------------------------
# Cloud Scheduler — Data pipeline jobs
# ----------------------------------------------------------

# Dedicated service account for Cloud Scheduler to invoke backend
resource "google_service_account" "scheduler_sa" {
  account_id   = "${var.environment}-scheduler-sa"
  display_name = "Cloud Scheduler (${var.environment})"
}

resource "google_cloud_run_service_iam_member" "scheduler_backend_invoker" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_sa.email}"
}

resource "google_cloud_scheduler_job" "daily_clinicaltrials_sync" {
  name             = "${var.environment}-daily-clinicaltrials-sync"
  description      = "Sync new and updated records from ClinicalTrials.gov API v2"
  schedule         = "0 2 * * *" # 2:00 AM UTC daily
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.backend.status[0].url}/api/v1/ingestion/trigger"

    body = base64encode(jsonencode({
      source    = "clinicaltrials"
      triggered = "scheduler"
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
      audience              = google_cloud_run_service.backend.status[0].url
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_scheduler_job" "daily_fda_sync" {
  name             = "${var.environment}-daily-fda-sync"
  description      = "Sync FDA approval data from openFDA API"
  schedule         = "0 3 * * *" # 3:00 AM UTC daily
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.backend.status[0].url}/api/v1/ingestion/trigger"

    body = base64encode(jsonencode({
      source    = "fda"
      triggered = "scheduler"
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
      audience              = google_cloud_run_service.backend.status[0].url
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_scheduler_job" "weekly_milestone_check" {
  name             = "${var.environment}-weekly-milestone-check"
  description      = "Check upcoming therapy milestones and send alerts"
  schedule         = "0 6 * * 1" # 6:00 AM UTC every Monday
  time_zone        = "UTC"
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count          = 2
    min_backoff_duration = "60s"
    max_backoff_duration = "600s"
    max_doublings        = 2
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_service.backend.status[0].url}/api/v1/milestones/check"

    body = base64encode(jsonencode({
      triggered = "scheduler"
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
      audience              = google_cloud_run_service.backend.status[0].url
    }
  }

  depends_on = [google_project_service.apis]
}
