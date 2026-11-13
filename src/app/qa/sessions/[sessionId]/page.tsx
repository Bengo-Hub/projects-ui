'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/store/auth';

/**
 * projects-api's notices link the owner to /qa/sessions/{id}, without the organisation. Send the
 * person to the session under their own organisation; with no saved sign-in, to the home page,
 * which starts sign-in.
 */
export default function QASessionLinkPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.sessionId as string) ?? '';

  useEffect(() => {
    let slug = useAuthStore.getState().user?.tenant_slug ?? '';
    if (!slug) {
      try {
        slug = localStorage.getItem('tenantSlug') ?? '';
      } catch {
        slug = '';
      }
    }
    router.replace(slug ? `/${encodeURIComponent(slug)}/qa/sessions/${encodeURIComponent(sessionId)}` : '/');
  }, [router, sessionId]);

  return <Loading className="min-h-screen" text="Opening the session..." />;
}
