# ============================================================
# Cell & Gene Therapy Tracking Platform
# Terraform Variables
# ============================================================

variable "project_id" {
  description = "GCP project ID where all resources will be deployed"
  type        = string
}

variable "region" {
  description = "GCP region for resource deployment"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal resources (Cloud SQL primary)"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Deployment environment. Controls resource sizing and configuration"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment must be one of: staging, prod"
  }
}

# ----------------------------------------------------------
# Networking
# ----------------------------------------------------------

variable "vpc_network_name" {
  description = "Name of the VPC network to use (must already exist or be created separately)"
  type        = string
  default     = "therapy-tracker-vpc"
}

variable "vpc_subnetwork_name" {
  description = "Name of the VPC subnetwork for Cloud SQL private IP"
  type        = string
  default     = "therapy-tracker-subnet"
}

# ----------------------------------------------------------
# Cloud SQL / PostgreSQL
# ----------------------------------------------------------

variable "db_instance_name_suffix" {
  description = "Suffix appended to the Cloud SQL instance name for uniqueness (Cloud SQL names cannot be reused for 7 days after deletion)"
  type        = string
  default     = "01"
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the Cloud SQL instance. Set to false only when tearing down."
  type        = bool
  default     = true
}

variable "db_backup_location" {
  description = "GCS multi-region location for automated database backups"
  type        = string
  default     = "us"
}

# ----------------------------------------------------------
# Cloud Run
# ----------------------------------------------------------

variable "backend_image" {
  description = "Full Artifact Registry image path for the backend service (e.g. us-central1-docker.pkg.dev/PROJECT/repo/backend:latest)"
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Full Artifact Registry image path for the frontend nginx service"
  type        = string
  default     = ""
}

variable "backend_min_instances" {
  description = "Minimum number of backend Cloud Run instances (0 = scale to zero for staging)"
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Maximum number of backend Cloud Run instances"
  type        = number
  default     = 10
}

variable "frontend_min_instances" {
  description = "Minimum number of frontend Cloud Run instances"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum number of frontend Cloud Run instances"
  type        = number
  default     = 5
}

# ----------------------------------------------------------
# Cloud Storage
# ----------------------------------------------------------

variable "documents_bucket_location" {
  description = "GCS location for the therapy documents bucket (MULTI_REGIONAL for prod, REGIONAL for staging)"
  type        = string
  default     = "US"
}

variable "ingestion_bucket_location" {
  description = "GCS location for the raw ingestion bucket"
  type        = string
  default     = "US"
}

# ----------------------------------------------------------
# Firebase / Auth
# ----------------------------------------------------------

variable "firebase_project_id" {
  description = "Firebase project ID (usually the same as project_id)"
  type        = string
  default     = ""
}

# ----------------------------------------------------------
# Alerting / Notifications
# ----------------------------------------------------------

variable "alert_notification_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
  default     = ""
}

# ----------------------------------------------------------
# Labels
# ----------------------------------------------------------

variable "labels" {
  description = "Common GCP resource labels applied to all resources"
  type        = map(string)
  default = {
    managed-by = "terraform"
    platform   = "therapy-tracker"
  }
}
