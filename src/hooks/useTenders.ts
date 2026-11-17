'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  tendersApi,
  type ConvertInput,
  type CreateTenderInput,
  type DecisionInput,
  type ListTendersParams,
  type CreateEvaluationInput,
  type CreateMeetingInput,
  type OutcomeInput,
  type SectionInput,
  type SubmissionInput,
} from '@/lib/api/tenders';
import { putToStorage } from '@/lib/api/attachments';
import { apiErrorMessage, errorBody, forbiddenKind, onMutationError } from '@/lib/api/errors';

const KEY = 'tenders';
const PAGE = 20;

/** The tenders list, 20 a page, with Show more (filters and search run on the server). */
export function useTenderPages(orgSlug: string, params: Omit<ListTendersParams, 'page' | 'limit'>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, 'pages', params],
    queryFn: ({ pageParam }) => tendersApi.list(orgSlug, { ...params, limit: PAGE, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug,
  });
  return {
    ...query,
    tenders: (query.data?.pages ?? []).flatMap((p) => p.data ?? []),
    total: query.data?.pages[0]?.total ?? 0,
  };
}

/** Refreshes the tender and everything hanging off it after a lifecycle change. */
function useRefreshTender(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
    void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId] });
  };
}

export function useChangeTenderStatus(orgSlug: string, tenderId: string) {
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: (body: { status: string; note?: string }) => tendersApi.changeStatus(orgSlug, tenderId, body),
    onSuccess: () => {
      refresh();
      toast.success('Status changed');
    },
    onError: onMutationError('The status was not changed'),
  });
}

export function useEvaluationSummary(orgSlug: string, tenderId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'evaluation-summary'],
    queryFn: () => tendersApi.evaluationSummary(orgSlug, tenderId),
    enabled: enabled && !!orgSlug && !!tenderId,
  });
}

export function useDecideTender(orgSlug: string, tenderId: string) {
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: (body: DecisionInput) => tendersApi.decide(orgSlug, tenderId, body),
    onSuccess: (t) => {
      refresh();
      toast.success(t.status === 'no_go' ? 'Recorded as no go' : 'Go: the bid is being prepared');
    },
    onError: onMutationError('The decision was not saved'),
  });
}

export function useRecordOutcome(orgSlug: string, tenderId: string) {
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: (body: OutcomeInput) => tendersApi.recordOutcome(orgSlug, tenderId, body),
    onSuccess: (t) => {
      refresh();
      toast.success(t.status === 'awarded' ? 'Recorded as won' : 'Recorded as lost');
    },
    onError: onMutationError('The outcome was not saved'),
  });
}

export function useConvertTender(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: (body: ConvertInput) => tendersApi.convert(orgSlug, tenderId, body),
    onSuccess: (res) => {
      refresh();
      void qc.invalidateQueries({ queryKey: ['projects', orgSlug] });
      toast.success(res.already_converted ? 'This tender is already a project' : `Project ${res.project.name} created`);
    },
    onError: onMutationError('The tender was not converted'),
  });
}

export function usePushConversionBudget(orgSlug: string, tenderId: string) {
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: () => tendersApi.pushConversionBudget(orgSlug, tenderId),
    onSuccess: (res) => {
      refresh();
      if (res.budget.status === 'created') toast.success('Draft budget created in treasury');
      else toast.error(res.budget.error || 'Treasury did not take the budget');
    },
    onError: onMutationError('The budget was not sent'),
  });
}

// Sections.

export function useTenderSections(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'sections'],
    queryFn: () => tendersApi.listSections(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
  });
}

function useSectionMutation<V>(orgSlug: string, tenderId: string, fn: (v: V) => Promise<unknown>, ok: string, fail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'sections'] });
      toast.success(ok);
    },
    onError: onMutationError(fail),
  });
}

export function useCreateSection(orgSlug: string, tenderId: string) {
  return useSectionMutation(orgSlug, tenderId, (body: SectionInput) => tendersApi.createSection(orgSlug, tenderId, body), 'Section added', 'The section was not added');
}

export function useUpdateSection(orgSlug: string, tenderId: string) {
  return useSectionMutation(
    orgSlug,
    tenderId,
    ({ id, body }: { id: string; body: SectionInput }) => tendersApi.updateSection(orgSlug, tenderId, id, body),
    'Section saved',
    'The section was not saved',
  );
}

export function useDeleteSection(orgSlug: string, tenderId: string) {
  return useSectionMutation(orgSlug, tenderId, (id: string) => tendersApi.deleteSection(orgSlug, tenderId, id), 'Section removed', 'The section was not removed');
}

export function useSubmitSection(orgSlug: string, tenderId: string) {
  return useSectionMutation(orgSlug, tenderId, (id: string) => tendersApi.submitSection(orgSlug, tenderId, id), 'Sent for review', 'The section was not sent for review');
}

export function useReviewSection(orgSlug: string, tenderId: string) {
  return useSectionMutation(
    orgSlug,
    tenderId,
    ({ id, approve, comment }: { id: string; approve: boolean; comment: string }) =>
      approve ? tendersApi.approveSection(orgSlug, tenderId, id, comment) : tendersApi.requestSectionChanges(orgSlug, tenderId, id, comment),
    'Review saved',
    'The review was not saved',
  );
}

// Submissions.

export function useTenderSubmissions(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'submissions'],
    queryFn: () => tendersApi.listSubmissions(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
  });
}

export function useRecordSubmission(orgSlug: string, tenderId: string) {
  const refresh = useRefreshTender(orgSlug, tenderId);
  return useMutation({
    mutationFn: (body: SubmissionInput) => tendersApi.submit(orgSlug, tenderId, body),
    onSuccess: () => {
      refresh();
      toast.success('Submission recorded');
    },
    onError: onMutationError('The submission was not recorded'),
  });
}

// Documents.

export function useTenderDocuments(orgSlug: string, tenderId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, tenderId, 'documents'],
    queryFn: () => tendersApi.listDocuments(orgSlug, tenderId),
    enabled: !!orgSlug && !!tenderId,
    // Download links are signed for 15 minutes.
    staleTime: 10 * 60_000,
  });
}

/** The three-step upload (presigned PUT, the PUT, confirm), as for project files. */
export function useUploadTenderDocument(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || 'application/octet-stream';
      const ticket = await tendersApi.requestUpload(orgSlug, tenderId, { file_name: file.name, content_type: contentType, size: file.size });
      await putToStorage(ticket, file);
      return tendersApi.addDocument(orgSlug, tenderId, { key: ticket.key, file_name: file.name });
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'documents'] });
      toast.success(`${d.file_name} added`);
    },
    onError: (err) => {
      if (forbiddenKind(err)) return;
      if (errorBody(err)?.code === 'uploads_unavailable') {
        toast.error('File uploads are not available right now. Add a link instead, or try again later.');
        return;
      }
      toast.error(apiErrorMessage(err, 'The file could not be uploaded'));
    },
  });
}

export function useAddTenderLink(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { file_url: string; file_name: string }) => tendersApi.addDocument(orgSlug, tenderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'documents'] });
      toast.success('Link added');
    },
    onError: onMutationError('The link was not added'),
  });
}

export function useDeleteTenderDocument(orgSlug: string, tenderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => tendersApi.deleteDocument(orgSlug, tenderId, docId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, tenderId, 'documents'] });
      toast.success('Document removed');
    },
    onError: onMutationError('The document was not removed'),
  });
}

export function useTenders(orgSlug: string, params?: ListTendersParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, params],
    queryFn: () => tendersApi.list(orgSlug, params),
    enabled: enabled && !!orgSlug,
  });
}

export function useTender(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, id],
    queryFn: () => tendersApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useTenderMetrics(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'metrics'],
    queryFn: () => tendersApi.metrics(orgSlug),
    enabled: enabled && !!orgSlug,
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
    onError: onMutationError('Failed to create tender'),
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
    onError: onMutationError('Failed to update tender'),
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
    onError: onMutationError('Failed to delete tender'),
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
    onError: onMutationError('Failed to create committee'),
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
    onError: onMutationError('Failed to add committee member'),
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
    onError: onMutationError('Failed to remove committee member'),
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
    onError: onMutationError('Failed to submit evaluation'),
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
    onError: onMutationError('Failed to schedule meeting'),
  });
}
