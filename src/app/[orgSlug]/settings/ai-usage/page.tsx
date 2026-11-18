'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { BILLING_URL } from '@/components/subscription/subscription-banner';
import { useAIUsage } from '@/hooks/useAI';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { FEATURE_LABEL, usageOutcome } from '@/lib/ai/drafts';
import type { UsageEntry } from '@/lib/api/ai';

const PERIODS = [7, 30, 90];
const PAGE = 50;

const columns: DataTableColumn<UsageEntry>[] = [
  { key: 'feature', header: 'Feature', primary: true, accessor: (u) => FEATURE_LABEL[u.feature] ?? u.feature },
  { key: 'outcome', header: 'Outcome', accessor: (u) => usageOutcome(u.status, u.reason) },
  { key: 'credits', header: 'Credits', align: 'right', mobileAction: true, accessor: (u) => u.credits_charged, render: (u) => <span className="tabular-nums">{u.exempt ? 'Free' : u.credits_charged}</span> },
  { key: 'tokens', header: 'Tokens', align: 'right', hideBelow: 'md', accessor: (u) => u.total_tokens, render: (u) => <span className="tabular-nums">{u.total_tokens}</span> },
  { key: 'when', header: 'When', align: 'right', hideBelow: 'md', accessor: (u) => u.created_at, render: (u) => <span className="text-muted-foreground">{formatDateTime(u.created_at)}</span> },
];

/** The organisation's AI usage (sprint 10): totals per feature and every request, newest first. */
export default function AIUsagePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { can } = useServicePermissions();
  const allowed = can(PERMS.aiView);
  const [days, setDays] = useState(30);
  const [offset, setOffset] = useState(0);
  const usage = useAIUsage(orgSlug, days, offset, allowed);

  const header = (
    <PageHeader
      title="AI usage"
      subtitle="What the assistant did for your organisation and the AI credits it used"
      className="mb-0"
      actions={
        <a href={BILLING_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent sm:min-h-9">
          Buy AI credits
        </a>
      }
    />
  );
  if (!allowed) {
    return (
      <div className="space-y-5">
        {header}
        <p className="text-sm text-muted-foreground">Only a projects administrator sees AI usage.</p>
      </div>
    );
  }
  if (usage.isLoading) return <PageLoading />;
  if (usage.isError) return <ErrorBanner message="AI usage could not be loaded." />;
  const rep = usage.data;
  const totals = rep?.totals ?? [];
  const credits = totals.reduce((n, t) => n + t.credits, 0);
  const calls = totals.reduce((n, t) => n + t.calls, 0);

  return (
    <div className="space-y-5">
      {header}
      <div className="flex rounded-md border border-border p-0.5 sm:inline-flex" role="radiogroup" aria-label="Period">
        {PERIODS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => {
              setDays(d);
              setOffset(0);
            }}
            className={`h-10 flex-1 rounded px-3 text-sm sm:h-8 sm:flex-none ${days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Last {d} days
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums" data-testid="ai-usage-calls">
            {calls}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI credits used</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums" data-testid="ai-usage-credits">
            {credits}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">By feature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {totals.length === 0 ? (
              <p className="text-muted-foreground">No requests yet.</p>
            ) : (
              totals.map((t) => (
                <p key={t.feature} className="flex justify-between gap-2">
                  <span>{FEATURE_LABEL[t.feature] ?? t.feature}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.calls} / {t.credits} cr
                  </span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      {(rep?.items.length ?? 0) > 0 && (
        <DataTable columns={columns} rows={rep?.items ?? []} rowKey={(u) => u.id} gridLines="rows" storageKey="projects-ai-usage-columns" />
      )}
      {(rep?.total ?? 0) > PAGE && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" className="h-11 sm:h-9" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            Newer
          </Button>
          <span className="text-muted-foreground">
            {offset + 1} to {Math.min(offset + PAGE, rep?.total ?? 0)} of {rep?.total}
          </span>
          <Button variant="outline" className="h-11 sm:h-9" disabled={offset + PAGE >= (rep?.total ?? 0)} onClick={() => setOffset(offset + PAGE)}>
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
