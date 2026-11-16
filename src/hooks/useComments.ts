'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commentsApi, type CreateCommentInput, type ListCommentsParams } from '@/lib/api/comments';
import { onMutationError } from '@/lib/api/errors';

const KEY = 'comments';
const DEFAULT_PAGE: Required<ListCommentsParams> = { limit: 50, page: 1 };

export function useProjectComments(orgSlug: string, projectId: string, params: ListCommentsParams = DEFAULT_PAGE) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, params],
    queryFn: () => commentsApi.listProject(orgSlug, projectId, params),
    enabled: !!orgSlug && !!projectId,
  });
}

/** Older task comments; the task detail already holds the latest 50. */
export function useTaskComments(orgSlug: string, projectId: string, taskId: string, params: ListCommentsParams = DEFAULT_PAGE) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, taskId, params],
    queryFn: () => commentsApi.listTask(orgSlug, projectId, taskId, params),
    enabled: !!orgSlug && !!projectId && !!taskId,
  });
}

export function useCreateProjectComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      commentsApi.createOnProject(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
    },
    onError: onMutationError('Failed to add comment'),
  });
}

export function useCreateTaskComment(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      commentsApi.createOnTask(orgSlug, projectId, taskId, input),
    onSuccess: () => {
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
    mutationFn: ({ id, data }: { id: string; data: CreateCommentInput }) =>
      commentsApi.update(orgSlug, projectId, id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
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
      toast.success('Comment deleted');
    },
    onError: onMutationError('Failed to delete comment'),
  });
}
