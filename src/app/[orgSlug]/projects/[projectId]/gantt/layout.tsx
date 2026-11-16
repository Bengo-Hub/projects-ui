'use client';

import type { ReactNode } from 'react';
import { RequirePermission } from '@/components/auth/require-permission';
import { PERMS } from '@/lib/auth/permissions';

/** The plan shows every task, so it needs the full tasks view (not view_own). */
export default function GanttLayout({ children }: { children: ReactNode }) {
  return <RequirePermission anyOf={PERMS.tasksView}>{children}</RequirePermission>;
}
