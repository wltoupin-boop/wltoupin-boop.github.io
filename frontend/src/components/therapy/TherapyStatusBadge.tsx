import React from 'react';
import { FDAApprovalStatus } from '@/types/therapy';
import { FDAStatusBadge } from '@/components/ui/Badge';

interface TherapyStatusBadgeProps {
  status: FDAApprovalStatus;
}

export const TherapyStatusBadge: React.FC<TherapyStatusBadgeProps> = ({ status }) => {
  return <FDAStatusBadge status={status} />;
};
