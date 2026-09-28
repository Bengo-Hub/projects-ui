'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commentsApi, type CreateCommentInput } from '@/lib/api/comments';

const KEY = 'comments';

export function useProjectComments(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => commentsApi.listProject(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
}

export function useTaskComments(orgSlug: string, projectId: string, taskId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, taskId],
    queryFn: () => commentsApi.listTask(orgSlug, projectId, taskId),
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
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
    },
    onError: () => toast.error('Failed to add comment'),
  });
}

export function useCreateTaskComment(orgSlug: string, projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      commentsApi.createOnTask(orgSlug, projectId, taskId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, taskId] });
    },
    onError: () => toast.error('Failed to add comment'),
  });
}

export function useUpdateComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCommentInput }) =>
      commentsApi.update(orgSlug, projectId, id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
    },
    onError: () => toast.error('Failed to update comment'),
  });
}

export function useDeleteComment(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commentsApi.delete(orgSlug, projectId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Comment deleted');
    },
    onError: () => toast.error('Failed to delete comment'),
  });
}
