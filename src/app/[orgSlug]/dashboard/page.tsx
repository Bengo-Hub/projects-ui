'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FolderKanban, CheckSquare, FileText, TrendingUp } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useTenders } from '@/hooks/useTenders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  const { data: projectsData, isLoading: projectsLoading, isError: projectsError } = useProjects(orgSlug);
  const { data: tendersData, isLoading: tendersLoading } = useTenders(orgSlug);

  const projects = projectsData?.data ?? [];
  const tenders = tendersData?.data ?? [];

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const activeTenders = tenders.filter((t) => ['draft', 'evaluating', 'submitted'].includes(t.status)).length;
  const awardedTenders = tenders.filter((t) => t.status === 'awarded').length;

  if (projectsLoading && tendersLoading) return <PageLoading />;
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
                <p className="text-2xl font-bold">{projects.length}</p>
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
                <p className="text-2xl font-bold">{tenders.length}</p>
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
                {projects.slice(0, 5).map((project) => (
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
                {tenders.slice(0, 5).map((tender) => (
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

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {[
              { status: 'active', count: activeProjects },
              { status: 'on_hold', count: projects.filter((p) => p.status === 'on_hold').length },
              { status: 'completed', count: completedProjects },
              { status: 'cancelled', count: projects.filter((p) => p.status === 'cancelled').length },
            ].map(({ status, count }) => (
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
