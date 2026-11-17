'use client';

import type { ReactNode } from 'react';
import { RequirePermission } from '@/components/auth/require-permission';
import { PERMS } from '@/lib/auth/permissions';

// time.view and time.manage imply view_own, so this one code admits every role that reads time.
export default function TimeLayout({ children }: { children: ReactNode }) {
  return <RequirePermission anyOf={[PERMS.timeViewOwn]}>{children}</RequirePermission>;
}
