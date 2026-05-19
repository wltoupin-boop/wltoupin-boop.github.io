import React from 'react';
import { cn } from '@/lib/utils';
import { TherapyType, DiseaseCategory, FDAApprovalStatus, ClinicalPhase } from '@/types/therapy';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'orange'
  | 'teal'
  | 'pink'
  | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-100 text-primary-800',
  success: 'bg-accent-100 text-accent-800',
  warning: 'bg-warning-100 text-warning-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
  pink: 'bg-pink-100 text-pink-800',
  neutral: 'bg-neutral-100 text-neutral-700',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'md', className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

// Specialized FDA Status Badge
export const FDAStatusBadge: React.FC<{ status: FDAApprovalStatus }> = ({ status }) => {
  const config: Record<FDAApprovalStatus, { variant: BadgeVariant; label: string }> = {
    [FDAApprovalStatus.APPROVED]: { variant: 'success', label: 'Approved' },
    [FDAApprovalStatus.PRIORITY_REVIEW]: { variant: 'info', label: 'Priority Review' },
    [FDAApprovalStatus.BREAKTHROUGH]: { variant: 'purple', label: 'Breakthrough' },
    [FDAApprovalStatus.ACCELERATED]: { variant: 'teal', label: 'Accelerated' },
    [FDAApprovalStatus.FAST_TRACK]: { variant: 'default', label: 'Fast Track' },
    [FDAApprovalStatus.BLA_SUBMITTED]: { variant: 'warning', label: 'BLA Submitted' },
    [FDAApprovalStatus.REMS_REQUIRED]: { variant: 'orange', label: 'REMS Required' },
    [FDAApprovalStatus.NOT_YET_SUBMITTED]: { variant: 'neutral', label: 'Not Submitted' },
    [FDAApprovalStatus.REJECTED]: { variant: 'danger', label: 'Rejected' },
    [FDAApprovalStatus.WITHDRAWN]: { variant: 'danger', label: 'Withdrawn' },
  };
  const { variant, label } = config[status] ?? { variant: 'neutral' as BadgeVariant, label: status };
  return <Badge variant={variant}>{label}</Badge>;
};

// Clinical Phase Badge
export const PhaseBadge: React.FC<{ phase: ClinicalPhase }> = ({ phase }) => {
  const config: Record<ClinicalPhase, BadgeVariant> = {
    [ClinicalPhase.PRECLINICAL]: 'neutral',
    [ClinicalPhase.PHASE_1]: 'info',
    [ClinicalPhase.PHASE_1_2]: 'info',
    [ClinicalPhase.PHASE_2]: 'default',
    [ClinicalPhase.PHASE_2_3]: 'default',
    [ClinicalPhase.PHASE_3]: 'purple',
    [ClinicalPhase.APPROVED]: 'success',
    [ClinicalPhase.DISCONTINUED]: 'danger',
  };
  return <Badge variant={config[phase] ?? 'neutral'}>{phase}</Badge>;
};

// Therapy Type Badge
export const TherapyTypeBadge: React.FC<{ type: TherapyType }> = ({ type }) => {
  const config: Record<TherapyType, BadgeVariant> = {
    [TherapyType.CAR_T]: 'danger',
    [TherapyType.TCR_T]: 'pink',
    [TherapyType.GENE_THERAPY]: 'default',
    [TherapyType.GENE_EDITING]: 'purple',
    [TherapyType.STEM_CELL]: 'teal',
    [TherapyType.NK_CELL]: 'orange',
    [TherapyType.TIL]: 'warning',
    [TherapyType.DENDRITIC_CELL]: 'info',
    [TherapyType.OTHER_CELL]: 'neutral',
  };
  return <Badge variant={config[type] ?? 'neutral'}>{type}</Badge>;
};

// Disease Category Badge
export const DiseaseBadge: React.FC<{ category: DiseaseCategory }> = ({ category }) => {
  const config: Record<DiseaseCategory, BadgeVariant> = {
    [DiseaseCategory.ONCOLOGY]: 'danger',
    [DiseaseCategory.HEMATOLOGY]: 'purple',
    [DiseaseCategory.NEUROLOGY]: 'default',
    [DiseaseCategory.METABOLIC]: 'orange',
    [DiseaseCategory.IMMUNOLOGY]: 'teal',
    [DiseaseCategory.OPHTHALMOLOGY]: 'warning',
    [DiseaseCategory.MUSCULOSKELETAL]: 'info',
    [DiseaseCategory.CARDIOVASCULAR]: 'pink',
    [DiseaseCategory.PULMONARY]: 'info',
    [DiseaseCategory.RARE_DISEASE]: 'neutral',
    [DiseaseCategory.OTHER]: 'neutral',
  };
  return <Badge variant={config[category] ?? 'neutral'}>{category}</Badge>;
};
