# ============================================================
# Cell & Gene Therapy Tracking Platform
# Terraform Outputs
# ============================================================

# ----------------------------------------------------------
# Cloud Run — Service URLs
# ----------------------------------------------------------

output "backend_url" {
  description = "Public HTTPS URL of the backend Cloud Run service"
  value       = google_cloud_run_service.backend.status[0].url
}

output "frontend_url" {
  description = "Public HTTPS URL of the frontend Cloud Run service"
  value       = google_cloud_run_service.frontend.status[0].url
}

# ----------------------------------------------------------
# Cloud SQL
# ----------------------------------------------------------

output "db_connection_name" {
  description = "Cloud SQL instance connection name used by Cloud SQL Auth Proxy (PROJECT:REGION:INSTANCE)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "db_private_ip" {
  description = "Private IP address of the Cloud SQL instance (accessible only within the VPC)"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "db_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.postgres.name
}

# ----------------------------------------------------------
# Redis / Memorystore
# ----------------------------------------------------------

output "redis_host" {
  description = "Redis instance host IP (private, within VPC)"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.cache.port
}

# ----------------------------------------------------------
# Cloud Storage
# ----------------------------------------------------------

output "documents_bucket_name" {
  description = "GCS bucket name for therapy documents"
  value       = google_storage_bucket.documents.name
}

output "ingestion_raw_bucket_name" {
  description = "GCS bucket name for raw ingestion data from external APIs"
  value       = google_storage_bucket.ingestion_raw.name
}

# ----------------------------------------------------------
# Service Account
# ----------------------------------------------------------

output "backend_service_account_email" {
  description = "Email of the backend Cloud Run service account"
  value       = google_service_account.backend_sa.email
}

# ----------------------------------------------------------
# Secret Manager
# ----------------------------------------------------------

output "db_password_secret_id" {
  description = "Secret Manager secret ID for the database password"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "anthropic_api_key_secret_id" {
  description = "Secret Manager secret ID for the Anthropic API key"
  value       = google_secret_manager_secret.anthropic_api_key.secret_id
}

# ----------------------------------------------------------
# Artifact Registry
# ----------------------------------------------------------

output "artifact_registry_repository" {
  description = "Artifact Registry repository path for Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/therapy-tracker"
}

# ----------------------------------------------------------
# Cloud Scheduler
# ----------------------------------------------------------

output "scheduler_jobs" {
  description = "Names of all Cloud Scheduler jobs"
  value = {
    clinicaltrials_sync = google_cloud_scheduler_job.daily_clinicaltrials_sync.name
    fda_sync            = google_cloud_scheduler_job.daily_fda_sync.name
    milestone_check     = google_cloud_scheduler_job.weekly_milestone_check.name
  }
}

# ----------------------------------------------------------
# Convenience: full gcloud command to connect to Cloud SQL
# ----------------------------------------------------------

output "cloud_sql_proxy_command" {
  description = "gcloud command to start Cloud SQL Auth Proxy for local DB access"
  value       = "gcloud sql connect ${google_sql_database_instance.postgres.name} --user=app --database=therapy_tracker --project=${var.project_id}"
}
