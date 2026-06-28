'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckSquare, Users, Flag, Calendar, ArrowLeft, Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useProject, useProjectSummary } from '@/hooks/useProjects';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { format } from 'date-fns';

export default function ProjectDetailPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';

  const { data: project, isLoading, isError } = useProject(orgSlug, projectId);
  const { data: summary } = useProjectSummary(orgSlug, projectId);

  // Premium tabs gated by plan feature. Tabs without a feature are part of the
  // `project_management` base (already gated at the sidebar/workspace level).
  const hasGantt = useFeature('gantt_chart');
  const hasMilestoneBilling = useFeature('milestone_billing');

  if (isLoading) return <PageLoading />;
  if (isError || !project) return <ErrorBanner message="Failed to load project." />;

  const subNav: { href: string; label: string; feature?: string; locked?: boolean }[] = [
    { href: `/${orgSlug}/projects/${projectId}/tasks`, label: 'Tasks' },
    {
      href: `/${orgSlug}/projects/${projectId}/milestones`,
      label: 'Milestones',
      feature: 'milestone_billing',
      locked: !hasMilestoneBilling,
    },
    { href: `/${orgSlug}/projects/${projectId}/team`, label: 'Team' },
    {
      href: `/${orgSlug}/projects/${projectId}/gantt`,
      label: 'Gantt',
      feature: 'gantt_chart',
      locked: !hasGantt,
    },
  ];

  const tasksDone = summary?.tasks_done ?? summary?.completed_tasks ?? 0;
  const tasksTotal = summary?.tasks_total ?? summary?.total_tasks ?? 0;
  const progress = summary?.progress ?? (tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href={`/${orgSlug}/projects`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          All Projects
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
          <Badge status={project.status} />
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-border">
        {subNav.map(({ href, label, locked }) =>
          locked ? (
            <a
              key={href}
              href={UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={`Upgrade to unlock ${label}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {label}
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 border border-amber-500/20">
                <Lock className="h-2.5 w-2.5" />
                Pro
              </span>
            </a>
          ) : (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          )
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{tasksDone}/{tasksTotal}</p>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 flex items-center justify-center">
                <span className="text-sm font-bold text-green-600">{progress}%</span>
              </div>
              <div>
                <p className="text-lg font-bold">{progress}%</p>
                <p className="text-xs text-muted-foreground">Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-lg font-bold">{project.edges?.members?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-lg font-bold">{project.edges?.milestones?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Milestones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {tasksTotal > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {project.start_date && (
              <>
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </dt>
                <dd className="font-medium">{format(new Date(project.start_date), 'MMM d, yyyy')}</dd>
              </>
            )}
            {project.end_date && (
              <>
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  End Date
                </dt>
                <dd className="font-medium">{format(new Date(project.end_date), 'MMM d, yyyy')}</dd>
              </>
            )}
            {project.budget != null && (
              <>
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="font-medium">
                  {project.currency} {project.budget.toLocaleString()}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{format(new Date(project.created_at), 'MMM d, yyyy')}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
