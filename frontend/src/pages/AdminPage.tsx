import React, { useState } from 'react';
import {
  ShieldCheck,
  PlayCircle,
  RefreshCw,
  Users,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { useTherapies, useTriggerIngestion, useDeleteTherapy } from '@/hooks/useTherapies';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { UserRole } from '@/types/user';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldCheck className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-lg font-semibold text-neutral-900">Access Denied</h2>
        <p className="mt-2 text-sm text-neutral-500">You need admin privileges to access this page.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
          <ShieldCheck className="h-6 w-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Admin Panel</h1>
          <p className="text-sm text-neutral-500">Platform management and configuration</p>
        </div>
      </div>

      <Tabs defaultTab="ingestion">
        <TabList>
          <Tab id="ingestion" icon={<RefreshCw className="h-4 w-4" />}>Ingestion</Tab>
          <Tab id="therapies" icon={<FlaskConical className="h-4 w-4" />}>Therapies</Tab>
          <Tab id="users" icon={<Users className="h-4 w-4" />}>Users</Tab>
          <Tab id="review-queue" icon={<AlertTriangle className="h-4 w-4" />}>AI Review Queue</Tab>
        </TabList>

        <TabPanel id="ingestion" className="pt-5">
          <IngestionPanel />
        </TabPanel>
        <TabPanel id="therapies" className="pt-5">
          <TherapyManagementPanel />
        </TabPanel>
        <TabPanel id="users" className="pt-5">
          <UserManagementPanel />
        </TabPanel>
        <TabPanel id="review-queue" className="pt-5">
          <AIReviewQueuePanel />
        </TabPanel>
      </Tabs>
    </div>
  );
};

// ─── Ingestion Panel ──────────────────────────────────────────────────────────
const IngestionPanel: React.FC = () => {
  const triggerIngestion = useTriggerIngestion();
  const [jobId, setJobId] = useState<string | null>(null);

  const handleTrigger = () => {
    triggerIngestion.mutate(undefined, {
      onSuccess: (data) => setJobId(data.job_id),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-neutral-900">Data Ingestion</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-neutral-600">
            Trigger a manual data ingestion to pull latest therapy data from FDA and clinical trial sources.
            This process typically takes 5–15 minutes.
          </p>

          <div className="flex items-center gap-4">
            <Button
              leftIcon={<PlayCircle className="h-4 w-4" />}
              loading={triggerIngestion.isPending}
              onClick={handleTrigger}
            >
              Trigger Ingestion
            </Button>
            {jobId && (
              <div className="flex items-center gap-2 text-sm text-accent-700">
                <CheckCircle2 className="h-4 w-4" />
                Job started: <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">{jobId}</code>
              </div>
            )}
          </div>

          {triggerIngestion.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {(triggerIngestion.error as Error).message}
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Ingestion Sources</h3>
            <ul className="space-y-1 text-sm text-neutral-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-500" />
                FDA Drugs@FDA database
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-500" />
                ClinicalTrials.gov (NCT data)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-500" />
                FDA approval letters & labels
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent-500" />
                AI summarization pipeline
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

// ─── Therapy Management Panel ─────────────────────────────────────────────────
const TherapyManagementPanel: React.FC = () => {
  const navigate = useNavigate();
  const { data: therapies, isLoading } = useTherapies({ page_size: 50, sort_by: 'updated_at', sort_order: 'desc' });
  const deleteTherapy = useDeleteTherapy();
  const [deleteModal, setDeleteModal] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{therapies?.total ?? 0} total therapies</p>
        <Button size="sm" leftIcon={<FlaskConical className="h-4 w-4" />}>
          Add Therapy
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="sm" /></div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {therapies?.items.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{t.product_name}</p>
                    <p className="text-xs text-neutral-500">{t.manufacturer} · {formatDate(t.updated_at)}</p>
                  </div>
                  {t.needs_human_review && (
                    <Badge variant="warning" size="sm">Needs Review</Badge>
                  )}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/catalog/${t.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteModal(t.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to delete this therapy? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteTherapy.isPending}
              onClick={() => {
                if (deleteModal) {
                  deleteTherapy.mutate(deleteModal, {
                    onSuccess: () => setDeleteModal(null),
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─── User Management Panel ────────────────────────────────────────────────────
const UserManagementPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: usersApi.listUsers,
    staleTime: 60 * 1000,
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      usersApi.updateUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });

  const roleOptions = Object.values(UserRole).map((r) => ({ value: r, label: r }));

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-neutral-900">User Management</h2>
      </CardHeader>
      <CardBody className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {users?.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 shrink-0">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{user.display_name}</p>
                  <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                </div>
                <div className="w-40 shrink-0">
                  <Select
                    options={roleOptions}
                    value={user.role}
                    onChange={(e) => updateRole.mutate({ userId: user.id, role: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

// ─── AI Review Queue ──────────────────────────────────────────────────────────
const AIReviewQueuePanel: React.FC = () => {
  const { data: therapies, isLoading } = useTherapies({
    needs_review: true,
    page_size: 50,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning-600" />
          <p className="text-sm font-medium text-warning-800">
            {therapies?.total ?? 0} therapies flagged for human review
          </p>
        </div>
        <p className="mt-1 text-xs text-warning-600">
          These therapies have AI-generated fields that need verification before being marked as authoritative.
        </p>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="sm" /></div>
          ) : (therapies?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-accent-400" />
              <p className="text-sm text-neutral-500">All caught up! No items need review.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {therapies?.items.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{t.product_name}</p>
                    <p className="text-xs text-neutral-500">
                      AI fields: {t.ai_generated_fields.join(', ')} ·
                      Last review: {formatDate(t.last_ai_review)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/catalog/${t.id}`}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Review
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
