'use client';

import type { ReactNode } from 'react';
import { RequirePermission } from '@/components/auth/require-permission';
import { PERMS } from '@/lib/auth/permissions';

export default function TasksLayout({ children }: { children: ReactNode }) {
  return <RequirePermission anyOf={[PERMS.tasksView, PERMS.tasksViewOwn]}>{children}</RequirePermission>;
}
