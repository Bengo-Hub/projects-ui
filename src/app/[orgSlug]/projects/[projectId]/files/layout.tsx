'use client';

import type { ReactNode } from 'react';
import { RequirePermission } from '@/components/auth/require-permission';
import { PERMS } from '@/lib/auth/permissions';

/** Files hang off comments on the API (comments.view to list, comments.add to upload). */
export default function FilesLayout({ children }: { children: ReactNode }) {
  return <RequirePermission anyOf={PERMS.commentsView}>{children}</RequirePermission>;
}
