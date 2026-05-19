export enum UserRole {
  ADMIN = 'admin',
  INSTITUTION_ADMIN = 'institution_admin',
  CLINICIAN = 'clinician',
  RESEARCHER = 'researcher',
  READONLY = 'readonly',
}

export enum InstitutionType {
  ACADEMIC_MEDICAL_CENTER = 'Academic Medical Center',
  COMMUNITY_HOSPITAL = 'Community Hospital',
  CANCER_CENTER = 'Cancer Center',
  CHILDRENS_HOSPITAL = "Children's Hospital",
  SPECIALTY_CLINIC = 'Specialty Clinic',
  RESEARCH_INSTITUTION = 'Research Institution',
  PHARMA = 'Pharmaceutical',
  BIOTECH = 'Biotech',
  OTHER = 'Other',
}

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  city: string;
  state: string;
  country: string;
  nci_designation?: string;
  magnet_status?: boolean;
  contact_email?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string;
  role: UserRole;
  institution_id?: string;
  institution?: Institution;
  avatar_url?: string;
  title?: string;
  department?: string;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  email_milestones: boolean;
  email_regulatory_updates: boolean;
  email_news: boolean;
  in_app_milestones: boolean;
  in_app_regulatory_updates: boolean;
  milestone_alert_days: number[];
  notification_frequency: 'immediate' | 'daily' | 'weekly';
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  therapy_id: string;
  priority: number;
  notes?: string;
  role?: string;
  notify_on_updates: boolean;
  added_at: string;
  updated_at: string;
  therapy?: import('./therapy').Therapy;
}

export interface Notification {
  id: string;
  user_id: string;
  therapy_id?: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  url?: string;
  is_read: boolean;
  created_at: string;
}

export enum NotificationType {
  MILESTONE = 'milestone',
  REGULATORY_UPDATE = 'regulatory_update',
  NEWS = 'news',
  SYSTEM = 'system',
  WATCHLIST_UPDATE = 'watchlist_update',
}

export enum OperationalStage {
  AWARENESS = 'Awareness',
  FEASIBILITY_ASSESSMENT = 'Feasibility Assessment',
  LEADERSHIP_REVIEW = 'Leadership Review',
  SITE_QUALIFICATION = 'Site Qualification',
  CONTRACT_NEGOTIATION = 'Contract Negotiation',
  REGULATORY_PREP = 'Regulatory Preparation',
  IRB_SUBMISSION = 'IRB Submission',
  IRB_APPROVAL = 'IRB Approval',
  STAFF_TRAINING = 'Staff Training',
  INFRASTRUCTURE_BUILD = 'Infrastructure Build',
  SUPPLY_CHAIN_SETUP = 'Supply Chain Setup',
  PATIENT_ID_PROTOCOL = 'Patient ID Protocol',
  INSURANCE_CONTRACTING = 'Insurance Contracting',
  FINANCIAL_COUNSELING_SETUP = 'Financial Counseling Setup',
  TREATMENT_INITIATION = 'Treatment Initiation',
  ACTIVE_TREATMENT = 'Active Treatment',
  OUTCOMES_MONITORING = 'Outcomes Monitoring',
  REGISTRY_ENROLLMENT = 'Registry Enrollment',
  REMS_COMPLIANCE = 'REMS Compliance',
  QUALITY_REPORTING = 'Quality Reporting',
  PEER_REVIEW_PUBLICATION = 'Peer Review & Publication',
  PROGRAM_OPTIMIZATION = 'Program Optimization',
  MATURE_PROGRAM = 'Mature Program',
}

export const OPERATIONAL_STAGES_ORDERED: OperationalStage[] = [
  OperationalStage.AWARENESS,
  OperationalStage.FEASIBILITY_ASSESSMENT,
  OperationalStage.LEADERSHIP_REVIEW,
  OperationalStage.SITE_QUALIFICATION,
  OperationalStage.CONTRACT_NEGOTIATION,
  OperationalStage.REGULATORY_PREP,
  OperationalStage.IRB_SUBMISSION,
  OperationalStage.IRB_APPROVAL,
  OperationalStage.STAFF_TRAINING,
  OperationalStage.INFRASTRUCTURE_BUILD,
  OperationalStage.SUPPLY_CHAIN_SETUP,
  OperationalStage.PATIENT_ID_PROTOCOL,
  OperationalStage.INSURANCE_CONTRACTING,
  OperationalStage.FINANCIAL_COUNSELING_SETUP,
  OperationalStage.TREATMENT_INITIATION,
  OperationalStage.ACTIVE_TREATMENT,
  OperationalStage.OUTCOMES_MONITORING,
  OperationalStage.REGISTRY_ENROLLMENT,
  OperationalStage.REMS_COMPLIANCE,
  OperationalStage.QUALITY_REPORTING,
  OperationalStage.PEER_REVIEW_PUBLICATION,
  OperationalStage.PROGRAM_OPTIMIZATION,
  OperationalStage.MATURE_PROGRAM,
];

export interface OperationalReadiness {
  id: string;
  institution_id: string;
  therapy_id: string;
  current_stage: OperationalStage;
  stage_index: number;
  primary_owner?: string;
  secondary_owner?: string;
  next_action?: string;
  due_date?: string;
  barriers?: string;
  notes?: string;
  estimated_patient_volume?: number;
  center_role?: 'Lead' | 'Participating' | 'Monitoring' | 'Not Applicable';
  priority: 'high' | 'medium' | 'low';
  stage_history?: StageHistoryEntry[];
  created_at: string;
  updated_at: string;
  therapy?: import('./therapy').Therapy;
}

export interface StageHistoryEntry {
  stage: OperationalStage;
  entered_at: string;
  entered_by: string;
  notes?: string;
}

export interface OperationalSummary {
  institution_id: string;
  total_tracked: number;
  ready_to_treat: number;
  in_preparation: number;
  monitoring_only: number;
  by_stage: Record<string, number>;
  by_priority: Record<string, number>;
}
