'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { forbiddenKind, httpStatusOf, notifyForbiddenMutation } from '@/lib/api/errors';

// The query cache is built once, so it reaches the current route through this handler, which the
// provider replaces on every route change.
let onQueryForbidden: ((err: unknown) => void) | null = null;

/**
 * The query client with the 403 rules of the SSO guide: a permission or tenant 403 on a page load
 * sends the user to /{orgSlug}/unauthorized; on a save it is a toast naming the missing permission.
 * Subscription 403s (upgrade:true) are the API client's upgrade notice and never redirect.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string | undefined) ?? '';

  useEffect(() => {
    onQueryForbidden = (err) => {
      const kind = forbiddenKind(err);
      if (kind !== 'permission' && kind !== 'tenant') return;
      if (!orgSlug || pathname?.endsWith('/unauthorized')) return;
      router.replace(`/${orgSlug}/unauthorized`);
    };
    return () => {
      onQueryForbidden = null;
    };
  }, [router, pathname, orgSlug]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: (err) => onQueryForbidden?.(err) }),
        mutationCache: new MutationCache({ onError: (err) => notifyForbiddenMutation(err) }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            // A refusal or a missing record does not change on a retry.
            retry: (failureCount, err) => {
              const s = httpStatusOf(err);
              if (s === 401 || s === 403 || s === 404) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
