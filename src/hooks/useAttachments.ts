'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attachmentsApi, putToStorage } from '@/lib/api/attachments';
import { apiErrorMessage, errorBody, forbiddenKind } from '@/lib/api/errors';

const KEY = 'attachments';

/** A task's files (taskId set) or the whole project's, newest first, 20 a page. */
export function useAttachments(orgSlug: string, projectId: string, taskId?: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, taskId ?? 'project'],
    queryFn: ({ pageParam }) =>
      taskId
        ? attachmentsApi.listTask(orgSlug, projectId, taskId, { limit: 20, page: pageParam })
        : attachmentsApi.listProject(orgSlug, projectId, { limit: 20, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug && !!projectId,
    // Download links are signed for 15 minutes.
    staleTime: 10 * 60_000,
  });
  return { ...query, files: (query.data?.pages ?? []).flatMap((p) => p.data ?? []) };
}

/**
 * The three-step upload: ask for a presigned PUT, PUT the file straight to storage with exactly the
 * signed headers, then confirm so the API checks the bytes and lists it.
 */
export function useUploadAttachment(orgSlug: string, projectId: string, taskId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || 'application/octet-stream';
      const ticket = await attachmentsApi.requestUpload(orgSlug, projectId, {
        file_name: file.name,
        content_type: contentType,
        size: file.size,
        task_id: taskId,
      });
      await putToStorage(ticket, file);
      return attachmentsApi.confirm(orgSlug, projectId, { key: ticket.key, file_name: file.name, task_id: taskId });
    },
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success(`${a.file_name} attached`);
    },
    onError: (err) => {
      if (forbiddenKind(err)) return;
      if (errorBody(err)?.code === 'uploads_unavailable') {
        toast.error('File uploads are not available right now. Try again later.');
        return;
      }
      toast.error(apiErrorMessage(err, 'The file could not be uploaded'));
    },
  });
}

export function useDeleteAttachment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attachmentsApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      toast.success('File removed');
    },
    onError: (err) => {
      if (forbiddenKind(err)) return;
      toast.error(apiErrorMessage(err, 'The file could not be removed'));
    },
  });
}
