import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, Clock } from 'lucide-react';
import type { TherapyMilestone } from '@/types/therapy';
import { formatDate, daysUntil, cn } from '@/lib/utils';

interface MilestoneTimelineProps {
  milestones: TherapyMilestone[];
  therapyNames?: Record<string, string>;
  orientation?: 'horizontal' | 'vertical';
  maxItems?: number;
}

function urgencyClass(days: number | null): string {
  if (days === null) return 'border-neutral-200 bg-neutral-50';
  if (days < 0) return 'border-neutral-200 bg-neutral-50 opacity-60';
  if (days <= 30) return 'border-red-200 bg-red-50';
  if (days <= 90) return 'border-warning-200 bg-warning-50';
  return 'border-primary-200 bg-primary-50';
}

function urgencyTextClass(days: number | null): string {
  if (days === null || days < 0) return 'text-neutral-500';
  if (days <= 30) return 'text-red-700';
  if (days <= 90) return 'text-warning-700';
  return 'text-primary-700';
}

function urgencyIcon(days: number | null) {
  if (days !== null && days <= 30 && days >= 0) return <AlertCircle className="h-4 w-4 text-red-500" />;
  if (days !== null && days <= 90 && days >= 0) return <Clock className="h-4 w-4 text-warning-500" />;
  return <Calendar className="h-4 w-4 text-primary-500" />;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  therapyNames = {},
  orientation = 'vertical',
  maxItems = 10,
}) => {
  const navigate = useNavigate();
  const sorted = [...milestones]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="mb-2 h-8 w-8 text-neutral-300" />
        <p className="text-sm text-neutral-500">No upcoming milestones</p>
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className="overflow-x-auto">
        <div className="flex gap-3 pb-2" style={{ minWidth: sorted.length * 180 }}>
          {sorted.map((m, idx) => {
            const days = daysUntil(m.date);
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/catalog/${m.therapy_id}`)}
                className={cn(
                  'flex-shrink-0 w-44 rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow',
                  urgencyClass(days)
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  {urgencyIcon(days)}
                  <span className={cn('text-xs font-semibold', urgencyTextClass(days))}>
                    {days !== null && days >= 0 ? `${days}d` : 'Past'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-neutral-900 line-clamp-2">
                  {therapyNames[m.therapy_id] ?? 'Therapy'}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{m.milestone_type}</p>
                <p className="text-xs font-medium text-neutral-700 mt-1">{formatDate(m.date)}</p>
                {idx < sorted.length - 1 && (
                  <div className="absolute right-0 top-1/2 h-px w-3 bg-neutral-300 transform translate-x-full -translate-y-1/2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((m) => {
        const days = daysUntil(m.date);
        return (
          <div
            key={m.id}
            onClick={() => navigate(`/catalog/${m.therapy_id}`)}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow',
              urgencyClass(days)
            )}
          >
            <div className="shrink-0">{urgencyIcon(days)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-semibold text-neutral-900 truncate">
                  {therapyNames[m.therapy_id] ?? 'Therapy'}
                </p>
                <span className="shrink-0 text-xs text-neutral-500">{m.milestone_type}</span>
              </div>
              {m.description && (
                <p className="text-xs text-neutral-500 truncate">{m.description}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-neutral-900">{formatDate(m.date)}</p>
              {days !== null && days >= 0 && (
                <p className={cn('text-xs font-semibold', urgencyTextClass(days))}>
                  in {days}d
                </p>
              )}
              {days !== null && days < 0 && (
                <p className="text-xs text-neutral-400">Passed</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
