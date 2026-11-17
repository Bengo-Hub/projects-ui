'use client';

import { useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/common/page-header';
import { ChangeList } from '@/components/planning/change-list';
import { ChangeRequestDetail } from '@/components/planning/change-request-detail';
import { useChangeQueue } from '@/hooks/useChangeRequests';
import { useProjects } from '@/hooks/useProjects';
import { useTaskParam } from '@/hooks/useTaskParam';
import type { ChangeStatus } from '@/lib/api/planning';
import { cn } from '@/lib/utils';

const LIMIT = 100;
const TABS: { key: ChangeStatus | ''; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: '', label: 'All' },
];

/**
 * The approvals queue (projects.change_approvals.manage): change requests waiting for a decision
 * across every project the approver can see, oldest questions answered from one place. The open
 * request lives in the URL (?cr=<id>&project=<id>).
 */
export default function ApprovalsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const url = useTaskParam();
  const tab = url.get('show') === 'all' ? '' : 'pending';
  const queue = useChangeQueue(orgSlug, { limit: LIMIT, ...(tab ? { status: tab } : {}) });
  const projects = useProjects(orgSlug, { limit: 100 });
  const names = useMemo(() => new Map((projects.data?.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const projectName = useCallback((id: string) => names.get(id) ?? 'Project', [names]);
  const rows = queue.data?.data ?? [];
  const total = queue.data?.total ?? 0;
  const openId = url.get('cr');
  const openProject = url.get('in');

  return (
    <div className="space-y-4">
      <PageHeader title="Approvals" subtitle="Change requests from every project, waiting for your decision" className="mb-0" />
      <div role="tablist" aria-label="Which changes" className="flex gap-1 self-start rounded-lg bg-muted p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => url.setValue('show', t.key ? null : 'all')}
            className={cn('h-10 flex-1 rounded-md px-4 text-sm font-medium sm:h-8', tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
            {t.key === 'pending' && tab === 'pending' && queue.data ? ` (${total})` : ''}
          </button>
        ))}
      </div>
      <ChangeList
        rows={rows}
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        onOpen={(cr) => url.setValues({ in: cr.project_id, cr: cr.id })}
        projectName={projectName}
        emptyText={tab ? 'Nothing is waiting for a decision.' : 'No change requests yet.'}
      />
      {total > rows.length && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {rows.length} of {total}.
        </p>
      )}
      <ChangeRequestDetail
        orgSlug={orgSlug}
        projectId={openProject}
        id={openProject ? openId : ''}
        onClose={() => url.setValues({ cr: null, in: null })}
      />
    </div>
  );
}
