import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { therapiesApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { TherapySearchParams, Therapy } from '@/types/therapy';

export const useTherapies = (params?: TherapySearchParams) => {
  return useQuery({
    queryKey: queryKeys.therapies.list(params),
    queryFn: () => therapiesApi.getTherapies(params),
    staleTime: 2 * 60 * 1000,
  });
};

export const useTherapy = (id: string) => {
  return useQuery({
    queryKey: queryKeys.therapies.detail(id),
    queryFn: () => therapiesApi.getTherapy(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useTherapyMilestones = (id: string) => {
  return useQuery({
    queryKey: queryKeys.therapies.milestones(id),
    queryFn: () => therapiesApi.getTherapyMilestones(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
};

export const useUpcomingMilestones = (days = 90) => {
  return useQuery({
    queryKey: queryKeys.therapies.upcomingMilestones(days),
    queryFn: () => therapiesApi.getUpcomingMilestones(days),
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateTherapy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Therapy>) => therapiesApi.createTherapy(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.therapies.lists() });
    },
  });
};

export const useUpdateTherapy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Therapy> }) =>
      therapiesApi.updateTherapy(id, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.therapies.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.therapies.lists() });
    },
  });
};

export const useDeleteTherapy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => therapiesApi.deleteTherapy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.therapies.lists() });
    },
  });
};

export const useTriggerIngestion = () => {
  return useMutation({
    mutationFn: therapiesApi.triggerIngestion,
  });
};
