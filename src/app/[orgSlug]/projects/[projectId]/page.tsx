'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useProject, useProjectSummary } from '@/hooks/useProjects';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageHeader } from '@/components/common/page-header';
import { CountRow } from '@/components/common/list-parts';
import { RichTextView } from '@/components/common/rich-text';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { useServicePermissions } from '@/hooks/usePermissions';
import { isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';

export default function ProjectDetailPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';

  const { data: project, isLoading, isError, error } = useProject(orgSlug, projectId);
  const { data: summary } = useProjectSummary(orgSlug, projectId);
  const { can } = useServicePermissions();

  // Premium tabs gated by plan feature. Tabs without a feature are part of the
  // `project_management` base (already gated at the sidebar/workspace level).
  const hasGantt = useFeature('gantt_chart');
  const hasMilestoneBilling = useFeature('milestone_billing');
  const hasBudgetTracking = useFeature('budget_tracking');

  if (isLoading) return <PageLoading />;
  if (isNotFound(error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (isError || !project) return <ErrorBanner message="Failed to load project." />;

  // Each tab shows only when the role can open it (the same codes its page guard checks).
  const subNav: { href: string; label: string; locked?: boolean; perm: string | string[] }[] = [
    { href: `/${orgSlug}/projects/${projectId}/tasks`, label: 'Tasks', perm: [PERMS.tasksView, PERMS.tasksViewOwn] },
    {
      href: `/${orgSlug}/projects/${projectId}/milestones`,
      label: 'Milestones',
      locked: !hasMilestoneBilling,
      perm: PERMS.milestonesView,
    },
    { href: `/${orgSlug}/projects/${projectId}/team`, label: 'Team', perm: PERMS.membersView },
    {
      href: `/${orgSlug}/projects/${projectId}/gantt`,
      label: 'Gantt',
      locked: !hasGantt,
      perm: PERMS.tasksView,
    },
    {
      href: `/${orgSlug}/projects/${projectId}/financials`,
      label: 'Financials',
      locked: !hasBudgetTracking,
      perm: PERMS.financialsView,
    },
  ].filter((t) => can(t.perm));

  const tasksDone = summary?.completed_tasks ?? 0;
  const tasksTotal = summary?.total_tasks ?? 0;
  const progress = summary?.progress ?? (tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        back={{ href: `/${orgSlug}/projects`, label: 'All projects' }}
        actions={<Badge status={project.status} />}
        className="mb-0"
      />
      {project.description && <RichTextView value={project.description} className="text-muted-foreground" />}

      {/* Sub-navigation */}
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:px-0">
        {subNav.map(({ href, label, locked }) =>
          locked ? (
            <a
              key={href}
              href={UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={`Upgrade to unlock ${label}`}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              {label}
              <span className="flex items-center gap-1 rounded-full border border-warning/20 bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                <Lock className="h-2.5 w-2.5" />
                Pro
              </span>
            </a>
          ) : (
            <Link
              key={href}
              href={href}
              className="shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          )
        )}
      </div>

      <CountRow
        items={[
          { label: 'Tasks done', value: `${tasksDone}/${tasksTotal}` },
          { label: 'Progress', value: `${progress}%` },
          { label: 'Members', value: project.edges?.members?.length ?? 0 },
          { label: 'Milestones', value: project.edges?.milestones?.length ?? 0 },
        ]}
      />

      {/* Progress bar */}
      {tasksTotal > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Overall progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            {project.start_date && (
              <>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Start date
                </dt>
                <dd className="font-medium">{formatDate(project.start_date)}</dd>
              </>
            )}
            {project.end_date && (
              <>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  End date
                </dt>
                <dd className="font-medium">{formatDate(project.end_date)}</dd>
              </>
            )}
            {project.budget != null && (
              <>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="font-medium tabular">{formatCurrency(project.budget, project.currency)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{formatDate(project.created_at)}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
