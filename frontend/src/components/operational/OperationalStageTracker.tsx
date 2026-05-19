import React from 'react';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { OPERATIONAL_STAGES_ORDERED, type OperationalReadiness } from '@/types/user';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

interface OperationalStageTrackerProps {
  operational: OperationalReadiness;
  onStageClick?: (stage: string, index: number) => void;
  compact?: boolean;
}

export const OperationalStageTracker: React.FC<OperationalStageTrackerProps> = ({
  operational,
  onStageClick,
  compact = false,
}) => {
  const currentIndex = operational.stage_index;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Stage {currentIndex + 1} of {OPERATIONAL_STAGES_ORDERED.length}</span>
          <span>{Math.round(((currentIndex + 1) / OPERATIONAL_STAGES_ORDERED.length) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / OPERATIONAL_STAGES_ORDERED.length) * 100}%` }}
          />
        </div>
        <p className="text-xs font-medium text-neutral-700">{operational.current_stage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
        <span className="font-medium">{operational.current_stage}</span>
        <span className="text-xs text-neutral-400">
          Stage {currentIndex + 1} / {OPERATIONAL_STAGES_ORDERED.length}
        </span>
      </div>

      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-700"
          style={{ width: `${((currentIndex + 1) / OPERATIONAL_STAGES_ORDERED.length) * 100}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {OPERATIONAL_STAGES_ORDERED.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <button
              key={stage}
              onClick={() => onStageClick?.(stage, idx)}
              disabled={!onStageClick}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                isCurrent && 'bg-primary-50 border border-primary-200',
                isCompleted && 'text-neutral-500 hover:bg-neutral-50',
                isFuture && 'text-neutral-400',
                onStageClick && !isFuture && 'cursor-pointer',
                !onStageClick && 'cursor-default'
              )}
            >
              <span className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-accent-500" />
                ) : isCurrent ? (
                  <div className="h-5 w-5 rounded-full border-2 border-primary-600 bg-primary-600 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-neutral-300" />
                )}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  isCurrent && 'font-semibold text-primary-800',
                  isCompleted && 'line-through'
                )}
              >
                {stage}
              </span>
              {isCurrent && (
                <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Current
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current stage details */}
      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-primary-600" />
          Current Stage Details
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {operational.primary_owner && (
            <div>
              <p className="text-neutral-500">Primary Owner</p>
              <p className="font-medium text-neutral-800">{operational.primary_owner}</p>
            </div>
          )}
          {operational.secondary_owner && (
            <div>
              <p className="text-neutral-500">Secondary Owner</p>
              <p className="font-medium text-neutral-800">{operational.secondary_owner}</p>
            </div>
          )}
          {operational.due_date && (
            <div>
              <p className="text-neutral-500">Due Date</p>
              <p className="font-medium text-neutral-800">{formatDate(operational.due_date)}</p>
            </div>
          )}
          {operational.center_role && (
            <div>
              <p className="text-neutral-500">Center Role</p>
              <p className="font-medium text-neutral-800">{operational.center_role}</p>
            </div>
          )}
        </div>
        {operational.next_action && (
          <div>
            <p className="text-xs text-neutral-500">Next Action</p>
            <p className="text-sm text-neutral-800">{operational.next_action}</p>
          </div>
        )}
        {operational.barriers && (
          <div>
            <p className="text-xs text-neutral-500">Barriers</p>
            <p className="text-sm text-red-700 bg-red-50 rounded p-2">{operational.barriers}</p>
          </div>
        )}
      </div>
    </div>
  );
};
