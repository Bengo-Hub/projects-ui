'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Flag } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useMilestones, useCreateMilestone } from '@/hooks/useMilestones';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card p-4 shadow-lg sm:mx-4 sm:rounded-xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">New milestone</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="milestone-name" className="mb-1 block text-sm font-medium">Name *</label>
            <input
              id="milestone-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Milestone name"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Description</span>
            <RichTextField
              value={form.description ?? ''}
              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              ariaLabel="Description"
            />
          </div>
          <div>
            <label htmlFor="milestone-target" className="mb-1 block text-sm font-medium">Target date</label>
            <input
              id="milestone-target"
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

  const hasMilestoneBilling = useFeature('milestone_billing');

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

  if (!hasMilestoneBilling) {
    return (
      <FeatureLocked
        title="Milestone billing is a premium feature"
        description="Upgrade your plan to track project milestones and bill against them."
      />
    );
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load milestones." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Milestones"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add milestone
          </Button>
        }
      />

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
                <div className={`mt-1 h-3 w-3 rounded-full ${m.status === 'completed' ? 'bg-success' : m.status === 'missed' ? 'bg-destructive' : 'bg-primary'}`} />
                {idx < milestones.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <Card className="flex-1 mb-2">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{m.name}</p>
                      {m.description && <RichTextView value={m.description} className="mt-0.5 text-xs text-muted-foreground" />}
                      {m.target_date && (
                        <p className="mt-1 text-xs text-muted-foreground">Target: {formatDate(m.target_date)}</p>
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
