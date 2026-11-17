'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatCurrency } from '@bengo-hub/shared-ui-lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { useClientProfit } from '@/hooks/useFinancials';
import type { ClientProfit } from '@/lib/api/financials';

const money = (v: number, cur: string) => <span className="tabular">{formatCurrency(v, cur || 'KES')}</span>;

/**
 * Margin per client (GET /financials/clients): every project of a client added up, in the order
 * the API returns them. A table on desktop and cards on phones, as the DataTable does.
 */
export function ClientRollup({ orgSlug, status }: { orgSlug: string; status: string }) {
  const { data, isLoading, isError, refetch } = useClientProfit(orgSlug, status || undefined);

  const columns = useMemo<DataTableColumn<ClientProfit>[]>(
    () => [
      {
        key: 'client',
        header: 'Client',
        primary: true,
        accessor: (c) => c.client_name,
        render: (c) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.client_name || 'No client set'}</span>
            <span className="block text-xs text-muted-foreground">
              {c.projects === 1 ? '1 project' : `${c.projects} projects`}
            </span>
          </span>
        ),
      },
      { key: 'contract', header: 'Contract value', align: 'right', sortable: true, hideBelow: 'lg', accessor: (c) => c.contract_value, render: (c) => money(c.contract_value, c.currency) },
      { key: 'invoiced', header: 'Invoiced', align: 'right', sortable: true, accessor: (c) => c.invoiced, render: (c) => money(c.invoiced, c.currency) },
      { key: 'unbilled', header: 'Unbilled', align: 'right', sortable: true, hideBelow: 'md', accessor: (c) => c.unbilled, render: (c) => money(c.unbilled, c.currency) },
      { key: 'labour', header: 'Labour cost', align: 'right', sortable: true, hideBelow: 'lg', accessor: (c) => c.labour_cost, render: (c) => money(c.labour_cost, c.currency) },
      { key: 'cost', header: 'Cost to date', align: 'right', sortable: true, accessor: (c) => c.cost_to_date, render: (c) => money(c.cost_to_date, c.currency) },
      {
        key: 'margin',
        header: 'Margin to date',
        align: 'right',
        sortable: true,
        mobileAction: true,
        accessor: (c) => c.margin_to_date,
        render: (c) => (
          <span className={`tabular font-semibold ${c.margin_to_date < 0 ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(c.margin_to_date, c.currency || 'KES')}
            {c.margin_pct != null && <span className="ml-1 text-xs font-normal">({c.margin_pct.toFixed(1)}%)</span>}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-3" data-testid="client-rollup">
      {data?.money_unavailable && (
        <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm" data-testid="money-unavailable">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          Treasury is not answering, so invoiced amounts and booked costs are missing. Labour cost from timesheets is still included.
        </p>
      )}
      {data?.truncated && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground" data-testid="rollup-truncated">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          This organisation has more projects than the summary reads at once, so these totals cover only part of them. Filter by status to narrow it.
        </p>
      )}
      <DataTable
        columns={columns}
        rows={data?.clients ?? []}
        rowKey={(c) => `${c.client_id || 'none'}:${c.currency}`}
        loading={isLoading}
        loadingRows={5}
        error={isError}
        onRetry={() => void refetch()}
        emptyState={<EmptyState title="No clients yet" description="Set the client on a project's contract to see its margin here." />}
        gridLines="rows"
        storageKey="projects-portfolio-clients-columns"
        showExportCsv
        exportFileName="portfolio-clients"
      />
    </div>
  );
}
