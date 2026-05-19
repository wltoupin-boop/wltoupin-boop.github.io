import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { TherapyCard } from './TherapyCard';
import type { Therapy } from '@/types/therapy';
import { cn } from '@/lib/utils';

interface TherapyListProps {
  therapies: Therapy[];
  isLoading?: boolean;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  total?: number;
}

const SkeletonCard = () => (
  <div className="animate-pulse rounded-lg border border-neutral-200 bg-white p-4">
    <div className="mb-3 flex items-start gap-2">
      <div className="flex-1">
        <div className="mb-2 h-5 w-3/4 rounded bg-neutral-200" />
        <div className="h-4 w-1/2 rounded bg-neutral-100" />
      </div>
    </div>
    <div className="mb-3 flex flex-wrap gap-1.5">
      {[80, 60, 70, 90].map((w) => (
        <div key={w} className="h-5 rounded-full bg-neutral-200" style={{ width: w }} />
      ))}
    </div>
    <div className="h-4 w-full rounded bg-neutral-100" />
    <div className="mt-1 h-4 w-5/6 rounded bg-neutral-100" />
  </div>
);

const SkeletonRow = () => (
  <div className="animate-pulse flex items-center gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
    <div className="flex-1">
      <div className="mb-1.5 h-4 w-1/3 rounded bg-neutral-200" />
      <div className="h-3 w-1/2 rounded bg-neutral-100" />
    </div>
    <div className="hidden gap-2 sm:flex">
      {[60, 80, 70, 90].map((w) => (
        <div key={w} className="h-5 rounded-full bg-neutral-100" style={{ width: w }} />
      ))}
    </div>
  </div>
);

export const TherapyList: React.FC<TherapyListProps> = ({
  therapies,
  isLoading,
  layout,
  onLayoutChange,
  total,
}) => {
  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {isLoading ? 'Loading…' : `${total ?? therapies.length} therapies`}
        </p>
        <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
          <button
            onClick={() => onLayoutChange('list')}
            className={cn(
              'rounded p-1.5 transition-colors',
              layout === 'list'
                ? 'bg-primary-100 text-primary-700'
                : 'text-neutral-400 hover:text-neutral-700'
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => onLayoutChange('grid')}
            className={cn(
              'rounded p-1.5 transition-colors',
              layout === 'grid'
                ? 'bg-primary-100 text-primary-700'
                : 'text-neutral-400 hover:text-neutral-700'
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          className={cn(
            layout === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-2'
          )}
        >
          {Array.from({ length: 6 }).map((_, i) =>
            layout === 'grid' ? <SkeletonCard key={i} /> : <SkeletonRow key={i} />
          )}
        </div>
      )}

      {/* Empty */}
      {!isLoading && therapies.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-neutral-100 p-6">
            <List className="h-8 w-8 text-neutral-400" />
          </div>
          <h3 className="text-base font-medium text-neutral-900">No therapies found</h3>
          <p className="mt-1 text-sm text-neutral-500">Try adjusting your filters or search query.</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && therapies.length > 0 && (
        <div
          className={cn(
            layout === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-2'
          )}
        >
          {therapies.map((therapy) => (
            <TherapyCard key={therapy.id} therapy={therapy} layout={layout} />
          ))}
        </div>
      )}
    </div>
  );
};
