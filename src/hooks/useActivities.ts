'use client';

import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api/activities';

/** A task's history; the caller enables it only with projects.projects.view and while it is shown. */
export function useTaskActivities(orgSlug: string, projectId: string, taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', orgSlug, projectId, 'activity', taskId],
    queryFn: () => activitiesApi.listTask(orgSlug, projectId, taskId),
    enabled: enabled && !!orgSlug && !!projectId && !!taskId,
    select: (rows) => [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
  });
}
