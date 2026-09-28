'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FolderKanban, CheckSquare, FileText, TrendingUp } from 'lucide-react';
import { useProjectMetrics, useProjects } from '@/hooks/useProjects';
import { useTenderMetrics, useTenders } from '@/hooks/useTenders';
import { useTaskTrend } from '@/hooks/useTasks';
import { TaskTrendChart } from '@/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  // Counts come from grouped metrics endpoints; the lists only feed the five most recent rows.
  const { data: projectMetrics, isLoading: metricsLoading, isError: projectsError } = useProjectMetrics(orgSlug);
  const { data: tenderMetrics } = useTenderMetrics(orgSlug);
  const { data: projectsData } = useProjects(orgSlug, { limit: 5 });
  const { data: tendersData } = useTenders(orgSlug, { page_size: 5 });
  const { data: trend = [] } = useTaskTrend(orgSlug, undefined, 6);

  const projects = projectsData?.data ?? [];
  const tenders = tendersData?.data ?? [];
  const byStatus = projectMetrics?.by_status ?? {};
  const activeProjects = byStatus.active ?? 0;
  const awardedTenders = tenderMetrics?.by_status?.awarded?.count ?? 0;

  if (metricsLoading) return <PageLoading />;
  if (projectsError) return <ErrorBanner message="Failed to load dashboard data." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of projects and tenders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <FolderKanban className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projectMetrics?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <CheckSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeProjects}</p>
                <p className="text-xs text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenderMetrics?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Tenders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{awardedTenders}</p>
                <p className="text-xs text-muted-foreground">Tenders Awarded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
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

        {/* Recent Tenders */}
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
      </div>

      {/* Task flow */}
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

      {/* Status breakdown */}
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
    </div>
  );
}
