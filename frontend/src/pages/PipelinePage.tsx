import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, X, ArrowRight, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PipelineVisualization } from '@/components/visualization/PipelineVisualization';
import { MilestoneTimeline } from '@/components/dashboard/MilestoneTimeline';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { FDAStatusBadge, PhaseBadge, TherapyTypeBadge, DiseaseBadge } from '@/components/ui/Badge';
import { useTherapies, useUpcomingMilestones } from '@/hooks/useTherapies';
import type { Therapy } from '@/types/therapy';
import { formatDate } from '@/lib/utils';

type ViewMode = 'pipeline' | 'timeline' | 'matrix';

export const PipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTherapy, setSelectedTherapy] = useState<Therapy | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  const { data: therapiesData, isLoading } = useTherapies({ page_size: 500 });
  const { data: milestones } = useUpcomingMilestones(180);

  const therapies = therapiesData?.items ?? [];

  const therapyNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    therapies.forEach((t) => { map[t.id] = t.product_name; });
    return map;
  }, [therapies]);

  const viewModes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'pipeline', label: 'Pipeline', icon: <GitBranch className="h-4 w-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <List className="h-4 w-4" /> },
    { id: 'matrix', label: 'Matrix', icon: <LayoutGrid className="h-4 w-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading pipeline data…" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pipeline Visualization</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {therapies.length} therapies across all development stages
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {viewModes.map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === m.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Main view */}
        <div className="flex-1 min-w-0">
          {viewMode === 'pipeline' && (
            <PipelineVisualization
              therapies={therapies}
              onTherapySelect={setSelectedTherapy}
              selectedTherapyId={selectedTherapy?.id ?? null}
              height={650}
            />
          )}

          {viewMode === 'timeline' && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
              <h2 className="text-base font-semibold text-neutral-900">
                Upcoming Milestones (Next 180 days)
              </h2>
              <MilestoneTimeline
                milestones={milestones ?? []}
                therapyNames={therapyNames}
                maxItems={50}
              />
            </div>
          )}

          {viewMode === 'matrix' && (
            <MatrixView therapies={therapies} onSelect={setSelectedTherapy} />
          )}
        </div>

        {/* Selected therapy detail panel */}
        <AnimatePresence>
          {selectedTherapy && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-80 shrink-0 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900 truncate">
                  {selectedTherapy.product_name}
                </h3>
                <button
                  onClick={() => setSelectedTherapy(null)}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-neutral-700">{selectedTherapy.manufacturer}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{selectedTherapy.indication}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <TherapyTypeBadge type={selectedTherapy.therapy_type} />
                  <DiseaseBadge category={selectedTherapy.disease_category} />
                  <PhaseBadge phase={selectedTherapy.clinical_phase} />
                  <FDAStatusBadge status={selectedTherapy.fda_approval_status} />
                </div>

                <div className="space-y-2 text-xs">
                  {selectedTherapy.pdufa_date && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">PDUFA Date</span>
                      <span className="font-medium text-neutral-900">{formatDate(selectedTherapy.pdufa_date)}</span>
                    </div>
                  )}
                  {selectedTherapy.epidemiology?.us_prevalence && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">US Prevalence</span>
                      <span className="font-medium text-neutral-900">
                        {selectedTherapy.epidemiology.us_prevalence.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Last Updated</span>
                    <span className="font-medium text-neutral-900">{formatDate(selectedTherapy.updated_at)}</span>
                  </div>
                </div>

                {selectedTherapy.ai_summary && (
                  <div className="rounded-md bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs text-amber-800 line-clamp-5">{selectedTherapy.ai_summary}</p>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => navigate(`/catalog/${selectedTherapy.id}`)}
                >
                  Full Details
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Matrix view component
interface MatrixViewProps {
  therapies: Therapy[];
  onSelect: (therapy: Therapy) => void;
}

const MATRIX_PHASES = ['Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3', 'Approved'];

const MatrixView: React.FC<MatrixViewProps> = ({ therapies, onSelect }) => {
  const diseaseCategories = [...new Set(therapies.map((t) => t.disease_category))].sort();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="sticky left-0 bg-white px-4 py-3 text-left font-semibold text-neutral-700 min-w-[140px]">
              Disease
            </th>
            {MATRIX_PHASES.map((p) => (
              <th key={p} className="px-3 py-3 text-center font-semibold text-neutral-700 whitespace-nowrap min-w-[100px]">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diseaseCategories.map((disease) => (
            <tr key={disease} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-neutral-800">
                {disease}
              </td>
              {MATRIX_PHASES.map((phase) => {
                const matching = therapies.filter(
                  (t) => t.disease_category === disease && t.clinical_phase === phase
                );
                return (
                  <td key={phase} className="px-3 py-2 text-center align-top">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {matching.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onSelect(t)}
                          title={t.product_name}
                          className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-800 hover:bg-primary-200 transition-colors max-w-[90px] truncate"
                        >
                          {t.product_name}
                        </button>
                      ))}
                      {matching.length === 0 && (
                        <span className="text-neutral-200">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
