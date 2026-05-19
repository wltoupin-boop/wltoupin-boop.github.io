import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { TherapyList } from '@/components/therapy/TherapyList';
import { TherapyFilters } from '@/components/therapy/TherapyFilters';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { useTherapies } from '@/hooks/useTherapies';
import type { TherapySearchParams } from '@/types/therapy';

export const TherapyCatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filterParams, setFilterParams] = useState<TherapySearchParams>({
    q: searchParams.get('q') ?? undefined,
    sort_by: 'updated_at',
    sort_order: 'desc',
    page: 1,
    page_size: 18,
  });

  const { data, isLoading } = useTherapies(filterParams);

  const handleSearch = useCallback((query: string) => {
    setFilterParams((prev) => ({ ...prev, q: query || undefined, page: 1 }));
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  }, [setSearchParams]);

  const handlePageChange = (page: number) => {
    setFilterParams((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = data?.pages ?? 1;
  const currentPage = filterParams.page ?? 1;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Therapy Catalog</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Browse and filter cell & gene therapies
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setFiltersOpen((p) => !p)}
        >
          {filtersOpen ? 'Hide' : 'Show'} Filters
        </Button>
      </div>

      {/* Search bar */}
      <SearchInput
        value={filterParams.q ?? ''}
        onChange={handleSearch}
        placeholder="Search by product name, manufacturer, indication, disease…"
        className="max-w-2xl"
      />

      <div className="flex gap-6 items-start">
        {/* Filter sidebar */}
        {filtersOpen && (
          <aside className="w-60 shrink-0 rounded-lg border border-neutral-200 bg-white p-4 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <TherapyFilters
              params={filterParams}
              onChange={(p) => setFilterParams({ ...p, page: 1 })}
            />
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <TherapyList
            therapies={data?.items ?? []}
            isLoading={isLoading}
            layout={layout}
            onLayoutChange={setLayout}
            total={data?.total}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                {totalPages > 7 && (
                  <span className="flex h-8 w-8 items-center justify-center text-sm text-neutral-400">
                    …
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
