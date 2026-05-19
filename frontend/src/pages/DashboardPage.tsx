import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Calendar,
  Heart,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { MilestoneTimeline } from '@/components/dashboard/MilestoneTimeline';
import { WatchlistSummary } from '@/components/dashboard/WatchlistSummary';
import { TherapyCard } from '@/components/therapy/TherapyCard';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useUpcomingMilestones, useTherapies } from '@/hooks/useTherapies';
import { useMyWatchlist } from '@/hooks/useWatchlist';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();

  const { data: upcomingMilestones, isLoading: milestonesLoading } = useUpcomingMilestones(90);
  const { data: upcomingIn30, isLoading: thirtyLoading } = useUpcomingMilestones(30);
  const { data: watchlist } = useMyWatchlist();
  const { data: recentTherapies, isLoading: recentLoading } = useTherapies({
    sort_by: 'updated_at',
    sort_order: 'desc',
    page_size: 6,
  });
  const { data: needsReview } = useTherapies({ needs_review: true, page_size: 1 });

  const therapyNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    recentTherapies?.items.forEach((t) => { map[t.id] = t.product_name; });
    upcomingMilestones?.forEach((m) => {
      if (!map[m.therapy_id]) map[m.therapy_id] = m.therapy_id;
    });
    return map;
  }, [recentTherapies, upcomingMilestones]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {appUser?.display_name ? `Welcome back, ${appUser.display_name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FlaskConical className="h-4 w-4" />}
            onClick={() => navigate('/catalog')}
          >
            Browse Catalog
          </Button>
          <Button
            size="sm"
            leftIcon={<TrendingUp className="h-4 w-4" />}
            onClick={() => navigate('/pipeline')}
          >
            Pipeline View
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Therapies"
          value={recentTherapies?.total ?? '—'}
          icon={<FlaskConical className="h-6 w-6" />}
          variant="primary"
          onClick={() => navigate('/catalog')}
        />
        <StatCard
          label="Milestones (30 days)"
          value={thirtyLoading ? '…' : (upcomingIn30?.length ?? 0)}
          icon={<Calendar className="h-6 w-6" />}
          variant={
            (upcomingIn30?.length ?? 0) > 5 ? 'warning' : 'default'
          }
        />
        <StatCard
          label="My Watchlist"
          value={watchlist?.length ?? 0}
          icon={<Heart className="h-6 w-6" />}
          variant="success"
          onClick={() => navigate('/watchlist')}
        />
        <StatCard
          label="Needs Review"
          value={needsReview?.total ?? 0}
          icon={<AlertTriangle className="h-6 w-6" />}
          variant={(needsReview?.total ?? 0) > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/catalog?needs_review=true')}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Milestones – 2 cols */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => navigate('/pipeline')}
                >
                  View pipeline
                </Button>
              }
            >
              <Calendar className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-semibold text-neutral-900">Upcoming Milestones</h2>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                Next 90 days
              </span>
            </CardHeader>
            <CardBody>
              {milestonesLoading ? (
                <Spinner size="sm" className="mx-auto" />
              ) : (
                <MilestoneTimeline
                  milestones={upcomingMilestones ?? []}
                  therapyNames={therapyNames}
                  maxItems={8}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Watchlist – 1 col */}
        <div>
          <Card>
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => navigate('/watchlist')}
                >
                  View all
                </Button>
              }
            >
              <Heart className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-semibold text-neutral-900">My Watchlist</h2>
            </CardHeader>
            <CardBody>
              <WatchlistSummary />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recently Updated Therapies */}
      <Card>
        <CardHeader
          actions={
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => navigate('/catalog')}
            >
              View catalog
            </Button>
          }
        >
          <RefreshCw className="h-5 w-5 text-neutral-500" />
          <h2 className="text-base font-semibold text-neutral-900">Recently Updated</h2>
        </CardHeader>
        <CardBody>
          {recentLoading ? (
            <Spinner size="sm" className="mx-auto" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentTherapies?.items.map((t) => (
                <TherapyCard key={t.id} therapy={t} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-neutral-900">Quick Actions</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            leftIcon={<FlaskConical className="h-4 w-4" />}
            onClick={() => navigate('/catalog')}
          >
            Browse All Therapies
          </Button>
          <Button
            variant="outline"
            leftIcon={<TrendingUp className="h-4 w-4" />}
            onClick={() => navigate('/pipeline')}
          >
            Pipeline Visualization
          </Button>
          <Button
            variant="outline"
            leftIcon={<Calendar className="h-4 w-4" />}
            onClick={() => navigate('/operational')}
          >
            Operational Tracker
          </Button>
          <Button
            variant="outline"
            leftIcon={<Heart className="h-4 w-4" />}
            onClick={() => navigate('/watchlist')}
          >
            My Watchlist
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};
