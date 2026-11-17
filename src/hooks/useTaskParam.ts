'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The open task lives in the URL (?task=<id>, plus ?project=<id> on My Work, which spans projects),
 * so a notification link such as /{org}/projects/{id}/tasks?task={id} opens the drawer directly.
 */
export function useTaskParam() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const taskId = params?.get('task') ?? '';
  const projectId = params?.get('project') ?? '';

  const setParams = useCallback(
    (mutate: (p: URLSearchParams) => void, mode: 'push' | 'replace') => {
      const p = new URLSearchParams(params?.toString() ?? '');
      mutate(p);
      const qs = p.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  const open = useCallback(
    (id: string, project?: string) =>
      setParams((p) => {
        p.set('task', id);
        if (project) p.set('project', project);
      }, 'push'),
    [setParams],
  );
  const close = useCallback(
    () =>
      setParams((p) => {
        p.delete('task');
        p.delete('project');
      }, 'replace'),
    [setParams],
  );
  /** Sets or clears another query value (view, zoom) without adding history. */
  const setValue = useCallback(
    (key: string, value: string | null) =>
      setParams((p) => {
        if (value) p.set(key, value);
        else p.delete(key);
      }, 'replace'),
    [setParams],
  );

  /** Sets or clears several query values in one replace (two setValue calls would race). */
  const setValues = useCallback(
    (values: Record<string, string | null>) =>
      setParams((p) => {
        for (const [key, value] of Object.entries(values)) {
          if (value) p.set(key, value);
          else p.delete(key);
        }
      }, 'replace'),
    [setParams],
  );

  return { taskId, projectId, open, close, setValue, setValues, get: (key: string) => params?.get(key) ?? '' };
}
