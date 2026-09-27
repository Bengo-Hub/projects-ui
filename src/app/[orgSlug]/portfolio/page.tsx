'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { usePortfolio } from '@/hooks/useFinancials';
import { numOf, type EVM, type ProjectFinancials } from '@/lib/api/financials';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { formatCompact } from '@/lib/utils';

const PAGE_SIZE = 25;

const dot: Record<EVM['health'], string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  none: 'bg-slate-300',
};

function Health({ evm }: { evm: EVM }) {
  const label = { green: 'On track', amber: 'Watch', red: 'At risk', none: 'No budget' }[evm.health];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={evm.health_reason}>
      <span className={`h-2.5 w-2.5 rounded-full ${dot[evm.health]}`} />
      {label}
    </span>
  );
}

const idx = (v: number) => (v ? v.toFixed(2) : '—');

function Row({ p, orgSlug }: { p: ProjectFinancials; orgSlug: string }) {
  const cur = p.currency || 'KES';
  const budget = numOf(p.money?.budget_cost);
  const spent = numOf(p.money?.actual_cost);
  const committed = numOf(p.money?.committed);
  const used = budget > 0 ? ((spent + committed) / budget) * 100 : 0;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40">
      <td className="px-3 py-2">
        <Link href={`/${orgSlug}/projects/${p.project_id}/financials`} className="font-medium hover:underline">
          {p.name}
        </Link>
        <div className="text-xs text-muted-foreground">
          {p.tasks_done}/{p.tasks_total} tasks{p.tasks_overdue > 0 ? `, ${p.tasks_overdue} overdue` : ''}
        </div>
      </td>
      <td className="px-3 py-2"><Badge status={p.status} /></td>
      <td className="px-3 py-2"><Health evm={p.evm} /></td>
      <td className="px-3 py-2 text-right">{budget ? formatCompact(budget, cur) : '—'}</td>
      <td className="px-3 py-2 text-right">{formatCompact(spent, cur)}</td>
      <td className="px-3 py-2 text-right">{committed ? formatCompact(committed, cur) : '—'}</td>
      <td className="px-3 py-2">
        {budget ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-muted">
              <div
                className={`h-1.5 rounded-full ${used > 100 ? 'bg-red-500' : used >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(used, 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{used.toFixed(0)}%</span>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{p.evm.percent_complete.toFixed(0)}%</td>
      <td className="px-3 py-2 text-right tabular-nums">{idx(p.evm.cpi)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{idx(p.evm.spi)}</td>
    </tr>
  );
}

export default function PortfolioPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const hasBudgetTracking = useFeature('budget_tracking');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading, isError } = usePortfolio(orgSlug, { page, limit: PAGE_SIZE, status: status || undefined }, hasBudgetTracking);

  if (!hasBudgetTracking) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Lock className="mx-auto h-6 w-6 text-amber-600" />
          <p className="font-semibold">The portfolio view is part of Budget Tracking</p>
          <a href={UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
            See plans
          </a>
        </CardContent>
      </Card>
    );
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = rows.reduce(
    (acc, p) => ({ ...acc, [p.evm.health]: (acc[p.evm.health] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">Every project's budget, spend and earned value, worst health first on each page.</p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['red', 'amber', 'green', 'none'] as const).map((h) => (
          <Card key={h}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${dot[h]}`} />
                {{ red: 'At risk', amber: 'Watch', green: 'On track', none: 'No budget' }[h]}
              </p>
              <p className="text-xl font-bold">{counts[h] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <ErrorBanner message="Failed to load the portfolio." />
      ) : rows.length === 0 ? (
        <EmptyState title="No projects" description="Projects appear here with their financial health." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Health</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Spent</th>
                  <th className="px-3 py-2 text-right">Committed</th>
                  <th className="px-3 py-2 text-left">Used</th>
                  <th className="px-3 py-2 text-right">Done</th>
                  <th className="px-3 py-2 text-right" title="Cost efficiency: 1.00 is on plan">CPI</th>
                  <th className="px-3 py-2 text-right" title="Schedule efficiency: 1.00 is on plan">SPI</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => ({ red: 0, amber: 1, green: 2, none: 3 })[a.evm.health] - ({ red: 0, amber: 1, green: 2, none: 3 })[b.evm.health])
                  .map((p) => (
                    <Row key={p.project_id} p={p} orgSlug={orgSlug} />
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
