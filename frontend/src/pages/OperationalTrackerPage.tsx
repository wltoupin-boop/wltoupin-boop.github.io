import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Activity,
} from 'lucide-react';
import { OperationalStageTracker } from '@/components/operational/OperationalStageTracker';
import { OperationalForm } from '@/components/operational/OperationalForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { useInstitutionOperational, useUpsertOperational } from '@/hooks/useInstitution';
import type { OperationalUpsertPayload } from '@/lib/api';
import { OPERATIONAL_STAGES_ORDERED } from '@/types/user';
import type { OperationalReadiness } from '@/types/user';
import { formatDate } from '@/lib/utils';

const priorityVariant = (p: string) =>
  p === 'high' ? ('danger' as const) : p === 'medium' ? ('warning' as const) : ('neutral' as const);

export const OperationalTrackerPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const institutionId = appUser?.institution_id ?? '';

  const { data: operational, isLoading } = useInstitutionOperational(institutionId);
  const upsertOperational = useUpsertOperational();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const filtered = React.useMemo(() => {
    return (operational ?? []).filter((op) => {
      if (filterStage && op.current_stage !== filterStage) return false;
      if (filterOwner && op.primary_owner !== filterOwner) return false;
      if (filterPriority && op.priority !== filterPriority) return false;
      return true;
    });
  }, [operational, filterStage, filterOwner, filterPriority]);

  const owners = React.useMemo(() => {
    const set = new Set(
      (operational ?? []).map((op) => op.primary_owner).filter(Boolean) as string[]
    );
    return [...set].sort();
  }, [operational]);

  const exportCSV = useCallback(() => {
    const headers = [
      'Therapy', 'Stage', 'Priority', 'Owner', 'Next Action', 'Due Date', 'Center Role', 'Est. Patients',
    ];
    const rows = (operational ?? []).map((op) => [
      op.therapy?.product_name ?? op.therapy_id,
      op.current_stage,
      op.priority,
      op.primary_owner ?? '',
      op.next_action ?? '',
      op.due_date ? formatDate(op.due_date) : '',
      op.center_role ?? '',
      op.estimated_patient_volume ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operational-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [operational]);

  if (!institutionId) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500">Link your account to an institution to use the tracker.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Operational Tracker</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {filtered.length} of {operational?.length ?? 0} therapies
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={exportCSV}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Filter className="h-4 w-4" />
            Filter:
          </div>
          <div className="w-48">
            <Select
              options={[
                { value: '', label: 'All stages' },
                ...OPERATIONAL_STAGES_ORDERED.map((s) => ({ value: s, label: s })),
              ]}
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              options={[
                { value: '', label: 'All priorities' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              options={[
                { value: '', label: 'All owners' },
                ...owners.map((o) => ({ value: o, label: o })),
              ]}
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            />
          </div>
          {(filterStage || filterOwner || filterPriority) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterStage(''); setFilterOwner(''); setFilterPriority(''); }}
            >
              Clear filters
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-neutral-500">No therapies match the current filters.</p>
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="divide-y divide-neutral-100">
              {filtered.map((op) => (
                <OperationalTrackerRow
                  key={op.id}
                  operational={op}
                  isExpanded={expandedId === op.id}
                  isEditing={editingId === op.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === op.id ? null : op.id))
                  }
                  onEdit={() => setEditingId(op.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSubmitEdit={(payload) => {
                    upsertOperational.mutate(payload, {
                      onSuccess: () => setEditingId(null),
                    });
                  }}
                  isSubmitting={upsertOperational.isPending}
                  institutionId={institutionId}
                  onTherapyClick={() => navigate(`/catalog/${op.therapy_id}`)}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

interface RowProps {
  operational: OperationalReadiness;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (payload: OperationalUpsertPayload) => void;
  isSubmitting: boolean;
  institutionId: string;
  onTherapyClick: () => void;
}

const OperationalTrackerRow: React.FC<RowProps> = ({
  operational,
  isExpanded,
  isEditing,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  isSubmitting,
  institutionId,
  onTherapyClick,
}) => {
  const stagePercent = Math.round(((operational.stage_index + 1) / 23) * 100);

  return (
    <div>
      {/* Row summary */}
      <div
        className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onTherapyClick(); }}
              className="text-sm font-semibold text-primary-700 hover:underline truncate"
            >
              {operational.therapy?.product_name ?? operational.therapy_id}
            </button>
            <Badge variant={priorityVariant(operational.priority)} size="sm">
              {operational.priority}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${stagePercent}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500">{operational.current_stage}</span>
            </div>
            {operational.primary_owner && (
              <span className="text-xs text-neutral-400">· {operational.primary_owner}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs">
          {operational.due_date && (
            <p className="text-neutral-500">Due: {formatDate(operational.due_date)}</p>
          )}
          {operational.center_role && (
            <p className="text-neutral-400">{operational.center_role}</p>
          )}
        </div>
        <div className="shrink-0 text-neutral-400">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          {isEditing ? (
            <OperationalForm
              institutionId={institutionId}
              therapyId={operational.therapy_id}
              existing={operational}
              isSubmitting={isSubmitting}
              onCancel={onCancelEdit}
              onSubmit={onSubmitEdit}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  Edit Status
                </Button>
              </div>
              <OperationalStageTracker operational={operational} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
