import { apiClient } from './client';
import type { Activity } from '@/types';

export const activitiesApi = {
  /** A task's history, newest first (needs projects.projects.view). */
  listTask: (orgSlug: string, projectId: string, taskId: string) =>
    apiClient
      .get<{ data: Activity[] }>(`/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/activities`)
      .then((r) => r.data ?? []),
};
