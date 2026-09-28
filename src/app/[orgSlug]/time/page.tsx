'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Clock, ExternalLink, Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { usePortfolio } from '@/hooks/useFinancials';
import type { ProjectFinancials } from '@/lib/api/financials';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';

const PAGE_SIZE = 25;
// Time is logged on ERP timesheets; set this to link people there.
const ERP_UI = process.env.NEXT_PUBLIC_ERP_UI_URL;

const h = (n: number) => `${n.toFixed(1)} h`;

/**
 * Burn compares hours used with work done: logging a larger share of the estimate than the
 * share of work complete (by more than 10 points) means the estimate is likely to overrun.
 */
function burnTone(p: ProjectFinancials): string {
  const u = p.hours?.utilisation_pct;
  if (u == null) return 'bg-slate-300';
  if (u > 100) return 'bg-red-500';
  if (u > p.evm.percent_complete + 10) return 'bg-amber-500';
  return 'bg-green-500';
}

function Row({ p, orgSlug }: { p: ProjectFinancials; orgSlug: string }) {
  const hrs = p.hours;
  const u = hrs?.utilisation_pct;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40">
      <td className="px-3 py-2">
        <Link href={`/${orgSlug}/projects/${p.project_id}`} className="font-medium hover:underline">
          {p.name}
        </Link>
      </td>
      <td className="px-3 py-2"><Badge status={p.status} /></td>
      <td className="px-3 py-2 text-right tabular-nums">{p.evm.percent_complete.toFixed(0)}%</td>
      <td className="px-3 py-2 text-right tabular-nums">{hrs ? h(hrs.estimated) : '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums">{hrs ? h(hrs.logged) : '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums">{hrs && hrs.pending > 0 ? h(hrs.pending) : '—'}</td>
      <td className="px-3 py-2">
        {u != null ? (
          <div className="flex items-center gap-2" title="Share of the estimated hours already logged">
            <div className="h-1.5 w-24 rounded-full bg-muted">
              <div className={`h-1.5 rounded-full ${burnTone(p)}`} style={{ width: `${Math.min(u, 100)}%` }} />
            </div>
            <span className="text-xs tabular-nums">{u.toFixed(0)}%</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{hrs ? 'No estimates' : '—'}</span>
        )}
      </td>
    </tr>
  );
}

export default function TimePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const hasBudgetTracking = useFeature('budget_tracking');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const { data, isLoading, isError } = usePortfolio(
    orgSlug,
    { page, limit: PAGE_SIZE, status: status || undefined },
    hasBudgetTracking
  );

  if (!hasBudgetTracking) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Lock className="mx-auto h-6 w-6 text-amber-600" />
          <p className="font-semibold">Time tracking is part of Budget Tracking</p>
          <p className="text-sm text-muted-foreground">
            Timesheet hours against task estimates come with the Budget Tracking feature.
          </p>
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
  const withHours = rows.filter((p) => p.hours);
  const sum = withHours.reduce(
    (acc, p) => ({
      estimated: acc.estimated + p.hours!.estimated,
      logged: acc.logged + p.hours!.logged,
      pending: acc.pending + p.hours!.pending,
    }),
    { estimated: 0, logged: 0, pending: 0 }
  );
  const utilisation = sum.estimated > 0 ? (sum.logged / sum.estimated) * 100 : null;
  const over = withHours.filter((p) => (p.hours!.utilisation_pct ?? 0) > 100).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Time</h1>
          <p className="text-sm text-muted-foreground">
            Hours logged on ERP timesheets against each project&apos;s task estimates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ERP_UI && (
            <a
              href={ERP_UI}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Log time in ERP
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="border border-border rounded-md px-3 py-2 text-sm"
            aria-label="Project status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Estimated', value: h(sum.estimated) },
          { label: 'Logged (approved)', value: h(sum.logged) },
          { label: 'Awaiting approval', value: h(sum.pending) },
          {
            label: 'Used of estimate',
            value: utilisation != null ? `${utilisation.toFixed(0)}%` : '—',
            hint: over ? `${over} project(s) over estimate` : undefined,
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
              {s.hint && <p className="text-xs text-red-600">{s.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {pages > 1 && <p className="text-xs text-muted-foreground">Totals cover the projects on this page.</p>}

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <ErrorBanner message="Failed to load project hours." />
      ) : rows.length === 0 ? (
        <EmptyState icon={Clock} title="No projects" description="Projects with task estimates show their logged hours here." />
      ) : (
        <>
          {withHours.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Timesheet hours are unavailable right now: ERP could not be reached. Estimates and progress still show.
            </p>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Done</th>
                    <th className="px-3 py-2 text-right">Estimated</th>
                    <th className="px-3 py-2 text-right">Logged</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-left">Used of estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => (b.hours?.utilisation_pct ?? -1) - (a.hours?.utilisation_pct ?? -1))
                    .map((p) => (
                      <Row key={p.project_id} p={p} orgSlug={orgSlug} />
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Bar colour: green when hours track progress, amber when hours run more than 10 points ahead of work done, red
            past the estimate.
          </p>
        </>
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
