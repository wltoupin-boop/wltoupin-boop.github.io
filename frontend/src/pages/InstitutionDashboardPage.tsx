import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Clock, Eye, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { MilestoneTimeline } from '@/components/dashboard/MilestoneTimeline';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { useInstitution, useOperationalSummary, useInstitutionOperational } from '@/hooks/useInstitution';
import { useUpcomingMilestones } from '@/hooks/useTherapies';
import { formatDate } from '@/lib/utils';
import type { OperationalReadiness } from '@/types/user';

const priorityVariant = (p: string) =>
  p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'neutral';

export const InstitutionDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const institutionId = appUser?.institution_id ?? '';

  const { data: institution, isLoading: instLoading } = useInstitution(institutionId);
  const { data: summary } = useOperationalSummary(institutionId);
  const { data: operational, isLoading: opLoading } = useInstitutionOperational(institutionId);
  const { data: milestones } = useUpcomingMilestones(90);

  const therapyNames: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    operational?.forEach((op) => {
      if (op.therapy) map[op.therapy_id] = op.therapy.product_name;
    });
    return map;
  }, [operational]);

  if (!institutionId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-lg font-semibold text-neutral-900">No Institution Linked</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Contact your administrator to link your account to an institution.
        </p>
      </div>
    );
  }

  if (instLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  const highPriority = operational?.filter((op) => op.priority === 'high') ?? [];
  const readyToTreat = operational?.filter(
    (op) => op.current_stage === 'Active Treatment' || op.current_stage === 'Treatment Initiation'
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {institution?.name ?? 'Institution Dashboard'}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {institution?.type} · {institution?.city}, {institution?.state}
          </p>
        </div>
        <Button
          leftIcon={<Activity className="h-4 w-4" />}
          onClick={() => navigate('/operational')}
        >
          Operational Tracker
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Tracked"
          value={summary?.total_tracked ?? operational?.length ?? 0}
          icon={<Building2 className="h-6 w-6" />}
          variant="primary"
        />
        <StatCard
          label="Ready to Treat"
          value={summary?.ready_to_treat ?? readyToTreat.length}
          icon={<CheckCircle2 className="h-6 w-6" />}
          variant="success"
        />
        <StatCard
          label="In Preparation"
          value={summary?.in_preparation ?? 0}
          icon={<Clock className="h-6 w-6" />}
          variant="warning"
        />
        <StatCard
          label="Monitoring Only"
          value={summary?.monitoring_only ?? 0}
          icon={<Eye className="h-6 w-6" />}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* High Priority therapies */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => navigate('/operational')}
                >
                  View all
                </Button>
              }
            >
              <AlertTriangle className="h-5 w-5 text-warning-600" />
              <h2 className="text-base font-semibold text-neutral-900">High Priority Therapies</h2>
            </CardHeader>
            <CardBody className="p-0">
              {opLoading ? (
                <div className="flex justify-center py-8"><Spinner size="sm" /></div>
              ) : highPriority.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">No high priority therapies</p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {highPriority.map((op) => (
                    <OperationalRow
                      key={op.id}
                      operational={op}
                      onClick={() => navigate(`/catalog/${op.therapy_id}`)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Milestones */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-neutral-900">Upcoming Milestones</h2>
            </CardHeader>
            <CardBody>
              <MilestoneTimeline
                milestones={milestones ?? []}
                therapyNames={therapyNames}
                maxItems={6}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* All tracked therapies */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-neutral-900">All Tracked Therapies</h2>
        </CardHeader>
        <CardBody className="p-0">
          {opLoading ? (
            <div className="flex justify-center py-8"><Spinner size="sm" /></div>
          ) : !operational || operational.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-400">
              No therapies tracked. Start by adding therapies from the catalog.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {operational.map((op) => (
                <OperationalRow
                  key={op.id}
                  operational={op}
                  onClick={() => navigate(`/catalog/${op.therapy_id}`)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

interface OperationalRowProps {
  operational: OperationalReadiness;
  onClick: () => void;
}

const OperationalRow: React.FC<OperationalRowProps> = ({ operational, onClick }) => {
  const stagePercent = Math.round(((operational.stage_index + 1) / 23) * 100);

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {operational.therapy?.product_name ?? operational.therapy_id}
          </p>
          <Badge variant={priorityVariant(operational.priority)}>
            {operational.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden max-w-[120px]">
            <div
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${stagePercent}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">{operational.current_stage}</span>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-neutral-500">
        {operational.primary_owner && (
          <p className="font-medium text-neutral-700">{operational.primary_owner}</p>
        )}
        {operational.due_date && (
          <p className="text-neutral-400">Due {formatDate(operational.due_date)}</p>
        )}
      </div>
    </div>
  );
};
