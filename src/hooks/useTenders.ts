'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  tendersApi,
  type CreateTenderInput,
  type ListTendersParams,
  type CreateEvaluationInput,
  type CreateMeetingInput,
} from '@/lib/api/tenders';

const KEY = 'tenders';

export function useTenders(orgSlug: string, params?: ListTendersParams) {
  return useQuery({
    queryKey: [KEY, orgSlug, params],
    queryFn: () => tendersApi.list(orgSlug, params),
    enabled: !!orgSlug,
  });
}

export function useTender(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, id],
    queryFn: () => tendersApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useTenderMetrics(orgSlug: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'metrics'],
    queryFn: () => tendersApi.metrics(orgSlug),
    enabled: !!orgSlug,
  });
}

export function useCreateTender(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTenderInput) => tendersApi.create(orgSlug, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Tender created');
    },
    onError: () => toast.error('Failed to create tender'),
  });
}

export function useUpdateTender(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTenderInput> }) =>
      tendersApi.update(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, id] });
      toast.success('Tender updated');
    },
    onError: () => toast.error('Failed to update tender'),
  });
}

export function useDeleteTender(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tendersApi.delete(orgSlug, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      toast.success('Tender deleted');
    },
    onError: () => toast.error('Failed to delete tender'),
  });
}

// Committees
export function useTenderCommittees(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'committees'],
    queryFn: () => tendersApi.listCommittees(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
  });
}

export function useCreateCommittee(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => tendersApi.createCommittee(orgSlug, tenderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'committees'] });
      toast.success('Committee created');
    },
    onError: () => toast.error('Failed to create committee'),
  });
}

export function useAddCommitteeMember(orgSlug: string, tenderId: string, committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; role?: string }) =>
      tendersApi.addCommitteeMember(orgSlug, tenderId, committeeId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'committees'] });
      toast.success('Member added to committee');
    },
    onError: () => toast.error('Failed to add committee member'),
  });
}

export function useRemoveCommitteeMember(orgSlug: string, tenderId: string, committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      tendersApi.removeCommitteeMember(orgSlug, tenderId, committeeId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'committees'] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove committee member'),
  });
}

// Evaluations
export function useTenderEvaluations(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'evaluations'],
    queryFn: () => tendersApi.listEvaluations(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
  });
}

export function useSubmitEvaluation(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEvaluationInput) => tendersApi.submitEvaluation(orgSlug, tenderId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'evaluations'] });
      toast.success('Evaluation submitted');
    },
    onError: () => toast.error('Failed to submit evaluation'),
  });
}

// Meetings
export function useTenderMeetings(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'meetings'],
    queryFn: () => tendersApi.listMeetings(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
  });
}

export function useScheduleMeeting(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => tendersApi.scheduleMeeting(orgSlug, tenderId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'meetings'] });
      toast.success('Meeting scheduled');
    },
    onError: () => toast.error('Failed to schedule meeting'),
  });
}
