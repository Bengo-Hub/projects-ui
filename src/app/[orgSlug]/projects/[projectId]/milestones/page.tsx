'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Flag } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useMilestones, useCreateMilestone, useUpdateMilestone } from '@/hooks/useMilestones';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DecisionNote } from '@/components/portal/decision-note';
import { canMarkReady, teamMilestoneLabel } from '@/lib/portal/logic';
import type { Milestone } from '@/types';
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
import { ProjectNotFound } from '@/components/common/not-found-state';
import { useServicePermissions } from '@/hooks/usePermissions';
import { isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { useBillingOverview } from '@/hooks/useBilling';
import { TREASURY_UI, type MilestoneBilling } from '@/lib/api/billing';
import { treasuryInvoiceUrl } from '@/lib/billing/logic';
import { InvoiceBadge } from '@/components/billing/invoice-badge';

/** The milestone's invoice number (linked to treasury) and payment badge, once it is invoiced. */
function MilestoneInvoice({ orgSlug, billing }: { orgSlug: string; billing?: MilestoneBilling }) {
  if (!billing?.invoice_id) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-testid="milestone-invoice">
      <span className="text-muted-foreground">Invoice</span>
      <a
        href={treasuryInvoiceUrl(TREASURY_UI, orgSlug, billing.invoice_id)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary hover:underline"
      >
        {billing.invoice_number || 'Draft'}
      </a>
      {billing.invoice && <InvoiceBadge invoice={billing.invoice} />}
    </p>
  );
}

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
  const hasClientPortal = useFeature('client_portal');

  const { data, isLoading, isError, error } = useMilestones(orgSlug, projectId);
  const createMilestone = useCreateMilestone(orgSlug, projectId);
  const updateMilestone = useUpdateMilestone(orgSlug, projectId);
  const [reviewing, setReviewing] = useState<Milestone | null>(null);
  const { can } = useServicePermissions();
  const canAdd = can(PERMS.milestonesAdd);
  // Putting a milestone up for the client's review is a milestone edit that notifies the clients.
  const canSendForReview = hasClientPortal && can(PERMS.milestonesChange);
  // Invoice state per milestone, only when the billing overview can be read: no request otherwise.
  const billing = useBillingOverview(orgSlug, projectId, hasMilestoneBilling && can(PERMS.billingView));
  const billed = new Map((billing.data?.milestones ?? []).filter((b) => b.invoice_id).map((b) => [b.id, b]));

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
  if (isNotFound(error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (isError) return <ErrorBanner message="Failed to load milestones." />;

  const addButton = canAdd ? (
    <Button size="sm" onClick={() => setShowCreate(true)}>
      <Plus className="h-4 w-4" />
      Add milestone
    </Button>
  ) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Milestones"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={addButton}
      />

      {milestones.length === 0 ? (
        <EmptyState icon={Flag} title="No milestones yet" description="Track key project milestones." action={addButton} />
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => (
            <div key={m.id} className="flex gap-4">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`mt-1 h-3 w-3 rounded-full ${
                    m.status === 'completed' || m.status === 'approved'
                      ? 'bg-success'
                      : m.status === 'missed'
                        ? 'bg-destructive'
                        : m.status === 'ready_for_review' || m.status === 'changes_requested'
                          ? 'bg-warning'
                          : 'bg-primary'
                  }`}
                />
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
                    <Badge status={m.status} className="shrink-0">
                      {teamMilestoneLabel(m.status)}
                    </Badge>
                  </div>
                  <MilestoneInvoice orgSlug={orgSlug} billing={billed.get(m.id)} />
                  {m.last_decision && <DecisionNote decision={m.last_decision} className="mt-2" />}
                  {canSendForReview && canMarkReady(m.status) && (
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => setReviewing(m)}>
                        Ready for review
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
        title="Send this milestone for client review?"
        description={
          reviewing
            ? `The project's clients get an email and a WhatsApp message asking them to approve "${reviewing.name}" or ask for changes in the portal.`
            : undefined
        }
        confirmLabel="Send for review"
        variant="info"
        loading={updateMilestone.isPending}
        onConfirm={() =>
          reviewing && updateMilestone.mutate({ id: reviewing.id, data: { status: 'ready_for_review' } }, { onSettled: () => setReviewing(null) })
        }
      />

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
