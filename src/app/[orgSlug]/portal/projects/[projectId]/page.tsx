'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, FileText, Flag, ListChecks, MessageSquare, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { InvoiceBadge } from '@/components/billing/invoice-badge';
import { moneyOf, safePayUrl } from '@/lib/billing/logic';
import { useTenantBranding } from '@bengo-hub/shared-ui-lib/tenant';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RichTextView } from '@/components/common/rich-text';
import { ShowMore } from '@/components/common/list-parts';
import { ClientThread } from '@/components/portal/client-thread';
import { MilestoneReview } from '@/components/portal/milestone-review';
import { PortalProgress } from '@/components/portal/portal-progress';
import { PortalRefused } from '@/components/portal/portal-refused';
import {
  usePortalFiles,
  usePortalInvoices,
  usePortalMilestones,
  usePortalPost,
  usePortalSummary,
  usePortalTasks,
  usePortalThread,
} from '@/hooks/usePortal';
import { errorBody, httpStatusOf } from '@/lib/api/errors';
import { fileSize } from '@/lib/work/files';
import { milestoneLabel, portalBase, portalRefusal } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import { usePortalAuthStore } from '@/store/portal-auth';

const TABS = [
  { key: 'milestones', label: 'Milestones', icon: Flag },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'files', label: 'Files', icon: FileText },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      {children}
    </section>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
      <span>{what} could not be loaded.</span>
      <button type="button" onClick={onRetry} className="h-10 rounded-md border border-border bg-background px-3 text-foreground">
        Try again
      </button>
    </div>
  );
}

function Skeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function Milestones({ orgSlug, projectId, focus }: { orgSlug: string; projectId: string; focus: string | null }) {
  const q = usePortalMilestones(orgSlug, projectId);
  useEffect(() => {
    if (focus && q.data) document.getElementById(`milestone-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus, q.data]);
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <LoadError what="The milestones" onRetry={() => void q.refetch()} />;
  const list = q.data ?? [];
  if (list.length === 0) return <EmptyState icon={Flag} title="No milestones yet" description="Milestones the team plans show here, with any that need your approval." />;
  return (
    <ul className="space-y-3">
      {list.map((m) => (
        <MilestoneReview key={m.id} orgSlug={orgSlug} projectId={projectId} milestone={m} highlighted={m.id === focus} />
      ))}
    </ul>
  );
}

function Tasks({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const q = usePortalTasks(orgSlug, projectId);
  if (q.isLoading) return <Skeleton rows={3} />;
  if (q.isError) return <LoadError what="The tasks" onRetry={() => void q.refetch()} />;
  if (q.items.length === 0) return <EmptyState icon={ListChecks} title="No shared tasks" description="The team has not shared any tasks with you yet." />;
  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {q.items.map((t) => (
          <li key={t.id} className="space-y-1.5 p-4" data-testid="portal-task">
            <div className="flex items-start justify-between gap-3">
              <p className="wrap-break-word text-sm font-medium">{t.title}</p>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{t.status_label || t.status}</span>
            </div>
            {t.description && <RichTextView value={t.description} className="text-sm text-muted-foreground" />}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
              {t.completed_at ? <span>Finished {formatDate(t.completed_at)}</span> : <span>{t.progress}% done</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid">
        <ShowMore show={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      </div>
    </>
  );
}

function Files({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const q = usePortalFiles(orgSlug, projectId);
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <LoadError what="The files" onRetry={() => void q.refetch()} />;
  if (q.items.length === 0) return <EmptyState icon={FileText} title="No shared files" description="Drawings, quotes and reports the team shares with you show here." />;
  return (
    <>
      <p className="text-xs text-muted-foreground">Download links last 15 minutes. Reopen this tab for fresh ones.</p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {q.items.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3" data-testid="portal-file">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {fileSize(f.file_size)} · {formatDate(f.uploaded_at)}
              </p>
            </div>
            {f.url ? (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-primary hover:bg-accent"
                aria-label={`Download ${f.file_name}`}
              >
                <Download className="h-4 w-4" aria-hidden />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </li>
        ))}
      </ul>
      <div className="grid">
        <ShowMore show={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      </div>
    </>
  );
}

function Invoices({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const q = usePortalInvoices(orgSlug, projectId);
  if (q.isLoading) return <Skeleton rows={1} />;
  if (q.isError) return <LoadError what="The invoices" onRetry={() => void q.refetch()} />;
  // available:false is the API saying billing is not connected to the portal yet: not an error.
  if (!q.available || q.items.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Invoices will appear here"
        description={
          q.available
            ? 'There are no invoices on this project yet.'
            : q.note || 'Your invoices for this project will be listed here once billing is connected. Until then the firm sends them directly.'
        }
      />
    );
  }
  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {q.items.map((inv) => {
          const pay = safePayUrl(inv.public_url);
          const due = moneyOf(inv.amount_due);
          return (
            <li key={inv.id} className="space-y-2 p-4" data-testid="portal-invoice">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{inv.invoice_number || 'Invoice'}</p>
                <InvoiceBadge invoice={inv} className="shrink-0" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{inv.invoice_date ? formatDate(inv.invoice_date) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd className={inv.is_overdue && due > 0 ? 'font-medium text-destructive' : undefined}>{inv.due_date ? formatDate(inv.due_date) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="tabular-nums">{formatCurrency(moneyOf(inv.total_amount), inv.currency || 'KES')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount due</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(due, inv.currency || 'KES')}</dd>
                </div>
              </dl>
              {pay && (
                <a
                  href={pay}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-primary hover:bg-accent"
                >
                  {due > 0 ? 'View and pay' : 'View invoice'}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <div className="grid">
        <ShowMore show={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      </div>
    </>
  );
}

function Messages({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const q = usePortalThread(orgSlug, projectId);
  const post = usePortalPost(orgSlug, projectId);
  const me = usePortalAuthStore((s) => s.user?.id);
  return (
    <ClientThread
      items={q.items}
      loading={q.isLoading}
      error={q.isError}
      onRetry={() => void q.refetch()}
      hasMore={!!q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onMore={() => void q.fetchNextPage()}
      meId={me}
      canPost
      posting={post.isPending}
      onPost={(content, done) => post.mutate(content, { onSuccess: done })}
      emptyText="No messages yet. Ask the team anything about the project here."
      placeholder="Write to the team"
    />
  );
}

export default function PortalProjectPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { tenant } = useTenantBranding();
  const firm = tenant?.orgName || tenant?.name || 'the firm';
  const focus = search?.get('milestone') ?? null;
  const requested = search?.get('tab') as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : 'milestones';
  const summary = usePortalSummary(orgSlug, projectId);
  const refusal = portalRefusal(httpStatusOf(summary.error), errorBody(summary.error)?.code);

  const back = (
    <Link href={portalBase(orgSlug)} className="inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      All projects
    </Link>
  );

  if (refusal === 'not_found') {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState icon={Flag} title="Project not found" description="This project is not shared with you, or the link is out of date." />
      </div>
    );
  }
  if (refusal === 'not_client' || refusal === 'no_feature') return <PortalRefused kind={refusal} firm={firm} />;

  const s = summary.data;
  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(search?.toString() ?? '');
    next.set('tab', key);
    if (key !== 'milestones') next.delete('milestone');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      {back}
      {summary.isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : summary.isError || !s ? (
        <LoadError what="The project" onRetry={() => void summary.refetch()} />
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="wrap-break-word font-display text-xl font-semibold">{s.name}</h1>
            <Badge status={s.status} className="shrink-0 capitalize" />
          </div>
          {(s.start_date || s.end_date) && (
            <p className="text-sm text-muted-foreground">
              {s.start_date ? formatDate(s.start_date) : 'Start not set'} to {s.end_date ? formatDate(s.end_date) : 'end not set'}
            </p>
          )}
          <PortalProgress value={s.progress} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Tasks done</dt>
              <dd className="font-semibold tabular-nums">
                {s.completed_tasks} of {s.total_tasks}
              </dd>
            </div>
            <div className="rounded-md bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Milestones done</dt>
              <dd className="font-semibold tabular-nums">
                {s.completed_milestones} of {s.total_milestones}
              </dd>
            </div>
          </dl>
          {s.awaiting_review > 0 ? (
            <button
              type="button"
              onClick={() => setTab('milestones')}
              className="w-full rounded-md border border-warning/30 bg-warning/10 p-3 text-left text-sm font-medium"
              data-testid="awaiting-review"
            >
              {s.awaiting_review === 1 ? 'One milestone is waiting for your review' : `${s.awaiting_review} milestones are waiting for your review`}
            </button>
          ) : (
            s.next_milestone && (
              <p className="text-sm">
                <span className="text-muted-foreground">Next milestone: </span>
                <span className="font-medium">{s.next_milestone.name}</span>
                {s.next_milestone.target_date && <span className="text-muted-foreground">, due {formatDate(s.next_milestone.target_date)}</span>}
                <span className="text-muted-foreground"> ({milestoneLabel(s.next_milestone.status).toLowerCase()})</span>
              </p>
            )
          )}
        </div>
      )}

      <div role="tablist" aria-label="Project sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
        {tab === 'milestones' && (
          <Section title="Milestones">
            <Milestones orgSlug={orgSlug} projectId={projectId} focus={focus} />
          </Section>
        )}
        {tab === 'tasks' && (
          <Section title="Tasks">
            <Tasks orgSlug={orgSlug} projectId={projectId} />
          </Section>
        )}
        {tab === 'files' && (
          <Section title="Files">
            <Files orgSlug={orgSlug} projectId={projectId} />
          </Section>
        )}
        {tab === 'invoices' && (
          <Section title="Invoices">
            <Invoices orgSlug={orgSlug} projectId={projectId} />
          </Section>
        )}
        {tab === 'messages' && (
          <Section title="Messages">
            <Messages orgSlug={orgSlug} projectId={projectId} />
          </Section>
        )}
      </div>
    </div>
  );
}
