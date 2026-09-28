'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attachmentsApi, type CreateAttachmentInput } from '@/lib/api/attachments';

const KEY = 'attachments';

export function useProjectAttachments(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => attachmentsApi.listProject(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
}

export function useTaskAttachments(orgSlug: string, projectId: string, taskId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, taskId],
    queryFn: () => attachmentsApi.listTask(orgSlug, projectId, taskId),
    enabled: !!orgSlug && !!projectId && !!taskId,
  });
}

/** Adds to the task when taskId is given, otherwise to the project. */
export function useCreateAttachment(orgSlug: string, projectId: string, taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttachmentInput) =>
      taskId
        ? attachmentsApi.createOnTask(orgSlug, projectId, taskId, input)
        : attachmentsApi.createOnProject(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Attachment added');
    },
    onError: () => toast.error('Failed to add attachment'),
  });
}

export function useDeleteAttachment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attachmentsApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Attachment removed');
    },
    onError: () => toast.error('Failed to remove attachment'),
  });
}
