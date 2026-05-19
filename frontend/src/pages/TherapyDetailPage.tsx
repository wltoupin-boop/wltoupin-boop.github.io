import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, AlertTriangle, ExternalLink, Calendar,
  FileText, Globe, Users, Activity, FlaskConical, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge, FDAStatusBadge, PhaseBadge, TherapyTypeBadge, DiseaseBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { AILabel } from '@/components/therapy/AILabel';
import { OperationalStageTracker } from '@/components/operational/OperationalStageTracker';
import { OperationalForm } from '@/components/operational/OperationalForm';
import { useTherapy } from '@/hooks/useTherapies';
import { useIsWatched, useAddToWatchlist, useRemoveFromWatchlist } from '@/hooks/useWatchlist';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalReadiness, useUpsertOperational } from '@/hooks/useInstitution';
import { formatDate, daysUntil } from '@/lib/utils';

export const TherapyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();

  const { data: therapy, isLoading, error } = useTherapy(id!);
  const isWatched = useIsWatched(id!);
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const [operationalModalOpen, setOperationalModalOpen] = useState(false);

  const institutionId = appUser?.institution_id ?? '';
  const { data: operational } = useOperationalReadiness(institutionId, id ?? '');
  const upsertOperational = useUpsertOperational();

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" label="Loading therapy…" /></div>;
  if (error || !therapy) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500">Therapy not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/catalog')}>
          Back to catalog
        </Button>
      </div>
    );
  }

  const pdufaDays = daysUntil(therapy.pdufa_date);

  return (
    <div className="space-y-5">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">
            Updated {formatDate(therapy.updated_at)}
          </span>
          <Button
            variant={isWatched ? 'danger' : 'outline'}
            size="sm"
            leftIcon={<Heart className={`h-4 w-4 ${isWatched ? 'fill-white' : ''}`} />}
            onClick={() =>
              isWatched
                ? removeFromWatchlist.mutate(therapy.id)
                : addToWatchlist.mutate({ therapyId: therapy.id, payload: { priority: 5, notify_on_updates: true } })
            }
          >
            {isWatched ? 'Watching' : 'Watch'}
          </Button>
        </div>
      </div>

      {/* Needs review banner */}
      {therapy.needs_human_review && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning-800">AI-generated content needs human review</p>
            <p className="text-xs text-warning-600">
              Some fields were auto-populated and may require verification. Last AI review:{' '}
              {formatDate(therapy.last_ai_review)}.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-neutral-900">{therapy.product_name}</h1>
              {therapy.ai_generated_fields.includes('product_name') && <AILabel />}
            </div>
            {therapy.generic_name && (
              <p className="text-sm italic text-neutral-500 mb-2">{therapy.generic_name}</p>
            )}
            <p className="text-lg font-medium text-neutral-700">{therapy.manufacturer}</p>
            <p className="mt-1 text-sm text-neutral-500 max-w-2xl">{therapy.indication}</p>
          </div>

          {therapy.pdufa_date && pdufaDays !== null && pdufaDays >= 0 && (
            <div className={`rounded-lg px-4 py-3 text-center border ${
              pdufaDays <= 30
                ? 'bg-red-50 border-red-200'
                : pdufaDays <= 90
                ? 'bg-warning-50 border-warning-200'
                : 'bg-primary-50 border-primary-200'
            }`}>
              <p className="text-xs font-medium text-neutral-500">PDUFA Date</p>
              <p className="text-lg font-bold text-neutral-900">{formatDate(therapy.pdufa_date)}</p>
              <p className={`text-sm font-semibold ${pdufaDays <= 30 ? 'text-red-600' : pdufaDays <= 90 ? 'text-warning-700' : 'text-primary-700'}`}>
                {pdufaDays} days away
              </p>
            </div>
          )}
        </div>

        {/* Badge row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <TherapyTypeBadge type={therapy.therapy_type} />
          <DiseaseBadge category={therapy.disease_category} />
          <PhaseBadge phase={therapy.clinical_phase} />
          <FDAStatusBadge status={therapy.fda_approval_status} />
          {therapy.breakthrough_designation && <Badge variant="purple">Breakthrough</Badge>}
          {therapy.priority_review && <Badge variant="info">Priority Review</Badge>}
          {therapy.orphan_drug_designation && <Badge variant="purple">Orphan Drug</Badge>}
          {therapy.fast_track_designation && <Badge variant="default">Fast Track</Badge>}
          {therapy.pediatric_priority && <Badge variant="pink">Pediatric Priority</Badge>}
          {therapy.rare_disease && <Badge variant="neutral">Rare Disease</Badge>}
          {therapy.rems_required && <Badge variant="warning">REMS Required</Badge>}
          {therapy.accelerated_approval && <Badge variant="teal">Accelerated Approval</Badge>}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <Tabs defaultTab="overview">
          <TabList className="px-2 pt-1">
            <Tab id="overview" icon={<FlaskConical className="h-4 w-4" />}>Overview</Tab>
            <Tab id="clinical" icon={<Activity className="h-4 w-4" />}>Clinical</Tab>
            <Tab id="regulatory" icon={<Shield className="h-4 w-4" />}>Regulatory</Tab>
            <Tab id="news" icon={<FileText className="h-4 w-4" />}>Literature & News</Tab>
            <Tab id="epidemiology" icon={<Globe className="h-4 w-4" />}>Epidemiology</Tab>
            <Tab id="my-status" icon={<Users className="h-4 w-4" />}>My Status</Tab>
          </TabList>

          {/* Overview */}
          <TabPanel id="overview" className="p-6 space-y-5">
            {therapy.ai_summary && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-amber-900">AI Summary</h3>
                  <AILabel timestamp={therapy.last_ai_review} />
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{therapy.ai_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Manufacturer', value: therapy.manufacturer },
                { label: 'Disease Category', value: therapy.disease_category },
                { label: 'Therapy Type', value: therapy.therapy_type },
                { label: 'Clinical Phase', value: therapy.clinical_phase },
                { label: 'FDA Status', value: therapy.fda_approval_status },
                { label: 'BLA Number', value: therapy.bla_number ?? '—' },
                { label: 'Approval Date', value: formatDate(therapy.approval_date) },
                { label: 'AdCom Date', value: formatDate(therapy.adcom_date) },
                { label: 'REMS Program', value: therapy.rems_program_name ?? (therapy.rems_required ? 'Required' : 'None') },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium text-neutral-900">{item.value}</p>
                </div>
              ))}
            </div>

            {therapy.indication_details && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">Indication Details</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{therapy.indication_details}</p>
              </div>
            )}
          </TabPanel>

          {/* Clinical */}
          <TabPanel id="clinical" className="p-6 space-y-5">
            {therapy.ai_clinical_summary && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-amber-900">Clinical Summary</h3>
                  <AILabel timestamp={therapy.last_ai_review} />
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{therapy.ai_clinical_summary}</p>
              </div>
            )}

            {therapy.trial_details && therapy.trial_details.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-3">Clinical Trials</h3>
                <div className="space-y-3">
                  {therapy.trial_details.map((trial) => (
                    <div key={trial.nct_number} className="rounded-lg border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-neutral-900">{trial.trial_name}</p>
                            <Badge variant="neutral">{trial.phase}</Badge>
                            <Badge variant={trial.status === 'Completed' ? 'success' : trial.status === 'Recruiting' ? 'info' : 'neutral'}>
                              {trial.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-500 mt-0.5">{trial.sponsor}</p>
                        </div>
                        <a
                          href={`https://clinicaltrials.gov/ct2/show/${trial.nct_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary-600 hover:underline shrink-0"
                        >
                          {trial.nct_number}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-neutral-500">Enrollment</p>
                          <p className="font-medium">{trial.enrollment?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Completion</p>
                          <p className="font-medium">{formatDate(trial.completion_date)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Primary Readout</p>
                          <p className="font-medium">{formatDate(trial.primary_readout_date)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">Conditions</p>
                          <p className="font-medium">{trial.conditions.join(', ') || '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No trial data available.</p>
            )}

            {/* Milestones */}
            {therapy.milestones && therapy.milestones.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-3">Key Milestones</h3>
                <div className="space-y-2">
                  {therapy.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-md border border-neutral-100 px-3 py-2">
                      <Calendar className="h-4 w-4 shrink-0 text-neutral-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">{m.milestone_type}</p>
                        {m.description && <p className="text-xs text-neutral-500 truncate">{m.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm text-neutral-700">{formatDate(m.date)}</p>
                        {m.is_confirmed && <p className="text-xs text-accent-600">Confirmed</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabPanel>

          {/* Regulatory */}
          <TabPanel id="regulatory" className="p-6 space-y-5">
            {therapy.ai_regulatory_summary && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-amber-900">Regulatory Summary</h3>
                  <AILabel timestamp={therapy.last_ai_review} />
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{therapy.ai_regulatory_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <h4 className="font-semibold text-neutral-800">FDA Timeline</h4>
                {[
                  { label: 'Status', value: therapy.fda_approval_status },
                  { label: 'BLA Number', value: therapy.bla_number ?? '—' },
                  { label: 'PDUFA Date', value: formatDate(therapy.pdufa_date) },
                  { label: 'AdCom Date', value: formatDate(therapy.adcom_date) },
                  { label: 'Approval Date', value: formatDate(therapy.approval_date) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">{item.label}</span>
                    <span className="font-medium text-neutral-900">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <h4 className="font-semibold text-neutral-800">Designations</h4>
                {[
                  { label: 'Breakthrough Therapy', value: therapy.breakthrough_designation },
                  { label: 'Priority Review', value: therapy.priority_review },
                  { label: 'Accelerated Approval', value: therapy.accelerated_approval },
                  { label: 'Fast Track', value: therapy.fast_track_designation },
                  { label: 'Orphan Drug', value: therapy.orphan_drug_designation },
                  { label: 'Pediatric Priority', value: therapy.pediatric_priority },
                  { label: 'REMS Required', value: therapy.rems_required },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">{item.label}</span>
                    <Badge variant={item.value ? 'success' : 'neutral'}>
                      {item.value ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {therapy.label_limitations && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Label Limitations</h4>
                <p className="text-sm text-neutral-600 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                  {therapy.label_limitations}
                </p>
              </div>
            )}

            {therapy.post_marketing_commitments && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Post-Marketing Commitments</h4>
                <p className="text-sm text-neutral-600 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                  {therapy.post_marketing_commitments}
                </p>
              </div>
            )}

            {therapy.confirmatory_studies && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Required Confirmatory Studies</h4>
                <p className="text-sm text-neutral-600 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                  {therapy.confirmatory_studies}
                </p>
              </div>
            )}

            {therapy.fda_documents && therapy.fda_documents.length > 0 && (
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">FDA Documents</h4>
                <div className="space-y-2">
                  {therapy.fda_documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                    >
                      <FileText className="h-4 w-4 text-neutral-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 truncate">{doc.title}</p>
                        <p className="text-xs text-neutral-500">{doc.document_type} · {formatDate(doc.published_at)}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-neutral-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </TabPanel>

          {/* News */}
          <TabPanel id="news" className="p-6 space-y-4">
            {therapy.news_items && therapy.news_items.length > 0 ? (
              therapy.news_items.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-neutral-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-neutral-900 line-clamp-2">{item.title}</p>
                        {item.is_ai_generated && <AILabel />}
                      </div>
                      <p className="text-xs text-neutral-500 line-clamp-3">{item.summary}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400 mt-0.5" />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{formatDate(item.published_at)}</span>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-neutral-400">No news or literature items available.</p>
            )}
          </TabPanel>

          {/* Epidemiology */}
          <TabPanel id="epidemiology" className="p-6 space-y-5">
            {therapy.epidemiology ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Global Prevalence', value: therapy.epidemiology.global_prevalence?.toLocaleString() ?? '—' },
                    { label: 'US Prevalence', value: therapy.epidemiology.us_prevalence?.toLocaleString() ?? '—' },
                    { label: 'US Incidence', value: therapy.epidemiology.us_incidence?.toLocaleString() ?? '—' },
                    { label: 'Pediatric Prevalence', value: therapy.epidemiology.pediatric_prevalence?.toLocaleString() ?? '—' },
                    { label: 'Addressable Population', value: therapy.epidemiology.addressable_population?.toLocaleString() ?? '—' },
                    { label: 'Impact Score', value: therapy.epidemiology.patient_impact_score?.toFixed(1) ?? '—' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 text-center">
                      <p className="text-2xl font-bold text-neutral-900">{item.value}</p>
                      <p className="mt-1 text-xs text-neutral-500">{item.label}</p>
                    </div>
                  ))}
                </div>
                {therapy.epidemiology.prevalence_source && (
                  <p className="text-xs text-neutral-400">
                    Source: {therapy.epidemiology.prevalence_source}
                    {therapy.epidemiology.prevalence_source_year && ` (${therapy.epidemiology.prevalence_source_year})`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400">No epidemiology data available.</p>
            )}
          </TabPanel>

          {/* My Status */}
          <TabPanel id="my-status" className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Watchlist */}
              <Card>
                <CardHeader>
                  <Heart className="h-5 w-5 text-red-400" />
                  <h3 className="text-sm font-semibold text-neutral-900">Watchlist</h3>
                </CardHeader>
                <CardBody>
                  {isWatched ? (
                    <div className="text-center space-y-3">
                      <p className="text-sm text-accent-700 font-medium">
                        ✓ In your watchlist
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeFromWatchlist.mutate(therapy.id)}
                      >
                        Remove from watchlist
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <p className="text-sm text-neutral-500">Not in your watchlist</p>
                      <Button
                        size="sm"
                        leftIcon={<Heart className="h-4 w-4" />}
                        onClick={() =>
                          addToWatchlist.mutate({
                            therapyId: therapy.id,
                            payload: { priority: 5, notify_on_updates: true },
                          })
                        }
                      >
                        Add to watchlist
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Operational */}
              <Card>
                <CardHeader
                  actions={
                    institutionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOperationalModalOpen(true)}
                      >
                        {operational ? 'Update' : 'Set Status'}
                      </Button>
                    )
                  }
                >
                  <Activity className="h-5 w-5 text-primary-500" />
                  <h3 className="text-sm font-semibold text-neutral-900">Operational Status</h3>
                </CardHeader>
                <CardBody>
                  {!institutionId ? (
                    <p className="text-sm text-neutral-500">Link your institution to track operational readiness.</p>
                  ) : operational ? (
                    <OperationalStageTracker operational={operational} compact />
                  ) : (
                    <p className="text-sm text-neutral-500">No operational status set for your institution.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </div>

      {/* Operational Modal */}
      <Modal
        isOpen={operationalModalOpen}
        onClose={() => setOperationalModalOpen(false)}
        title="Update Operational Status"
        size="lg"
      >
        <div className="p-6">
          <OperationalForm
            institutionId={institutionId}
            therapyId={therapy.id}
            existing={operational}
            isSubmitting={upsertOperational.isPending}
            onCancel={() => setOperationalModalOpen(false)}
            onSubmit={(payload) => {
              upsertOperational.mutate(payload, {
                onSuccess: () => setOperationalModalOpen(false),
              });
            }}
          />
        </div>
      </Modal>
    </div>
  );
};
