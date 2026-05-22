'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Flag } from 'lucide-react';
import { useMilestones, useCreateMilestone } from '@/hooks/useMilestones';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import type { CreateMilestoneInput } from '@/lib/api/milestones';

function CreateMilestoneModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: CreateMilestoneInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateMilestoneInput>({ name: '' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">New Milestone</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Milestone name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Date</label>
            <input
              type="date"
              value={form.target_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value || undefined }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.name.trim()}>
              {isPending ? 'Creating...' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MilestonesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useMilestones(orgSlug, projectId);
  const createMilestone = useCreateMilestone(orgSlug, projectId);

  const milestones = (data?.data ?? []).sort((a, b) => {
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
  });

  function handleCreate(input: CreateMilestoneInput) {
    createMilestone.mutate(input, { onSuccess: () => setShowCreate(false) });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load milestones." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Milestones</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Add Milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Track key project milestones."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Add Milestone
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div key={m.id} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full mt-1 ${m.status === 'completed' ? 'bg-green-500' : m.status === 'missed' ? 'bg-red-400' : 'bg-blue-400'}`} />
                {idx < milestones.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <Card className="flex-1 mb-2">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{m.name}</p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      )}
                      {m.target_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Target: {format(new Date(m.target_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge status={m.status} className="shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMilestoneModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createMilestone.isPending}
        />
      )}
    </div>
  );
}
