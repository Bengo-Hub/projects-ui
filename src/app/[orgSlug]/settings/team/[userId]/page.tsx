'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, UserX } from 'lucide-react';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageHeader } from '@/components/common/page-header';
import { ListError } from '@/components/common/list-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoading } from '@/components/ui/loading';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useRbacPermissions, useRbacRoles, useRbacUser } from '@/hooks/useRbac';
import { isNotFound } from '@/lib/api/errors';
import { PERMS, assignmentState, effectivePermissionGroups, isAdminTier, roleName } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { MemberRolesDialog, personLabel } from '../member-roles-dialog';
import { PersonStatusDialog } from '../person-status-dialog';

/**
 * One person (GET /rbac/users/{id}): their roles with end dates, status, last seen and what their
 * roles add up to, grouped by module. The actions and their guards match the Team page: anyone
 * with rbac.manage opens the roles dialog, only admin tier changes the status, and nobody acts on
 * their own access.
 */
function Person() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const userId = (params?.userId as string) ?? '';
  const { profile, subject } = useServicePermissions();
  const me = profile?.user_id ?? '';
  const adminTier = isAdminTier(profile, !!subject?.bypass);

  const person = useRbacUser(orgSlug, userId);
  const roles = useRbacRoles(orgSlug);
  const registry = useRbacPermissions(orgSlug);
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const groups = useMemo(
    () => effectivePermissionGroups(person.data?.permissions ?? [], registry.data ?? []),
    [person.data?.permissions, registry.data],
  );
  const back = { href: `/${orgSlug}/settings/team`, label: 'Team' };

  if (person.isLoading || roles.isLoading) return <PageLoading />;
  if (person.isError || !person.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Person" back={back} className="mb-0" />
        {isNotFound(person.error) ? (
          <EmptyState icon={UserX} title="Person not found" description="They may never have opened projects in this organisation." />
        ) : (
          <ListError error={person.error} title="This person could not be loaded." onRetry={() => void person.refetch()} />
        )}
      </div>
    );
  }

  const u = person.data;
  const self = u.user_id === me;
  const inactive = u.status === 'inactive';
  const nameOf = (code: string) => roleList.find((r) => r.code === code)?.name || roleName(code);
  const count = u.permissions.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={personLabel(u)}
        subtitle={u.name && u.email ? u.email : undefined}
        back={back}
        className="mb-0"
        actions={
          self ? undefined : (
            <span className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setEditing(true)} aria-label={`Roles of ${personLabel(u)}`}>
                Roles
              </Button>
              {adminTier && (
                <Button
                  variant="outline"
                  className="h-11 sm:h-9"
                  onClick={() => setChangingStatus(true)}
                  aria-label={`${inactive ? 'Reactivate' : 'Deactivate'} ${personLabel(u)}`}
                >
                  {inactive ? 'Reactivate' : 'Deactivate'}
                </Button>
              )}
            </span>
          )
        }
      />
      {self && <p className="text-sm text-muted-foreground">This is you. Another administrator changes your access.</p>}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="person-facts">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-1">
            {inactive ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">Deactivated</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950/50 dark:text-green-200">Active</span>
            )}
            {inactive && u.deactivated_at && <span className="ml-2 text-xs text-muted-foreground">since {formatDate(u.deactivated_at)}</span>}
          </dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">Last seen</dt>
          <dd className="mt-1 text-sm">{u.last_seen_at ? formatDate(u.last_seen_at) : 'Not yet'}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">Permissions</dt>
          <dd className="mt-1 text-sm">{inactive ? 'None while deactivated' : `${count} from their roles`}</dd>
        </div>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {u.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No role. They get their automatic role on their next visit.</p>
          ) : (
            <ul className="space-y-2" aria-label="Roles held">
              {u.assignments.map((a) => {
                const state = assignmentState(a);
                return (
                  <li key={a.role_id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2', state === 'ended' && 'opacity-70')}>
                    <span className="min-w-0 truncate text-sm font-medium">{a.name || nameOf(a.role_code)}</span>
                    <span className="text-xs text-muted-foreground">
                      {state === 'ended'
                        ? `Ended ${formatDate(a.expires_at as string)}`
                        : state === 'ending'
                          ? `Until ${formatDate(a.expires_at as string)}`
                          : a.automatic
                            ? 'Automatic, from their organisation role'
                            : 'No end date'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What they can do</CardTitle>
          <p className="text-sm text-muted-foreground">Everything their running roles allow, including what a manage permission brings with it.</p>
        </CardHeader>
        <CardContent>
          {inactive ? (
            <p className="text-sm text-muted-foreground">Nothing while deactivated. Their roles come back into force when reactivated.</p>
          ) : groups.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No permissions" description="None of their roles allows anything yet." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="effective-permissions">
              {groups.map((g) => (
                <section key={g.module} aria-label={g.title} className="rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold">{g.title}</h3>
                  <ul className="mt-2 space-y-1">
                    {g.perms.map((p) => (
                      <li key={p.code} className="text-sm">
                        {p.code === PERMS.projectsManage ? 'Manage every project' : p.name}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MemberRolesDialog orgSlug={orgSlug} user={editing ? u : null} roles={roleList} adminTier={adminTier} onClose={() => setEditing(false)} />
      <PersonStatusDialog orgSlug={orgSlug} person={changingStatus ? u : null} onClose={() => setChangingStatus(false)} />
    </div>
  );
}

export default function PersonPage() {
  return (
    <RequirePermission anyOf={PERMS.rbacManage}>
      <Person />
    </RequirePermission>
  );
}
