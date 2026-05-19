import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { institutionsApi, operationalApi, type OperationalUpsertPayload } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Institution } from '@/types/user';

export const useInstitution = (id: string) => {
  return useQuery({
    queryKey: queryKeys.institutions.detail(id),
    queryFn: () => institutionsApi.getInstitution(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
};

export const useInstitutionDashboard = (id: string) => {
  return useQuery({
    queryKey: queryKeys.institutions.dashboard(id),
    queryFn: () => institutionsApi.getInstitutionDashboard(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useInstitutionTherapies = (id: string) => {
  return useQuery({
    queryKey: queryKeys.institutions.therapies(id),
    queryFn: () => institutionsApi.getInstitutionTherapies(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateInstitution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Institution> }) =>
      institutionsApi.updateInstitution(id, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.institutions.detail(id) });
    },
  });
};

export const useOperationalReadiness = (institutionId: string, therapyId: string) => {
  return useQuery({
    queryKey: queryKeys.operational.readiness(institutionId, therapyId),
    queryFn: () => operationalApi.getOperationalReadiness(institutionId, therapyId),
    enabled: !!institutionId && !!therapyId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useUpsertOperational = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OperationalUpsertPayload) => operationalApi.upsertOperational(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operational.readiness(data.institution_id, data.therapy_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operational.summary(data.institution_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operational.institution(data.institution_id),
      });
    },
  });
};

export const useOperationalSummary = (institutionId: string) => {
  return useQuery({
    queryKey: queryKeys.operational.summary(institutionId),
    queryFn: () => operationalApi.getOperationalSummary(institutionId),
    enabled: !!institutionId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useInstitutionOperational = (institutionId: string) => {
  return useQuery({
    queryKey: queryKeys.operational.institution(institutionId),
    queryFn: () => operationalApi.getInstitutionOperational(institutionId),
    enabled: !!institutionId,
    staleTime: 2 * 60 * 1000,
  });
};
