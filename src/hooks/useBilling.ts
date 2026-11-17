'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingApi, TREASURY_UI, type Invoice, type MilestonePriceInput } from '@/lib/api/billing';
import { errorBody, forbiddenKind } from '@/lib/api/errors';
import { billingErrorToast, treasuryInvoiceUrl } from '@/lib/billing/logic';

const KEY = 'billing';

export function billingKey(orgSlug: string, projectId: string) {
  return [KEY, orgSlug, projectId] as const;
}

/**
 * The project's billing overview. Pass enabled=false unless the tenant has milestone_billing and
 * the user holds projects.billing.view, so no request goes out that would be refused.
 */
export function useBillingOverview(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: billingKey(orgSlug, projectId),
    queryFn: () => billingApi.overview(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
}

/** Opens treasury's page for an invoice in a new tab. */
export function openInTreasury(orgSlug: string, invoiceId: string) {
  window.open(treasuryInvoiceUrl(TREASURY_UI, orgSlug, invoiceId), '_blank', 'noopener,noreferrer');
}

function onBillingError(fallback: string) {
  return (err: unknown) => {
    // A permission or plan 403 already has its toast from the query client and API client.
    if (forbiddenKind(err)) return;
    const body = errorBody(err);
    const t = billingErrorToast(body?.code, body?.error, fallback);
    if (t.kind === 'info') toast.info(t.message);
    else toast.error(t.message);
  };
}

/** After any billing write: the overview, the milestones list and the financials figures. */
function useRefresh(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: billingKey(orgSlug, projectId) });
    void qc.invalidateQueries({ queryKey: ['milestones', orgSlug, projectId] });
    void qc.invalidateQueries({ queryKey: ['financials', orgSlug] });
  };
}

function createdToast(orgSlug: string, inv: Invoice, what: string) {
  toast.success(`${what} ${inv.invoice_number || ''} is ready to send in treasury`.replace(/\s+/g, ' '), {
    action: { label: 'Open in treasury', onClick: () => openInTreasury(orgSlug, inv.id) },
  });
}

export function useSetMilestonePrice(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: ({ milestoneId, body }: { milestoneId: string; body: MilestonePriceInput }) =>
      billingApi.setMilestonePrice(orgSlug, projectId, milestoneId, body),
    onSuccess: (_, { body }) => {
      refresh();
      toast.success(body.amount == null && body.amount_pct == null ? 'Price cleared' : 'Price saved');
    },
    onError: onBillingError('The price was not saved'),
  });
}

export function useInvoiceMilestone(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: (milestoneId: string) => billingApi.invoiceMilestone(orgSlug, projectId, milestoneId),
    onSuccess: (inv) => {
      refresh();
      createdToast(orgSlug, inv, 'Invoice');
    },
    onError: onBillingError('The invoice was not created'),
  });
}

export function useInvoiceTime(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: (period: { from: string; to: string }) => billingApi.invoiceTime(orgSlug, projectId, period),
    onSuccess: (res) => {
      refresh();
      createdToast(orgSlug, res.invoice, 'Time invoice');
      if (res.warning) toast.warning(res.warning);
    },
    onError: onBillingError('The time invoice was not created'),
  });
}

export function useInvoiceRetainer(orgSlug: string, projectId: string) {
  const refresh = useRefresh(orgSlug, projectId);
  return useMutation({
    mutationFn: (month: string) => billingApi.invoiceRetainer(orgSlug, projectId, { month }),
    onSuccess: (res) => {
      refresh();
      createdToast(orgSlug, res.invoice, 'Retainer invoice');
    },
    onError: onBillingError('The retainer invoice was not created'),
  });
}
