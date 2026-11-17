'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, Flag, Receipt, TriangleAlert } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { InvoiceBadge } from '@/components/billing/invoice-badge';
import { useBillingOverview, useInvoiceMilestone, useInvoiceRetainer, useInvoiceTime } from '@/hooks/useBilling';
import { useServicePermissions } from '@/hooks/usePermissions';
import { TREASURY_UI, type BillingOverview, type BillingTerms, type Invoice, type MilestoneBilling } from '@/lib/api/billing';
import { forbiddenKind, isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import {
  billAmountOf,
  isLiveInvoice,
  lastMonthRange,
  milestoneInvoiceBlock,
  moneyOf,
  monthOf,
  treasuryInvoiceUrl,
  validPeriod,
} from '@/lib/billing/logic';
import { teamMilestoneLabel } from '@/lib/portal/logic';
import { PriceDialog } from './price-dialog';

const BILLING_LABEL: Record<string, string> = {
  fixed: 'Fixed price',
  time_and_materials: 'Time and materials',
  retainer: 'Monthly retainer',
  non_billable: 'Internal (not billed)',
};

const inputClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:h-9';

function Notice({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Figure({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="wrap-break-word font-semibold">{children}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function InvoiceLink({ orgSlug, invoice, label }: { orgSlug: string; invoice: Pick<Invoice, 'id' | 'invoice_number'>; label?: string }) {
  return (
    <a
      href={treasuryInvoiceUrl(TREASURY_UI, orgSlug, invoice.id)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {label ?? (invoice.invoice_number || 'Draft invoice')}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

/** The contract terms the invoices are built from, edited on the Financials tab. */
function TermsCard({ orgSlug, projectId, terms, canEditLink }: { orgSlug: string; projectId: string; terms: BillingTerms; canEditLink: boolean }) {
  const cur = terms.currency || 'KES';
  const t = terms.billing_type;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Contract terms</CardTitle>
        {canEditLink && (
          <Link href={`/${orgSlug}/projects/${projectId}/financials#contract`} className="text-sm font-medium text-primary hover:underline">
            Edit terms
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!t ? (
          <p className="text-sm text-muted-foreground" data-testid="no-terms">
            No billing terms yet. Set how the project is billed and who the client is on the Financials tab.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4" data-testid="billing-terms">
            <Figure label="Billing">{BILLING_LABEL[t] ?? t}</Figure>
            <Figure label="Client">{terms.client_name || 'Not set'}</Figure>
            {t === 'fixed' && <Figure label="Contract value">{terms.contract_value != null ? formatCurrency(terms.contract_value, cur) : 'Not set'}</Figure>}
            {t === 'time_and_materials' && (
              <Figure label="Hourly rate">{moneyOf(terms.hourly_rate) > 0 ? formatCurrency(moneyOf(terms.hourly_rate), cur) : 'Not set'}</Figure>
            )}
            {t === 'retainer' && (
              <>
                <Figure label="Monthly fee">{moneyOf(terms.retainer_amount) > 0 ? formatCurrency(moneyOf(terms.retainer_amount), cur) : 'Not set'}</Figure>
                <Figure label="Hours included" hint={terms.retainer_rollover ? 'Unused hours roll over' : 'Unused hours lapse'}>
                  {terms.retainer_hours != null ? `${terms.retainer_hours} h a month` : 'Not set'}
                </Figure>
              </>
            )}
          </div>
        )}
        {t === 'non_billable' && <Notice testId="non-billable">This project is internal and is not billed, so no invoices can be created for it.</Notice>}
        {t && t !== 'non_billable' && !terms.client_id && (
          <Notice testId="no-client">No client is set, so invoices cannot be created. Set the client on the contract first.</Notice>
        )}
      </CardContent>
    </Card>
  );
}

function priceText(m: MilestoneBilling, cur: string) {
  if (m.amount_pct != null) {
    const bill = billAmountOf(m);
    return (
      <span>
        {m.amount_pct}% of contract
        {bill > 0 && <span className="block text-xs text-muted-foreground">{formatCurrency(bill, cur)}</span>}
      </span>
    );
  }
  if (moneyOf(m.amount) > 0) return formatCurrency(moneyOf(m.amount), cur);
  return <span className="text-muted-foreground">No price</span>;
}

function MilestonesSection({
  orgSlug,
  projectId,
  overview,
  canManage,
}: {
  orgSlug: string;
  projectId: string;
  overview: BillingOverview;
  canManage: boolean;
}) {
  const { terms } = overview;
  const cur = terms.currency || 'KES';
  const [pricing, setPricing] = useState<MilestoneBilling | null>(null);
  const invoice = useInvoiceMilestone(orgSlug, projectId);
  const pendingId = invoice.isPending ? invoice.variables : undefined;

  const columns = useMemo<DataTableColumn<MilestoneBilling>[]>(() => {
    const cols: DataTableColumn<MilestoneBilling>[] = [
      { key: 'name', header: 'Milestone', primary: true, render: (m) => <span className="font-medium">{m.name}</span> },
      { key: 'status', header: 'Status', render: (m) => <Badge status={m.status}>{teamMilestoneLabel(m.status)}</Badge> },
      { key: 'price', header: 'Price', align: 'right', accessor: (m) => billAmountOf(m), render: (m) => priceText(m, cur) },
      {
        key: 'invoice',
        header: 'Invoice',
        accessor: (m) => m.invoice_number ?? '',
        render: (m) =>
          m.invoice_id ? (
            <span className="inline-flex flex-wrap items-center gap-2" data-testid="milestone-invoice">
              <InvoiceLink orgSlug={orgSlug} invoice={{ id: m.invoice_id, invoice_number: m.invoice_number ?? '' }} />
              {m.invoice && <InvoiceBadge invoice={m.invoice} />}
            </span>
          ) : (
            <span className="text-muted-foreground">Not invoiced</span>
          ),
      },
    ];
    if (canManage) {
      cols.push({
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (m) => {
          const live = !!m.invoice_id && (m.invoice ? isLiveInvoice(m.invoice) : true);
          const block = milestoneInvoiceBlock(m, terms);
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-8"
                disabled={live}
                title={live ? 'The price is fixed while its invoice is live. Void the invoice in treasury to change it.' : undefined}
                onClick={() => setPricing(m)}
                aria-label={`Set price for ${m.name}`}
              >
                Set price
              </Button>
              {!live && (
                <Button
                  size="sm"
                  className="h-10 sm:h-8"
                  disabled={!!block || pendingId === m.id}
                  title={block ?? undefined}
                  onClick={() => invoice.mutate(m.id)}
                  aria-label={`Create invoice for ${m.name}`}
                >
                  {pendingId === m.id ? 'Creating...' : 'Create invoice'}
                </Button>
              )}
            </div>
          );
        },
      });
    }
    return cols;
  }, [canManage, cur, orgSlug, terms, invoice, pendingId]);

  return (
    <section className="space-y-3" aria-label="Milestones">
      <h2 className="text-base font-semibold">Milestones</h2>
      {overview.milestones.length === 0 ? (
        <EmptyState icon={Flag} title="No milestones yet" description="Add milestones on the Milestones tab, then give each a price to bill it." />
      ) : (
        <DataTable columns={columns} rows={overview.milestones} rowKey={(m) => m.id} gridLines="rows" storageKey="projects-billing-milestones-columns" />
      )}
      {pricing && (
        <PriceDialog
          key={pricing.id}
          orgSlug={orgSlug}
          projectId={projectId}
          milestone={pricing}
          contractValue={terms.contract_value}
          currency={cur}
          onClose={() => setPricing(null)}
        />
      )}
    </section>
  );
}

function TimeSection({ orgSlug, projectId, overview, canManage }: { orgSlug: string; projectId: string; overview: BillingOverview; canManage: boolean }) {
  const { terms } = overview;
  const cur = terms.currency || 'KES';
  const [period, setPeriod] = useState(() => lastMonthRange(new Date()));
  const [warning, setWarning] = useState<string | null>(null);
  const invoiceTime = useInvoiceTime(orgSlug, projectId);
  const noRate = moneyOf(terms.hourly_rate) <= 0;
  const ok = validPeriod(period.from, period.to);
  const block = !terms.client_id ? 'Set the client on the contract first.' : noRate ? 'Set an hourly rate on the contract first.' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <Figure label="Unbilled hours" hint="Approved billable hours not yet invoiced">
            {overview.erp_unavailable || overview.unbilled_hours == null ? 'Not available' : `${overview.unbilled_hours.toFixed(1)} h`}
          </Figure>
          <Figure label="Unbilled value">{overview.unbilled_estimate ? formatCurrency(moneyOf(overview.unbilled_estimate), cur) : '-'}</Figure>
          <Figure label="Hourly rate">{noRate ? 'Not set' : formatCurrency(moneyOf(terms.hourly_rate), cur)}</Figure>
        </div>
        {canManage && (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ok || block) return;
              setWarning(null);
              invoiceTime.mutate(period, { onSuccess: (res) => setWarning(res.warning ?? null) });
            }}
          >
            <label className="block flex-1 space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">From</span>
              <input type="date" className={inputClass} value={period.from} max={period.to} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} aria-label="From" />
            </label>
            <label className="block flex-1 space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">To</span>
              <input type="date" className={inputClass} value={period.to} min={period.from} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} aria-label="To" />
            </label>
            <Button type="submit" className="h-11 sm:h-9" disabled={!ok || !!block || invoiceTime.isPending} title={block ?? undefined}>
              {invoiceTime.isPending ? 'Creating...' : 'Invoice time'}
            </Button>
          </form>
        )}
        {canManage && block && <p className="text-xs text-muted-foreground">{block}</p>}
        {canManage && !ok && <p className="text-sm text-destructive">The start date must be on or before the end date.</p>}
        {warning && <Notice testId="time-warning">{warning}</Notice>}
      </CardContent>
    </Card>
  );
}

function RetainerSection({ orgSlug, projectId, overview, canManage }: { orgSlug: string; projectId: string; overview: BillingOverview; canManage: boolean }) {
  const { terms } = overview;
  const cur = terms.currency || 'KES';
  const [current] = useState(() => monthOf(new Date()));
  const [month, setMonth] = useState(current);
  const invoiceRetainer = useInvoiceRetainer(orgSlug, projectId);
  const block = !terms.client_id ? 'Set the client on the contract first.' : moneyOf(terms.retainer_amount) <= 0 ? 'Set the monthly fee on the contract first.' : null;
  const ok = /^\d{4}-\d{2}$/.test(month);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retainer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {moneyOf(terms.retainer_amount) > 0 ? `${formatCurrency(moneyOf(terms.retainer_amount), cur)} a month` : 'No monthly fee set'}
          {terms.retainer_hours != null ? `, ${terms.retainer_hours} hours included` : ''}
          {terms.retainer_rollover ? '. Unused hours roll over.' : '.'}
        </p>
        {canManage && (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (ok && !block) invoiceRetainer.mutate(month);
            }}
          >
            <label className="block space-y-1 text-sm sm:w-56">
              <span className="text-xs text-muted-foreground">Month</span>
              <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
            </label>
            <Button type="submit" className="h-11 sm:h-9" disabled={!ok || !!block || invoiceRetainer.isPending} title={block ?? undefined}>
              {invoiceRetainer.isPending ? 'Creating...' : month === current ? 'Invoice this month' : 'Invoice that month'}
            </Button>
          </form>
        )}
        {canManage && block && <p className="text-xs text-muted-foreground">{block}</p>}
      </CardContent>
    </Card>
  );
}

function InvoicesSection({ orgSlug, overview }: { orgSlug: string; overview: BillingOverview }) {
  const cur = overview.terms.currency || 'KES';
  const columns = useMemo<DataTableColumn<Invoice>[]>(
    () => [
      { key: 'number', header: 'Invoice', primary: true, accessor: (i) => i.invoice_number, render: (i) => <InvoiceLink orgSlug={orgSlug} invoice={i} /> },
      { key: 'date', header: 'Date', accessor: (i) => i.invoice_date, render: (i) => (i.invoice_date ? formatDate(i.invoice_date) : '-') },
      { key: 'due', header: 'Due', accessor: (i) => i.due_date, render: (i) => (i.due_date ? formatDate(i.due_date) : '-') },
      { key: 'total', header: 'Total', align: 'right', accessor: (i) => moneyOf(i.total_amount), render: (i) => <span className="tabular">{formatCurrency(moneyOf(i.total_amount), i.currency || cur)}</span> },
      { key: 'due_amount', header: 'Amount due', align: 'right', accessor: (i) => moneyOf(i.amount_due), render: (i) => <span className="tabular">{formatCurrency(moneyOf(i.amount_due), i.currency || cur)}</span> },
      { key: 'state', header: 'Status', mobileAction: true, render: (i) => <InvoiceBadge invoice={i} /> },
    ],
    [orgSlug, cur],
  );
  const more = overview.invoices_total > overview.invoices.length;
  return (
    <section className="space-y-3" aria-label="Invoices">
      <h2 className="text-base font-semibold">Invoices</h2>
      {overview.invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description={overview.treasury_unavailable ? 'Treasury is not answering, so the invoices cannot be listed right now.' : 'Invoices created here are listed with their payment status.'}
        />
      ) : (
        <DataTable columns={columns} rows={overview.invoices} rowKey={(i) => i.id} gridLines="rows" storageKey="projects-billing-invoices-columns" />
      )}
      {more && (
        <p className="text-sm text-muted-foreground">
          Showing the latest {overview.invoices.length} of {overview.invoices_total}.{' '}
          <a href={`${TREASURY_UI}/${orgSlug}/invoices`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            See all in treasury
          </a>
        </p>
      )}
    </section>
  );
}

/**
 * A project's billing (sprint 15): price and invoice milestones, bill time or the monthly
 * retainer, and follow the invoices' payment status. Treasury approves the invoices projects
 * creates; the firm sends them from treasury.
 */
export default function ProjectBillingPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasFeature = useFeature('milestone_billing');
  const hasBudgetTracking = useFeature('budget_tracking');
  const { can } = useServicePermissions();
  const canManage = can(PERMS.billingManage);
  const { data, isLoading, isError, error } = useBillingOverview(orgSlug, projectId, hasFeature);

  const header = <PageHeader title="Billing" back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }} className="mb-0" />;
  const locked = (
    <div className="space-y-4">
      {header}
      <FeatureLocked
        title="Project billing is part of Milestone Billing"
        description="Upgrade your plan to price milestones, bill time and retainers, and follow payments from treasury."
      />
    </div>
  );

  if (!hasFeature) return locked;
  if (isLoading) return <PageLoading />;
  if (forbiddenKind(error) === 'subscription') return locked;
  if (isNotFound(error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (isError || !data) return <ErrorBanner message="Failed to load the project's billing." />;

  const type = data.terms.billing_type;
  return (
    <div className="space-y-5">
      {header}
      {data.treasury_unavailable && (
        <Notice testId="treasury-unavailable">Treasury is not answering, so invoice and payment status may be missing. Creating invoices may fail until it is back.</Notice>
      )}
      {data.erp_unavailable && <Notice testId="erp-unavailable">ERP is not answering, so unbilled hours are not shown and time cannot be billed right now.</Notice>}
      <TermsCard orgSlug={orgSlug} projectId={projectId} terms={data.terms} canEditLink={hasBudgetTracking && can(PERMS.financialsView)} />
      <MilestonesSection orgSlug={orgSlug} projectId={projectId} overview={data} canManage={canManage} />
      {type === 'time_and_materials' && <TimeSection orgSlug={orgSlug} projectId={projectId} overview={data} canManage={canManage} />}
      {type === 'retainer' && <RetainerSection orgSlug={orgSlug} projectId={projectId} overview={data} canManage={canManage} />}
      <InvoicesSection orgSlug={orgSlug} overview={data} />
    </div>
  );
}
