import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, AlertTriangle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Therapy } from '@/types/therapy';
import { FDAStatusBadge, PhaseBadge, TherapyTypeBadge, DiseaseBadge } from '@/components/ui/Badge';
import { AILabel } from './AILabel';
import { useIsWatched, useAddToWatchlist, useRemoveFromWatchlist } from '@/hooks/useWatchlist';
import { formatDate, daysUntil, cn } from '@/lib/utils';

interface TherapyCardProps {
  therapy: Therapy;
  layout?: 'grid' | 'list';
}

export const TherapyCard: React.FC<TherapyCardProps> = ({ therapy, layout = 'grid' }) => {
  const navigate = useNavigate();
  const isWatched = useIsWatched(therapy.id);
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const handleWatchToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWatched) {
      removeFromWatchlist.mutate(therapy.id);
    } else {
      addToWatchlist.mutate({ therapyId: therapy.id, payload: { priority: 5, notify_on_updates: true } });
    }
  };

  const pdufaDays = daysUntil(therapy.pdufa_date);
  const pdufaUrgent = pdufaDays !== null && pdufaDays <= 30 && pdufaDays >= 0;
  const pdufaSoon = pdufaDays !== null && pdufaDays > 30 && pdufaDays <= 90;

  if (layout === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3',
          'cursor-pointer transition-shadow hover:shadow-sm hover:border-neutral-300'
        )}
        onClick={() => navigate(`/catalog/${therapy.id}`)}
      >
        {therapy.needs_human_review && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-neutral-900">{therapy.product_name}</h3>
            {therapy.ai_generated_fields.includes('product_name') && <AILabel />}
          </div>
          <p className="text-sm text-neutral-500 truncate">{therapy.manufacturer} · {therapy.indication}</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex shrink-0">
          <TherapyTypeBadge type={therapy.therapy_type} />
          <DiseaseBadge category={therapy.disease_category} />
          <PhaseBadge phase={therapy.clinical_phase} />
          <FDAStatusBadge status={therapy.fda_approval_status} />
        </div>
        {therapy.pdufa_date && (
          <div className={cn(
            'hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium md:flex',
            pdufaUrgent ? 'bg-red-50 text-red-700' : pdufaSoon ? 'bg-warning-50 text-warning-700' : 'bg-neutral-100 text-neutral-600'
          )}>
            <Calendar className="h-3 w-3" />
            PDUFA: {formatDate(therapy.pdufa_date)}
          </div>
        )}
        <button
          onClick={handleWatchToggle}
          className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Heart className={cn('h-4 w-4', isWatched && 'fill-red-500 text-red-500')} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col rounded-lg border border-neutral-200 bg-white shadow-sm',
        'cursor-pointer transition-all hover:shadow-md hover:border-neutral-300'
      )}
      onClick={() => navigate(`/catalog/${therapy.id}`)}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="min-w-0 flex-1">
          {therapy.needs_human_review && (
            <div className="mb-1 flex items-center gap-1 text-xs text-warning-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Needs review</span>
            </div>
          )}
          <h3 className="font-semibold text-neutral-900 leading-tight line-clamp-2">
            {therapy.product_name}
          </h3>
          {therapy.generic_name && (
            <p className="mt-0.5 text-xs text-neutral-500 italic">{therapy.generic_name}</p>
          )}
          <p className="mt-1 text-sm text-neutral-600 font-medium">{therapy.manufacturer}</p>
        </div>
        <button
          onClick={handleWatchToggle}
          className="ml-2 shrink-0 rounded-full p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Heart className={cn('h-5 w-5', isWatched && 'fill-red-500 text-red-500')} />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <TherapyTypeBadge type={therapy.therapy_type} />
        <DiseaseBadge category={therapy.disease_category} />
        <PhaseBadge phase={therapy.clinical_phase} />
        <FDAStatusBadge status={therapy.fda_approval_status} />
        {therapy.orphan_drug_designation && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
            Orphan
          </span>
        )}
        {therapy.pediatric_priority && (
          <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700">
            Pediatric
          </span>
        )}
      </div>

      {/* Indication */}
      <div className="border-t border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500 line-clamp-2">{therapy.indication}</p>
      </div>

      {/* AI Summary */}
      {therapy.ai_summary && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-medium text-neutral-600">Summary</p>
            {therapy.ai_generated_fields.includes('ai_summary') && (
              <AILabel timestamp={therapy.last_ai_review} />
            )}
          </div>
          <p className="text-xs text-neutral-500 line-clamp-3">{therapy.ai_summary}</p>
        </div>
      )}

      {/* Footer: PDUFA date */}
      {therapy.pdufa_date && (
        <div className={cn(
          'mt-auto flex items-center gap-1.5 rounded-b-lg border-t px-4 py-2 text-xs font-medium',
          pdufaUrgent
            ? 'border-red-100 bg-red-50 text-red-700'
            : pdufaSoon
            ? 'border-warning-100 bg-warning-50 text-warning-700'
            : 'border-neutral-100 bg-neutral-50 text-neutral-600'
        )}>
          <Calendar className="h-3.5 w-3.5" />
          <span>PDUFA: {formatDate(therapy.pdufa_date)}</span>
          {pdufaDays !== null && pdufaDays >= 0 && (
            <span className="ml-auto">in {pdufaDays}d</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
