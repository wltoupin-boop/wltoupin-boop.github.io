import React from 'react';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import {
  TherapyType,
  DiseaseCategory,
  FDAApprovalStatus,
  ClinicalPhase,
  type TherapySearchParams,
} from '@/types/therapy';
import { cn } from '@/lib/utils';

interface TherapyFiltersProps {
  params: TherapySearchParams;
  onChange: (params: TherapySearchParams) => void;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-neutral-200 py-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between text-sm font-medium text-neutral-900"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
};

function toggleArrayItem<T>(arr: T[] | undefined, item: T): T[] {
  const current = arr ?? [];
  return current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
}

export const TherapyFilters: React.FC<TherapyFiltersProps> = ({ params, onChange }) => {
  const activeFilterCount = [
    params.therapy_type?.length,
    params.disease_category?.length,
    params.fda_approval_status?.length,
    params.clinical_phase?.length,
    params.pediatric_only ? 1 : 0,
    params.rare_disease_only ? 1 : 0,
    params.manufacturer ? 1 : 0,
  ].filter(Boolean).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);

  const clearAll = () =>
    onChange({
      sort_by: params.sort_by,
      sort_order: params.sort_order,
      page: 1,
      page_size: params.page_size,
    });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Filter className="h-4 w-4" />
          Filters
          {(activeFilterCount ?? 0) > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
        {(activeFilterCount ?? 0) > 0 && (
          <button onClick={clearAll} className="text-xs text-primary-600 hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Applied filter chips */}
      {(activeFilterCount ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {params.therapy_type?.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
            >
              {t}
              <button
                onClick={() => onChange({ ...params, therapy_type: toggleArrayItem(params.therapy_type, t), page: 1 })}
                className="ml-0.5 text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {params.disease_category?.map((d) => (
            <span
              key={d}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
            >
              {d}
              <button
                onClick={() => onChange({ ...params, disease_category: toggleArrayItem(params.disease_category, d), page: 1 })}
                className="ml-0.5 text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {params.pediatric_only && (
            <span className="flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-1 text-xs text-pink-700">
              Pediatric
              <button onClick={() => onChange({ ...params, pediatric_only: false, page: 1 })} className="ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {params.rare_disease_only && (
            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs text-purple-700">
              Rare Disease
              <button onClick={() => onChange({ ...params, rare_disease_only: false, page: 1 })} className="ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Sort */}
      <FilterSection title="Sort By">
        <select
          value={`${params.sort_by ?? 'updated_at'}|${params.sort_order ?? 'desc'}`}
          onChange={(e) => {
            const [sort_by, sort_order] = e.target.value.split('|') as [TherapySearchParams['sort_by'], 'asc' | 'desc'];
            onChange({ ...params, sort_by, sort_order, page: 1 });
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="updated_at|desc">Recently Updated</option>
          <option value="name|asc">Name (A–Z)</option>
          <option value="name|desc">Name (Z–A)</option>
          <option value="pdufa_date|asc">PDUFA Date (Soonest)</option>
          <option value="approval_date|desc">Approval Date (Newest)</option>
          <option value="impact_score|desc">Impact Score</option>
        </select>
      </FilterSection>

      {/* Therapy Type */}
      <FilterSection title="Therapy Type">
        <div className="space-y-1.5">
          {Object.values(TherapyType).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={params.therapy_type?.includes(t) ?? false}
                onChange={() => onChange({ ...params, therapy_type: toggleArrayItem(params.therapy_type, t), page: 1 })}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">{t}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Disease Category */}
      <FilterSection title="Disease Category">
        <div className="space-y-1.5">
          {Object.values(DiseaseCategory).map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={params.disease_category?.includes(d) ?? false}
                onChange={() => onChange({ ...params, disease_category: toggleArrayItem(params.disease_category, d), page: 1 })}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">{d}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* FDA Status */}
      <FilterSection title="FDA Status" defaultOpen={false}>
        <div className="space-y-1.5">
          {Object.values(FDAApprovalStatus).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={params.fda_approval_status?.includes(s) ?? false}
                onChange={() => onChange({ ...params, fda_approval_status: toggleArrayItem(params.fda_approval_status, s), page: 1 })}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">{s}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Clinical Phase */}
      <FilterSection title="Clinical Phase" defaultOpen={false}>
        <div className="space-y-1.5">
          {Object.values(ClinicalPhase).map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={params.clinical_phase?.includes(p) ?? false}
                onChange={() => onChange({ ...params, clinical_phase: toggleArrayItem(params.clinical_phase, p), page: 1 })}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">{p}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Special designations */}
      <FilterSection title="Designations" defaultOpen={false}>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={params.pediatric_only ?? false}
              onChange={(e) => onChange({ ...params, pediatric_only: e.target.checked, page: 1 })}
              className={cn('rounded border-neutral-300 text-primary-600 focus:ring-primary-500')}
            />
            <span className="text-neutral-700">Pediatric priority</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={params.rare_disease_only ?? false}
              onChange={(e) => onChange({ ...params, rare_disease_only: e.target.checked, page: 1 })}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-neutral-700">Rare / Orphan disease</span>
          </label>
        </div>
      </FilterSection>

      {/* Manufacturer search */}
      <FilterSection title="Manufacturer" defaultOpen={false}>
        <input
          type="text"
          placeholder="Search manufacturer…"
          value={params.manufacturer ?? ''}
          onChange={(e) => onChange({ ...params, manufacturer: e.target.value || undefined, page: 1 })}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </FilterSection>
    </div>
  );
};
