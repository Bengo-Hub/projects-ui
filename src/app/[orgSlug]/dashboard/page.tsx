'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/common/page-header';
import { CountRow } from '@/components/common/list-parts';
import { useProjectMetrics, useProjects } from '@/hooks/useProjects';
import { useTenderMetrics, useTenders } from '@/hooks/useTenders';
import { useTaskTrend } from '@/hooks/useTasks';
import { TaskTrendChart } from '@/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { formatDistanceToNow } from 'date-fns';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';

export default function DashboardPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  // Each widget asks only for what the role can read, so the home page never trips a 403.
  const { can, isLoading: permsLoading } = useServicePermissions();
  const canProjects = can(PERMS.projectsView);
  const canTenders = can(PERMS.tendersView);
  // The tenant-wide trend is for people who see every project; projects-api refuses it otherwise.
  const canTrend = can(PERMS.projectsManage) && can(PERMS.tasksView);

  // Counts come from grouped metrics endpoints; the lists only feed the five most recent rows.
  const { data: projectMetrics, isLoading: metricsLoading, isError: projectsError } = useProjectMetrics(orgSlug, canProjects);
  const { data: tenderMetrics } = useTenderMetrics(orgSlug, canTenders);
  const { data: projectsData } = useProjects(orgSlug, { limit: 5 }, canProjects);
  const { data: tendersData } = useTenders(orgSlug, { limit: 5 }, canTenders);
  const { data: trend = [] } = useTaskTrend(orgSlug, undefined, 6, canTrend);

  const projects = projectsData?.data ?? [];
  const tenders = tendersData?.data ?? [];
  const byStatus = projectMetrics?.by_status ?? {};
  const activeProjects = byStatus.active ?? 0;
  const awardedTenders = tenderMetrics?.by_status?.awarded?.count ?? 0;

  if (permsLoading || metricsLoading) return <PageLoading />;
  if (projectsError) return <ErrorBanner message="Failed to load dashboard data." />;

  const counts = [
    ...(canProjects
      ? [
          { label: can(PERMS.projectsManage) ? 'Total projects' : 'My projects', value: projectMetrics?.total ?? 0 },
          { label: 'Active projects', value: activeProjects },
        ]
      : []),
    ...(canTenders
      ? [
          { label: 'Total tenders', value: tenderMetrics?.total ?? 0 },
          { label: 'Tenders awarded', value: awardedTenders },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of projects and tenders" className="mb-0" />

      {counts.length > 0 && <CountRow items={counts} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        {canProjects && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link
                href={`/${orgSlug}/projects`}
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No projects yet</p>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/${orgSlug}/projects/${project.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge status={project.status} className="ml-2 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Recent Tenders */}
        {canTenders && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Tenders</CardTitle>
              <Link
                href={`/${orgSlug}/tenders`}
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {tenders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No tenders yet</p>
            ) : (
              <div className="space-y-3">
                {tenders.map((tender) => (
                  <Link
                    key={tender.id}
                    href={`/${orgSlug}/tenders/${tender.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tender.title}</p>
                      <p className="text-xs text-muted-foreground">{tender.client_name}</p>
                    </div>
                    <Badge status={tender.status} className="ml-2 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Task flow */}
      {canTrend && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Flow (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.every((m) => !m.created && !m.completed && !m.overdue_at_month_end) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No task activity yet</p>
          ) : (
            <div className="h-64">
              <TaskTrendChart data={trend} />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Status breakdown */}
      {canProjects && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {['active', 'on_hold', 'completed', 'cancelled'].map((status) => ({ status, count: byStatus[status] ?? 0 })).map(({ status, count }) => (
              <div key={status} className="flex items-center gap-2">
                <Badge status={status} />
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
