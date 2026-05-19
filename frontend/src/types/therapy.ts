export enum TherapyType {
  CAR_T = 'CAR-T',
  TCR_T = 'TCR-T',
  GENE_THERAPY = 'Gene Therapy',
  GENE_EDITING = 'Gene Editing',
  STEM_CELL = 'Stem Cell',
  NK_CELL = 'NK Cell',
  TIL = 'TIL',
  DENDRITIC_CELL = 'Dendritic Cell',
  OTHER_CELL = 'Other Cell Therapy',
}

export enum DiseaseCategory {
  ONCOLOGY = 'Oncology',
  HEMATOLOGY = 'Hematology',
  NEUROLOGY = 'Neurology',
  METABOLIC = 'Metabolic',
  IMMUNOLOGY = 'Immunology',
  OPHTHALMOLOGY = 'Ophthalmology',
  MUSCULOSKELETAL = 'Musculoskeletal',
  CARDIOVASCULAR = 'Cardiovascular',
  PULMONARY = 'Pulmonary',
  RARE_DISEASE = 'Rare Disease',
  OTHER = 'Other',
}

export enum ClinicalPhase {
  PRECLINICAL = 'Preclinical',
  PHASE_1 = 'Phase 1',
  PHASE_1_2 = 'Phase 1/2',
  PHASE_2 = 'Phase 2',
  PHASE_2_3 = 'Phase 2/3',
  PHASE_3 = 'Phase 3',
  APPROVED = 'Approved',
  DISCONTINUED = 'Discontinued',
}

export enum FDAApprovalStatus {
  APPROVED = 'Approved',
  PRIORITY_REVIEW = 'Priority Review',
  BREAKTHROUGH = 'Breakthrough Therapy',
  ACCELERATED = 'Accelerated Approval',
  FAST_TRACK = 'Fast Track',
  BLA_SUBMITTED = 'BLA Submitted',
  REMS_REQUIRED = 'REMS Required',
  NOT_YET_SUBMITTED = 'Not Yet Submitted',
  REJECTED = 'Rejected',
  WITHDRAWN = 'Withdrawn',
}

export interface TherapyMilestone {
  id: string;
  therapy_id: string;
  milestone_type: MilestoneType;
  date: string;
  description: string;
  is_confirmed: boolean;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export enum MilestoneType {
  PDUFA_DATE = 'PDUFA Date',
  ADCOM_MEETING = 'AdCom Meeting',
  BLA_SUBMISSION = 'BLA Submission',
  TRIAL_COMPLETION = 'Trial Completion',
  DATA_READOUT = 'Data Readout',
  APPROVAL = 'Approval',
  LABEL_UPDATE = 'Label Update',
  REMS_UPDATE = 'REMS Update',
  POST_MARKET_STUDY = 'Post-Market Study',
  OTHER = 'Other',
}

export interface TrialDetail {
  nct_number: string;
  trial_name: string;
  phase: string;
  status: string;
  enrollment: number;
  completion_date?: string;
  primary_readout_date?: string;
  sponsor: string;
  conditions: string[];
  interventions: string[];
}

export interface EpidemiologyData {
  global_prevalence?: number;
  us_prevalence?: number;
  us_incidence?: number;
  pediatric_prevalence?: number;
  addressable_population?: number;
  patient_impact_score?: number;
  prevalence_source?: string;
  prevalence_source_year?: number;
}

export interface AIReviewFlag {
  id: string;
  therapy_id: string;
  field_name: string;
  field_value: string;
  flag_reason: string;
  flagged_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution?: string;
}

export interface Therapy {
  id: string;
  product_name: string;
  generic_name?: string;
  manufacturer: string;
  therapy_type: TherapyType;
  disease_category: DiseaseCategory;
  indication: string;
  indication_details?: string;
  clinical_phase: ClinicalPhase;
  fda_approval_status: FDAApprovalStatus;
  pdufa_date?: string;
  adcom_date?: string;
  approval_date?: string;
  bla_number?: string;
  accelerated_approval: boolean;
  priority_review: boolean;
  breakthrough_designation: boolean;
  fast_track_designation: boolean;
  orphan_drug_designation: boolean;
  pediatric_priority: boolean;
  rare_disease: boolean;
  rems_required: boolean;
  rems_program_name?: string;
  ai_summary?: string;
  ai_clinical_summary?: string;
  ai_regulatory_summary?: string;
  ai_generated_fields: string[];
  needs_human_review: boolean;
  last_ai_review?: string;
  label_limitations?: string;
  post_marketing_commitments?: string;
  confirmatory_studies?: string;
  trial_details?: TrialDetail[];
  milestones?: TherapyMilestone[];
  epidemiology?: EpidemiologyData;
  news_items?: NewsItem[];
  fda_documents?: FDADocument[];
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  id: string;
  therapy_id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  is_ai_generated: boolean;
}

export interface FDADocument {
  id: string;
  therapy_id: string;
  document_type: string;
  title: string;
  url: string;
  published_at: string;
}

export interface TherapySearchParams {
  q?: string;
  therapy_type?: TherapyType[];
  disease_category?: DiseaseCategory[];
  fda_approval_status?: FDAApprovalStatus[];
  clinical_phase?: ClinicalPhase[];
  pediatric_only?: boolean;
  rare_disease_only?: boolean;
  manufacturer?: string;
  needs_review?: boolean;
  sort_by?: 'name' | 'updated_at' | 'pdufa_date' | 'approval_date' | 'impact_score';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface TherapyListResponse {
  items: Therapy[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
