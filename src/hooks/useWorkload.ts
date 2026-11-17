'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workloadApi, type WorkloadParams, type WorkloadSettings } from '@/lib/api/planning';
import { tasksApi } from '@/lib/api/tasks';
import { onMutationError } from '@/lib/api/errors';
import { reassignedIds } from '@/lib/planning/workload';

const KEY = 'workload';

/**
 * People by ISO week (sprint 16). Pass enabled=false unless the tenant has workload_planning and the
 * user holds projects.workload.view, so no request goes out that would be refused.
 */
export function useWorkload(orgSlug: string, params: WorkloadParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'grid', params],
    queryFn: () => workloadApi.get(orgSlug, params),
    enabled: enabled && !!orgSlug,
    staleTime: 30_000,
  });
}

/** The tasks behind one cell (a person or "unassigned", one week). */
export function useWorkloadTasks(orgSlug: string, cell: { userId: string; week: string } | null, includeDone = false) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'tasks', cell?.userId ?? '', cell?.week ?? '', includeDone],
    queryFn: () => workloadApi.tasks(orgSlug, { user_id: cell!.userId, week: cell!.week, ...(includeDone ? { include_done: true } : {}) }),
    enabled: !!orgSlug && !!cell,
  });
}

export function useWorkloadSettings(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'settings'],
    queryFn: () => workloadApi.settings(orgSlug),
    enabled: enabled && !!orgSlug,
  });
}

export function useSaveWorkloadSettings(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkloadSettings) => workloadApi.saveSettings(orgSlug, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Capacity saved');
    },
    onError: onMutationError('The capacity was not saved'),
  });
}

/**
 * Reassigns a task from the workload view through the normal task update (assignee_ids replaces the
 * assignees, the first is primary). It reads the task first so the other assignees stay: the person
 * the cell belongs to is swapped for the new one. The grid and the cell's list reload after.
 */
export function useReassignTask(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, taskId, from, to }: { projectId: string; taskId: string; from: string; to: string }) => {
      const task = await tasksApi.get(orgSlug, projectId, taskId);
      const current = (task.edges?.assignees ?? []).map((a) => a.user_id);
      return tasksApi.update(orgSlug, projectId, taskId, { assignee_ids: reassignedIds(current, from, to) });
    },
    onSuccess: (_, { projectId }) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['my-work', orgSlug] });
      toast.success('Task reassigned');
    },
    onError: onMutationError('The task was not reassigned'),
  });
}
