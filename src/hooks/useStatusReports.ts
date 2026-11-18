'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { digestApi, reportsApi } from '@/lib/api/reports';
import { errorBody, forbiddenKind } from '@/lib/api/errors';
import { reportErrorText } from '@/lib/reports/logic';
import type { DigestSettings, ReportCreateInput, ReportUpdateInput, StatusReport } from '@/types/reports';

const KEY = 'status-reports';
const PAGE = 20;

/** A project's report history, newest period first, a page at a time. Needs reports.view. */
export function useStatusReports(orgSlug: string, projectId: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: [KEY, orgSlug, projectId, 'list'],
    queryFn: ({ pageParam }) => reportsApi.list(orgSlug, projectId, { limit: PAGE, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 30_000,
  });
  return { ...query, items: (query.data?.pages ?? []).flatMap((p) => p.data ?? []), total: query.data?.pages[0]?.total ?? 0 };
}

export function useStatusReport(orgSlug: string, projectId: string, id: string | null) {
  return useQuery({
    queryKey: [KEY, orgSlug, projectId, 'one', id],
    queryFn: () => reportsApi.get(orgSlug, projectId, id ?? ''),
    enabled: !!orgSlug && !!projectId && !!id,
  });
}

/**
 * A refused write in plain words. A plan or permission 403 was already explained by the API client
 * and the query client; a code the caller shows inline (passed in quiet) is left to it.
 */
export function onReportError(fallback: string, quiet: readonly string[] = []) {
  return (err: unknown) => {
    if (forbiddenKind(err)) return;
    const body = errorBody(err);
    if (body?.code && quiet.includes(body.code)) return;
    toast.error(reportErrorText(body?.code, body?.error, fallback), { id: `report-${body?.code ?? 'error'}` });
  };
}

function useStore(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return (r?: StatusReport) => {
    if (r?.id) qc.setQueryData([KEY, orgSlug, projectId, 'one', r.id], r);
    void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'list'] });
  };
}

/** Opens a filled draft. A 409 report_exists is shown by the dialog, not toasted. */
export function useCreateReport(orgSlug: string, projectId: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: (body: ReportCreateInput) => reportsApi.create(orgSlug, projectId, body),
    onSuccess: (r) => {
      store(r);
      toast.success('Draft report opened and filled from the project');
    },
    onError: onReportError('The report was not opened', ['report_exists', 'validation_error']),
  });
}

export function useUpdateReport(orgSlug: string, projectId: string, id: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: (body: ReportUpdateInput) => reportsApi.update(orgSlug, projectId, id, body),
    onSuccess: (r) => {
      store(r);
      toast.success('Draft saved');
    },
    onError: onReportError('The draft was not saved'),
  });
}

export function useRefreshReport(orgSlug: string, projectId: string, id: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: () => reportsApi.refresh(orgSlug, projectId, id),
    onSuccess: (r) => {
      store(r);
      toast.success('Filled again from the project. Your ratings, narrative and highlights stayed.');
    },
    onError: onReportError('The report was not refreshed'),
  });
}

/** A 422 (no overall rating) is shown beside the button, not toasted. */
export function usePublishReport(orgSlug: string, projectId: string, id: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: () => reportsApi.publish(orgSlug, projectId, id),
    onSuccess: (r) => {
      store(r);
      toast.success('Report published');
    },
    onError: onReportError('The report was not published', ['validation_error']),
  });
}

export function useDeleteReport(orgSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.delete(orgSlug, projectId, id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: [KEY, orgSlug, projectId, 'one', id] });
      void qc.invalidateQueries({ queryKey: [KEY, orgSlug, projectId, 'list'] });
      toast.success('Draft deleted');
    },
    onError: onReportError('The draft was not deleted'),
  });
}

export function useShareReport(orgSlug: string, projectId: string, id: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: (includeFinancials: boolean) => reportsApi.share(orgSlug, projectId, id, includeFinancials),
    onSuccess: (r) => {
      store(r);
      toast.success('Shared with the client. They find it under Reports in the portal.');
    },
    onError: onReportError('The report was not shared'),
  });
}

export function useUnshareReport(orgSlug: string, projectId: string, id: string) {
  const store = useStore(orgSlug, projectId);
  return useMutation({
    mutationFn: () => reportsApi.unshare(orgSlug, projectId, id),
    onSuccess: (r) => {
      store(r);
      toast.success('Taken out of the portal');
    },
    onError: onReportError('The report was not taken out of the portal'),
  });
}

const DIGEST_KEY = 'digest-settings';

/** The weekly digest switch; readable with reports.view. */
export function useDigestSettings(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [DIGEST_KEY, orgSlug],
    queryFn: () => digestApi.get(orgSlug),
    enabled: enabled && !!orgSlug,
    staleTime: 60_000,
  });
}

/** Only the admin tier can change it; a 403 admin_required is toasted in plain words. */
export function useSaveDigest(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DigestSettings) => digestApi.save(orgSlug, body),
    onSuccess: (s) => {
      qc.setQueryData([DIGEST_KEY, orgSlug], s);
      toast.success(s.weekly_enabled ? 'The weekly digest is on' : 'The weekly digest is off');
    },
    onError: onReportError('The digest setting was not saved'),
  });
}
