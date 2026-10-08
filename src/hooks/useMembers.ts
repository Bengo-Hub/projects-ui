'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { membersApi, type AddMemberInput } from '@/lib/api/members';

const KEY = 'members';

export function useMembers(orgSlug: string, projectId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId],
    queryFn: () => membersApi.list(orgSlug, projectId),
    enabled: !!orgSlug && !!projectId,
  });
}

export function useAddMember(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => membersApi.add(orgSlug, projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Member added');
    },
    onError: () => toast.error('Failed to add member'),
  });
}

export function useUpdateMemberRole(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role_code }: { userId: string; role_code: string }) =>
      membersApi.updateRole(orgSlug, projectId, userId, { role_code }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });
}

export function useRemoveMember(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => membersApi.remove(orgSlug, projectId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId] });
      void qc.invalidateQueries({ queryKey: ['activities', orgSlug, projectId] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });
}
