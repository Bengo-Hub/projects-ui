'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { templatesApi, type SaveAsTemplateInput, type StartFromTemplateInput } from '@/lib/api/planning';
import { errorBody, forbiddenKind, onMutationError } from '@/lib/api/errors';

const KEY = 'project-templates';

/** The template gallery: system templates first, then by name. Up to 100, searched by name. */
export function useTemplates(orgSlug: string, q: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, q],
    queryFn: () => templatesApi.list(orgSlug, { q: q || undefined, limit: 100 }),
    enabled: enabled && !!orgSlug,
    staleTime: 60_000,
  });
}

/** Starts a project from a template; the caller routes to the new project. */
export function useStartFromTemplate(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, body }: { templateId: string; body: StartFromTemplateInput }) => templatesApi.start(orgSlug, templateId, body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['projects', orgSlug] });
      toast.success(`Project created with ${res.task_count} ${res.task_count === 1 ? 'task' : 'tasks'} and ${res.milestone_count} ${res.milestone_count === 1 ? 'milestone' : 'milestones'}`);
    },
    onError: onMutationError('The project was not created'),
  });
}

export function useSaveAsTemplate(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveAsTemplateInput) => templatesApi.saveFrom(orgSlug, projectId, body),
    onSuccess: (tpl) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success(`Template "${tpl.name}" saved`);
    },
    onError: onMutationError('The template was not saved'),
  });
}

export function useDeleteTemplate(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(orgSlug, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Template deleted');
    },
    onError: (err) => {
      if (errorBody(err)?.code === 'system_template') {
        toast.error('Starter templates come with the app and cannot be deleted.');
        return;
      }
      if (forbiddenKind(err)) return;
      onMutationError('The template was not deleted')(err);
    },
  });
}
