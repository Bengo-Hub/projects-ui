import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/query-provider';

// The public invitee pages (/qa/{code}) and the owner link redirect. No tenant shell and no SSO
// redirect here: an invitee may have no account at all.
export default function QALayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
