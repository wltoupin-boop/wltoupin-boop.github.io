import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { WatchlistItem } from '@/types/user';
import { FDAApprovalStatus } from '@/types/therapy';
import { FDAStatusBadge } from '@/components/ui/Badge';
import { useMyWatchlist } from '@/hooks/useWatchlist';
import { Spinner } from '@/components/ui/Spinner';

export const WatchlistSummary: React.FC = () => {
  const navigate = useNavigate();
  const { data: watchlist, isLoading } = useMyWatchlist();

  const grouped = React.useMemo(() => {
    if (!watchlist) return {};
    return watchlist.reduce<Record<string, WatchlistItem[]>>((acc, item) => {
      const status = item.therapy?.fda_approval_status ?? 'Unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(item);
      return acc;
    }, {});
  }, [watchlist]);

  if (isLoading) return <Spinner size="sm" />;

  if (!watchlist || watchlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Heart className="mb-2 h-8 w-8 text-neutral-300" />
        <p className="text-sm text-neutral-500">Your watchlist is empty</p>
        <button
          onClick={() => navigate('/catalog')}
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Browse therapies
        </button>
      </div>
    );
  }

  const approvedItems = watchlist.filter(
    (i) => i.therapy?.fda_approval_status === FDAApprovalStatus.APPROVED
  );
  const pendingItems = watchlist.filter(
    (i) =>
      i.therapy?.fda_approval_status &&
      [FDAApprovalStatus.PRIORITY_REVIEW, FDAApprovalStatus.BLA_SUBMITTED].includes(
        i.therapy.fda_approval_status as FDAApprovalStatus
      )
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm text-neutral-600">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-accent-600" />
          {approvedItems.length} approved
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-4 w-4 text-primary-500" />
          {pendingItems.length} pending FDA action
        </span>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {watchlist.slice(0, 8).map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/catalog/${item.therapy_id}`)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500">
              {item.priority}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
              {item.therapy?.product_name ?? item.therapy_id}
            </span>
            {item.therapy?.fda_approval_status && (
              <span className="shrink-0">
                <FDAStatusBadge status={item.therapy.fda_approval_status} />
              </span>
            )}
          </button>
        ))}
      </div>

      {watchlist.length > 8 && (
        <button
          onClick={() => navigate('/watchlist')}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-sm text-primary-600 hover:bg-primary-50"
        >
          View all {watchlist.length} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
