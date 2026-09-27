'use client';

import { useQuery } from '@tanstack/react-query';
import { financialsApi, type PortfolioParams } from '@/lib/api/financials';

const KEY = 'financials';

export function useProjectFinancials(orgSlug: string, projectId: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'project', projectId],
    queryFn: () => financialsApi.project(orgSlug, projectId),
    enabled: enabled && !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}

export function usePortfolio(orgSlug: string, params?: PortfolioParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'portfolio', params],
    queryFn: () => financialsApi.portfolio(orgSlug, params),
    enabled: enabled && !!orgSlug,
    staleTime: 60_000,
  });
}
