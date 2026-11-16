'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commentsApi, type CreateCommentInput, type ListCommentsParams } from '@/lib/api/comments';
import { onMutationError } from '@/lib/api/errors';
import { newIdempotencyKey, sendOrQueue } from '@/hooks/useOfflineQueue';

const KEY = 'comments';
const DEFAULT_PAGE: Required<ListCommentsParams> = { limit: 50, page: 1 };
/** The task detail carries this many of the latest comments. */
export const DETAIL_COMMENTS = 50;

export function useProjectComments(orgSlug: string, projectId: string, params: ListCommentsParams = DEFAULT_PAGE) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, params],
    queryFn: () => commentsApi.listProject(orgSlug, projectId, params),
    enabled: !!orgSlug && !!projectId,
  });
}

/**
 * Older task comments, newest page first. The list is oldest first and the detail already holds
 * the latest 50, so paging walks back from the page that ends just before them; overlap with the
 * detail is removed by the caller (by id).
 */
export function useOlderTaskComments(orgSlug: string, projectId: string, taskId: string, total: number, enabled: boolean) {
  const older = Math.max(0, total - DETAIL_COMMENTS);
  const firstPage = Math.ceil(older / DETAIL_COMMENTS);
  return useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, taskId, 'older', total],
    queryFn: ({ pageParam }) => commentsApi.listTask(orgSlug, projectId, taskId, { limit: DETAIL_COMMENTS, page: pageParam }),
    initialPageParam: firstPage,
    getNextPageParam: (_last, _all, page) => (page > 1 ? page - 1 : undefined),
    enabled: enabled && older > 0 && !!orgSlug && !!projectId && !!taskId,
  });
}

export function useCreateProjectComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => commentsApi.createOnProject(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
    },
    onError: onMutationError('Failed to add comment'),
  });
}

/**
 * Adds a task comment; offline it is queued and sent on reconnect. The comment's Idempotency-Key
 * goes with the first send and every replay, so a post whose answer was lost never doubles.
 */
export function useCreateTaskComment(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: CreateCommentInput) => {
      const key = newIdempotencyKey();
      return sendOrQueue({ kind: 'comment', key, orgSlug, projectId, taskId, content: input.content }, () =>
        commentsApi.createOnTask(orgSlug, projectId, taskId, input, key),
      );
    },
    onSuccess: (res) => {
      if (res.queued) {
        toast.info('You are offline. The comment is saved here and will be posted when you reconnect.', { id: 'offline-queued' });
        return;
      }
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, taskId] });
      // The task detail carries the latest comments and the count.
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId, 'detail', taskId] });
    },
    onError: onMutationError('Failed to add comment'),
  });
}

export function useUpdateComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCommentInput }) => commentsApi.update(orgSlug, projectId, id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId, 'detail'] });
    },
    onError: onMutationError('Failed to update comment'),
  });
}

export function useDeleteComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['tasks', orgSlug, projectId, 'detail'] });
      toast.success('Comment deleted');
    },
    onError: onMutationError('Failed to delete comment'),
  });
}
