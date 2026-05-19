import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowRight, Star, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMyWatchlist, useRemoveFromWatchlist, useUpdateWatchlistItem } from '@/hooks/useWatchlist';
import { FDAStatusBadge, PhaseBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import type { WatchlistItem } from '@/types/user';

export const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: watchlist, isLoading } = useMyWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const updateWatchlistItem = useUpdateWatchlistItem();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const sorted = React.useMemo(
    () => [...(watchlist ?? [])].sort((a, b) => a.priority - b.priority),
    [watchlist]
  );

  const handlePriorityChange = (item: WatchlistItem, delta: number) => {
    const newPriority = Math.max(1, Math.min(10, item.priority + delta));
    updateWatchlistItem.mutate({
      therapyId: item.therapy_id,
      payload: { priority: newPriority },
    });
  };

  const handleSaveNotes = (therapyId: string) => {
    updateWatchlistItem.mutate({
      therapyId,
      payload: { notes: editNotes },
    });
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading watchlist…" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Watchlist</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {sorted.length} {sorted.length === 1 ? 'therapy' : 'therapies'} tracked
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<ExternalLink className="h-4 w-4" />}
          onClick={() => navigate('/catalog')}
        >
          Browse catalog
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-red-50 p-6">
            <Heart className="h-10 w-10 text-red-300" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Your watchlist is empty</h2>
          <p className="mt-2 text-sm text-neutral-500 max-w-sm">
            Add therapies to your watchlist to track them and receive updates on milestones and regulatory changes.
          </p>
          <Button className="mt-6" onClick={() => navigate('/catalog')}>
            Browse therapies
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader
            actions={
              <span className="text-xs text-neutral-400">Priority 1 = highest</span>
            }
          >
            <h2 className="text-base font-semibold text-neutral-900">Watched Therapies</h2>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-neutral-100">
              <AnimatePresence mode="popLayout">
                {sorted.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Priority control */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button
                          onClick={() => handlePriorityChange(item, -1)}
                          disabled={item.priority <= 1}
                          className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                          aria-label="Increase priority"
                        >
                          ▲
                        </button>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                          {item.priority}
                        </span>
                        <button
                          onClick={() => handlePriorityChange(item, 1)}
                          disabled={item.priority >= 10}
                          className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                          aria-label="Decrease priority"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <button
                              onClick={() => navigate(`/catalog/${item.therapy_id}`)}
                              className="text-base font-semibold text-neutral-900 hover:text-primary-700 truncate block"
                            >
                              {item.therapy?.product_name ?? item.therapy_id}
                            </button>
                            <p className="text-sm text-neutral-500">
                              {item.therapy?.manufacturer} · {item.therapy?.indication}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => navigate(`/catalog/${item.therapy_id}`)}
                              className="rounded p-1 text-neutral-400 hover:text-primary-600"
                              aria-label="View therapy"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => removeFromWatchlist.mutate(item.therapy_id)}
                              className="rounded p-1 text-neutral-400 hover:text-red-500"
                              aria-label="Remove from watchlist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.therapy?.fda_approval_status && (
                            <FDAStatusBadge status={item.therapy.fda_approval_status} />
                          )}
                          {item.therapy?.clinical_phase && (
                            <PhaseBadge phase={item.therapy.clinical_phase} />
                          )}
                          {item.role && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                              <Star className="h-3 w-3" />
                              {item.role}
                            </span>
                          )}
                          <span className="text-xs text-neutral-400">
                            Added {formatDate(item.added_at)}
                          </span>
                        </div>

                        {/* Notes */}
                        {editingId === item.therapy_id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={2}
                              placeholder="Add notes…"
                              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveNotes(item.therapy_id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(item.therapy_id);
                              setEditNotes(item.notes ?? '');
                            }}
                            className="mt-2 text-xs text-neutral-400 hover:text-neutral-600"
                          >
                            {item.notes ? `"${item.notes}"` : '+ Add notes'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
