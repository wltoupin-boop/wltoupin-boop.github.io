import { useQuery } from '@tanstack/react-query';
import { useAuthState } from '@/lib/auth';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AppUser } from '@/types/user';

export const useAuth = () => {
  const { user: firebaseUser, loading: authLoading, error: authError } = useAuthState();

  const {
    data: appUser,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<AppUser>({
    queryKey: queryKeys.users.me(),
    queryFn: usersApi.getMe,
    enabled: !!firebaseUser,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isLoading = authLoading || (!!firebaseUser && profileLoading);
  const error = authError ?? (profileError as Error | null);

  return {
    firebaseUser,
    appUser,
    isLoading,
    error,
    isAuthenticated: !!firebaseUser,
    isAdmin: appUser?.role === 'admin',
    isInstitutionAdmin: appUser?.role === 'institution_admin' || appUser?.role === 'admin',
  };
};
