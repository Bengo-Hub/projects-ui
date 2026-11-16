'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';
import { formatCurrency } from '@bengo-hub/shared-ui-lib/format';
import { usePortfolio } from '@/hooks/useFinancials';
import { numOf, type EVM, type ProjectFinancials } from '@/lib/api/financials';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { PageHeader } from '@/components/common/page-header';
import { CountRow } from '@/components/common/list-parts';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const dot: Record<EVM['health'], string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
  none: 'bg-muted-foreground/40',
};
const HEALTH_LABEL: Record<EVM['health'], string> = { green: 'On track', amber: 'Watch', red: 'At risk', none: 'No budget' };
const HEALTH_ORDER: Record<EVM['health'], number> = { red: 0, amber: 1, green: 2, none: 3 };

function Health({ evm }: { evm: EVM }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={evm.health_reason}>
      <span className={`h-2.5 w-2.5 rounded-full ${dot[evm.health]}`} />
      {HEALTH_LABEL[evm.health]}
    </span>
  );
}

const idx = (v: number) => (v ? v.toFixed(2) : '—');

function used(p: ProjectFinancials): number {
  const budget = numOf(p.money?.budget_cost);
  return budget > 0 ? ((numOf(p.money?.actual_cost) + numOf(p.money?.committed)) / budget) * 100 : 0;
}

export default function PortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const hasBudgetTracking = useFeature('budget_tracking');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, refetch } = usePortfolio(orgSlug, { page, limit: PAGE_SIZE, status: status || undefined }, hasBudgetTracking);

  const columns = useMemo<DataTableColumn<ProjectFinancials>[]>(
    () => [
      {
        key: 'name',
        header: 'Project',
        primary: true,
        render: (p) => (
          <div className="min-w-0">
            <Link href={`/${orgSlug}/projects/${p.project_id}/financials`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              {p.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              {p.tasks_done}/{p.tasks_total} tasks{p.tasks_overdue > 0 ? `, ${p.tasks_overdue} overdue` : ''}
            </div>
          </div>
        ),
      },
      { key: 'status', header: 'Status', mobileAction: true, render: (p) => <Badge status={p.status} /> },
      { key: 'health', header: 'Health', accessor: (p) => HEALTH_ORDER[p.evm.health], sortable: true, render: (p) => <Health evm={p.evm} /> },
      {
        key: 'budget',
        header: 'Budget',
        align: 'right',
        sortable: true,
        accessor: (p) => numOf(p.money?.budget_cost),
        render: (p) => {
          const b = numOf(p.money?.budget_cost);
          return <span className="tabular">{b ? formatCurrency(b, p.currency || 'KES') : '—'}</span>;
        },
      },
      {
        key: 'spent',
        header: 'Spent',
        align: 'right',
        sortable: true,
        accessor: (p) => numOf(p.money?.actual_cost),
        render: (p) => <span className="tabular">{formatCurrency(numOf(p.money?.actual_cost), p.currency || 'KES')}</span>,
      },
      {
        key: 'committed',
        header: 'Committed',
        align: 'right',
        sortable: true,
        hideBelow: 'lg',
        accessor: (p) => numOf(p.money?.committed),
        render: (p) => {
          const c = numOf(p.money?.committed);
          return <span className="tabular">{c ? formatCurrency(c, p.currency || 'KES') : '—'}</span>;
        },
      },
      {
        key: 'used',
        header: 'Used',
        sortable: true,
        accessor: used,
        render: (p) => {
          if (!numOf(p.money?.budget_cost)) return '—';
          const u = used(p);
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full ${u > 100 ? 'bg-destructive' : u >= 80 ? 'bg-warning' : 'bg-success'}`}
                  style={{ width: `${Math.min(u, 100)}%` }}
                />
              </div>
              <span className="text-xs tabular">{u.toFixed(0)}%</span>
            </div>
          );
        },
      },
      { key: 'done', header: 'Done', align: 'right', sortable: true, accessor: (p) => p.evm.percent_complete, render: (p) => <span className="tabular">{p.evm.percent_complete.toFixed(0)}%</span> },
      { key: 'cpi', header: <span title="Cost efficiency: 1.00 is on plan">CPI</span>, mobileLabel: 'CPI', align: 'right', sortable: true, hideBelow: 'md', accessor: (p) => p.evm.cpi, render: (p) => <span className="tabular">{idx(p.evm.cpi)}</span> },
      { key: 'spi', header: <span title="Schedule efficiency: 1.00 is on plan">SPI</span>, mobileLabel: 'SPI', align: 'right', sortable: true, hideBelow: 'md', accessor: (p) => p.evm.spi, render: (p) => <span className="tabular">{idx(p.evm.spi)}</span> },
    ],
    [orgSlug],
  );

  if (!hasBudgetTracking) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <Lock className="mx-auto h-6 w-6 text-warning" />
          <p className="font-semibold">The portfolio view is part of Budget Tracking</p>
          <a href={UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
            See plans
          </a>
        </CardContent>
      </Card>
    );
  }

  const rows = [...(data?.data ?? [])].sort((a, b) => HEALTH_ORDER[a.evm.health] - HEALTH_ORDER[b.evm.health]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = rows.reduce((acc, p) => ({ ...acc, [p.evm.health]: (acc[p.evm.health] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Portfolio"
        subtitle="Every project's budget, spend and earned value, worst health first on each page."
        className="mb-0"
        actions={
          <SearchableCombobox
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            placeholder="All statuses"
            searchPlaceholder="Find a status"
            className="w-full sm:w-48"
          />
        }
      />

      <CountRow items={(['red', 'amber', 'green', 'none'] as const).map((h) => ({ label: HEALTH_LABEL[h], value: counts[h] ?? 0 }))} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.project_id}
        loading={isLoading}
        loadingRows={5}
        error={isError}
        onRetry={() => void refetch()}
        emptyState={<EmptyState title="No projects" description="Projects appear here with their financial health." />}
        gridLines="rows"
        storageKey="projects-portfolio-columns"
        showExportCsv
        exportFileName="portfolio"
        onRowClick={(p) => router.push(`/${orgSlug}/projects/${p.project_id}/financials`)}
        page={page}
        totalPages={pages}
        onPageChange={setPage}
        total={total}
      />
    </div>
  );
}
