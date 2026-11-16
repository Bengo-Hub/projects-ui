'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task } from '@/types';

function tasksIn(data: unknown): Task[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as { pages?: { data?: Task[] }[]; data?: unknown; id?: string; title?: string };
  if (Array.isArray(d.pages)) return d.pages.flatMap((p) => p.data ?? []);
  if (Array.isArray(d.data)) return d.data as Task[];
  if (typeof d.id === 'string' && typeof d.title === 'string') return [d as Task];
  return [];
}

/**
 * Looks a task's title up in what is already cached for the project (board columns, list,
 * calendar, Gantt, details), so a schedule conflict can name the blocking tasks without a request.
 */
export function useTaskTitles(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useCallback(
    (id: string): string | undefined => {
      for (const prefix of [['tasks', orgSlug, projectId], ['gantt', orgSlug, projectId]]) {
        for (const [, data] of qc.getQueriesData({ queryKey: prefix })) {
          const hit = tasksIn(data).find((t) => t.id === id);
          if (hit) return hit.title;
        }
      }
      return undefined;
    },
    [qc, orgSlug, projectId],
  );
}
