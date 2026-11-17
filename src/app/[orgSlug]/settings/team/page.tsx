'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useDebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageHeader } from '@/components/common/page-header';
import { ListError, ListSearch } from '@/components/common/list-parts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoading } from '@/components/ui/loading';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useRbacRoles, useRbacUsers } from '@/hooks/useRbac';
import { PERMS, assignmentState, isAdminTier, roleName } from '@/lib/auth/permissions';
import type { RbacUser } from '@/lib/api/rbac';
import { InviteDialog } from './invite-dialog';
import { MemberRolesDialog, personLabel } from './member-roles-dialog';
import { PersonStatusDialog } from './person-status-dialog';

const PAGE_SIZE = 50;

function RoleBadges({ user, nameOf }: { user: RbacUser; nameOf: (code: string) => string }) {
  const running = user.assignments.filter((a) => assignmentState(a) !== 'ended');
  if (running.length === 0) return <span className="text-xs text-muted-foreground">No role</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {running.map((a) => (
        <span
          key={a.role_id}
          className={
            a.expires_at
              ? 'inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
              : 'inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium'
          }
        >
          {a.name || nameOf(a.role_code)}
          {a.expires_at ? ` until ${formatDate(a.expires_at)}` : ''}
        </span>
      ))}
    </span>
  );
}

function Team() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { profile, subject } = useServicePermissions();
  const me = profile?.user_id ?? '';
  const adminTier = isAdminTier(profile, !!subject?.bypass);
  const search = useDebouncedSearch();
  // A new search starts again on page 1.
  const [paging, setPaging] = useState({ term: '', page: 1 });
  const page = paging.term === search.term ? paging.page : 1;
  const setPage = (p: number) => setPaging({ term: search.term, page: p });

  const roles = useRbacRoles(orgSlug);
  const users = useRbacUsers(orgSlug, { search: search.term || undefined, page, limit: PAGE_SIZE });
  const [inviting, setInviting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFor, setStatusFor] = useState<RbacUser | null>(null);

  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const rows = useMemo(() => users.data?.data ?? [], [users.data]);
  // The dialog follows the live row, so a role given there shows at once.
  const editing = rows.find((u) => u.user_id === editingId) ?? null;
  const total = users.data?.total ?? 0;

  const personHref = useCallback((userId: string) => `/${orgSlug}/settings/team/${userId}`, [orgSlug]);

  const columns = useMemo<DataTableColumn<RbacUser>[]>(() => {
    const nameOf = (code: string) => roleList.find((r) => r.code === code)?.name || roleName(code);
    return [
      {
        key: 'name',
        header: 'Person',
        primary: true,
        accessor: (u) => personLabel(u),
        render: (u) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">
              <Link
                href={personHref(u.user_id)}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline"
                aria-label={`Open ${personLabel(u)}`}
              >
                {personLabel(u)}
              </Link>
              {u.user_id === me && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
            </span>
            {u.name && u.email && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
          </span>
        ),
      },
      {
        key: 'roles',
        header: 'Roles',
        accessor: (u) => u.roles.map(nameOf).join(', '),
        render: (u) => <RoleBadges user={u} nameOf={nameOf} />,
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (u) => (u.status === 'inactive' ? 'Deactivated' : 'Active'),
        render: (u) =>
          u.status === 'inactive' ? (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">Deactivated</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950/50 dark:text-green-200">Active</span>
          ),
      },
      {
        key: 'last_seen_at',
        header: 'Last seen',
        hideBelow: 'md',
        accessor: (u) => u.last_seen_at ?? '',
        render: (u) => <span className="text-sm text-muted-foreground">{u.last_seen_at ? formatDate(u.last_seen_at) : 'Not yet'}</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (u) =>
          u.user_id === me ? (
            <span className="text-xs text-muted-foreground">Another administrator changes your access</span>
          ) : (
            <span className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(u.user_id);
                }}
                aria-label={`Roles of ${personLabel(u)}`}
              >
                Roles
              </Button>
              {adminTier && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusFor(u);
                  }}
                  aria-label={`${u.status === 'inactive' ? 'Reactivate' : 'Deactivate'} ${personLabel(u)}`}
                >
                  {u.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                </Button>
              )}
            </span>
          ),
      },
    ];
  }, [roleList, me, adminTier, personHref]);

  if (roles.isLoading || (users.isLoading && !users.data)) return <PageLoading />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        subtitle={
          <>
            Who uses projects and what they can do.{' '}
            <Link className="text-primary underline" href={`/${orgSlug}/settings/roles`}>
              Edit roles
            </Link>
          </>
        }
        className="mb-0"
        actions={
          adminTier ? (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Invite person
            </Button>
          ) : undefined
        }
      />

      <ListSearch search={search} label="Search people" busy={users.isFetching} />

      {users.isError ? (
        <ListError error={users.error} title="The team could not be loaded." onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search.term ? 'Nobody matches that search' : 'Nobody here yet'}
          description={search.term ? `Nothing matches "${search.term}".` : 'Invite people by email, or they appear once they open projects.'}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(u) => u.user_id}
          gridLines="rows"
          storageKey="projects-team-people-columns"
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          total={total}
          onRowClick={(u) => router.push(personHref(u.user_id))}
        />
      )}

      <InviteDialog orgSlug={orgSlug} open={inviting} roles={roleList} adminTier={adminTier} onClose={() => setInviting(false)} />
      <MemberRolesDialog orgSlug={orgSlug} user={editing} roles={roleList} adminTier={adminTier} onClose={() => setEditingId(null)} />
      <PersonStatusDialog orgSlug={orgSlug} person={statusFor} onClose={() => setStatusFor(null)} />
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequirePermission anyOf={PERMS.rbacManage}>
      <Team />
    </RequirePermission>
  );
}
