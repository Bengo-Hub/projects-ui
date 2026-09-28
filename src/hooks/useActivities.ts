'use client';

import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api/activities';

const KEY = 'activities';

// The feed refreshes every 30 s while the page is open, so teammates' changes show up
// without a reload. The API has no push channel yet.
const REFRESH_MS = 30_000;

export function useProjectActivities(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => activitiesApi.listProject(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
    refetchInterval: REFRESH_MS,
  });
}

export function useTaskActivities(orgSlug: string, projectId: string, taskId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, taskId],
    queryFn: () => activitiesApi.listTask(orgSlug, projectId, taskId),
    enabled: !!orgSlug && !!projectId && !!taskId,
    refetchInterval: REFRESH_MS,
  });
}
