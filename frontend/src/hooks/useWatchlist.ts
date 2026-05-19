import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi, type WatchlistAddPayload } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export const useMyWatchlist = () => {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.watchlist.mine(),
    queryFn: watchlistApi.getMyWatchlist,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
};

export const useAddToWatchlist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ therapyId, payload }: { therapyId: string; payload: WatchlistAddPayload }) =>
      watchlistApi.addToWatchlist(therapyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.mine() });
    },
  });
};

export const useRemoveFromWatchlist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (therapyId: string) => watchlistApi.removeFromWatchlist(therapyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.mine() });
    },
  });
};

export const useUpdateWatchlistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ therapyId, payload }: { therapyId: string; payload: Partial<WatchlistAddPayload> }) =>
      watchlistApi.updateWatchlistItem(therapyId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.mine() });
    },
  });
};

export const useIsWatched = (therapyId: string): boolean => {
  const { data: watchlist } = useMyWatchlist();
  return watchlist?.some((item) => item.therapy_id === therapyId) ?? false;
};
