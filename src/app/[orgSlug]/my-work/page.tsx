'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleCheckBig } from 'lucide-react';
import { formatDate, getActiveTimeZone } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { CountRow, ListError, ShowMore } from '@/components/common/list-parts';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { TaskDrawer } from '@/components/work/task-drawer';
import { useMyWork, useMyWorkCounts } from '@/hooks/useTasks';
import { useTaskAccess } from '@/hooks/useTaskAccess';
import { useTaskParam } from '@/hooks/useTaskParam';
import type { MyWorkBucket, Task } from '@/types';
import { cn } from '@/lib/utils';

const BUCKETS: { key: MyWorkBucket; label: string; empty: string }[] = [
  { key: 'overdue', label: 'Overdue', empty: 'Nothing overdue.' },
  { key: 'today', label: 'Today', empty: 'Nothing due today.' },
  { key: 'week', label: 'This week', empty: 'Nothing else due in the next six days.' },
  { key: 'later', label: 'Later', empty: 'Nothing due later or undated.' },
];

function Row({ task, orgSlug, onOpen, overdue }: { task: Task; orgSlug: string; onOpen: () => void; overdue: boolean }) {
  const project = task.edges?.project;
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={onOpen} className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center text-left">
        <span className="w-full truncate text-sm font-medium">{task.title}</span>
        <span className="flex w-full items-center gap-2 text-xs text-muted-foreground">
          {project && <span className="truncate">{project.name}</span>}
          {task.due_date && <span className={cn('shrink-0', overdue && 'font-medium text-destructive')}>Due {formatDate(task.due_date)}</span>}
        </span>
      </button>
      <Badge status={task.priority} className="shrink-0" />
      {project && (
        <Link href={`/${orgSlug}/projects/${project.id}/tasks?task=${task.id}`} className="hidden shrink-0 text-xs text-primary hover:underline sm:inline">
          Open in project
        </Link>
      )}
    </li>
  );
}

function Bucket({ orgSlug, tz, bucket, label, empty, count, onOpen }: { orgSlug: string; tz: string; bucket: MyWorkBucket; label: string; empty: string; count?: number; onOpen: (t: Task) => void }) {
  const list = useMyWork(orgSlug, bucket, tz);
  return (
    <section aria-labelledby={`bucket-${bucket}`} className="space-y-2" data-testid={`bucket-${bucket}`}>
      <h2 id={`bucket-${bucket}`} className="flex items-center gap-2 text-sm font-semibold">
        {label}
        {count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{count}</span>}
      </h2>
      {list.isError ? (
        <ListError error={list.error} title={`${label} could not be loaded`} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <div className="h-14 animate-pulse rounded-md bg-muted" />
      ) : list.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {list.tasks.map((t) => (
            <Row key={t.id} task={t} orgSlug={orgSlug} onOpen={() => onOpen(t)} overdue={bucket === 'overdue'} />
          ))}
        </ul>
      )}
      <div className="grid">
        <ShowMore show={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
      </div>
    </section>
  );
}

/** My Work (US-12.8): everything assigned to me across projects, by when it is due. */
export default function MyWorkPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tz = useMemo(() => getActiveTimeZone() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const access = useTaskAccess();
  const counts = useMyWorkCounts(orgSlug, tz);
  const url = useTaskParam();
  const c = counts.data;
  const none = !!c && c.overdue + c.today + c.week + c.later === 0;

  if (!access.isLoading && !access.tracking) {
    return <FeatureLocked title="Task tracking is not on your plan" description="Upgrade your plan to see your tasks across projects in one place." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My work" subtitle="Open tasks assigned to you across your projects, soonest due first." className="mb-0" />
      <CountRow
        items={[
          { label: 'Overdue', value: c?.overdue ?? '' },
          { label: 'Today', value: c?.today ?? '' },
          { label: 'This week', value: c?.week ?? '' },
          { label: 'Later', value: c?.later ?? '' },
        ]}
      />
      {none ? (
        <EmptyState icon={CircleCheckBig} title="You are all caught up" description="Nothing open is assigned to you. New assignments show up here." />
      ) : (
        BUCKETS.map((b) => (
          <Bucket key={b.key} orgSlug={orgSlug} tz={tz} bucket={b.key} label={b.label} empty={b.empty} count={c?.[b.key]} onOpen={(t) => url.open(t.id, t.edges?.project?.id ?? t.project_id)} />
        ))
      )}
      {url.taskId && url.projectId && (
        <TaskDrawer orgSlug={orgSlug} projectId={url.projectId} taskId={url.taskId} onClose={url.close} onOpenTask={(id) => url.open(id, url.projectId)} />
      )}
    </div>
  );
}
