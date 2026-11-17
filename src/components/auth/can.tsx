'use client';

import type { ReactNode } from 'react';
import { useServicePermissions } from '@/hooks/usePermissions';

/**
 * Shows its children only when the user holds the permission (or any of `any`), read from the one
 * resolver every check in the app uses: useServicePermissions (projects-api's GET /{tenant}/auth/me,
 * implications and the superuser and platform owner bypass included). A role edit in Roles and
 * access reaches every gated element within a minute, or at once on focus, with no code change.
 *
 *   <Can permission={PERMS.membersManage}><Button>Add member</Button></Can>
 *   <Can any={[PERMS.tasksChange, PERMS.tasksChangeOwn]} fallback={<ReadOnly />}>...</Can>
 *
 * Hiding a control is for clarity only: projects-api checks every request itself.
 */
export function Can({
  permission,
  any,
  fallback = null,
  children,
}: {
  /** One permission code. */
  permission?: string;
  /** Passes when the user holds any of these codes. */
  any?: readonly string[];
  /** Shown instead when the check fails (nothing by default). */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useServicePermissions();
  const codes = permission !== undefined ? [permission] : any ?? [];
  return <>{codes.length > 0 && can(codes) ? children : fallback}</>;
}
