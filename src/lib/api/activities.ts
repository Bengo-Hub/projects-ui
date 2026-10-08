import { apiClient } from './client';
import type { Activity, PaginatedResponse } from '@/types';

export const activitiesApi = {
  listProject: (orgSlug: string, projectId: string) =>
    apiClient.get<PaginatedResponse<Activity>>(`/api/v1/${orgSlug}/projects/${projectId}/activities`),
  listTask: (orgSlug: string, projectId: string, taskId: string) =>
    apiClient.get<PaginatedResponse<Activity>>(
      `/api/v1/${orgSlug}/projects/${projectId}/tasks/${taskId}/activities`
    ),
};
