'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, ShieldCheck, X } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { useDebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageHeader } from '@/components/common/page-header';
import { ListError, ListSearch } from '@/components/common/list-parts';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { QADialog } from '@/components/qa/qa-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoading } from '@/components/ui/loading';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useAssignRole, useRbacRoles, useRbacUsers, useRevokeRole } from '@/hooks/useRbac';
import { PERMS, roleName } from '@/lib/auth/permissions';
import type { RbacRole, RbacUser } from '@/lib/api/rbac';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_AUTH_UI_URL ?? 'https://accounts.codevertexafrica.com';

function displayName(u: RbacUser): string {
  return u.name || u.email || u.user_id;
}

function GiveRoleDialog({
  orgSlug,
  user,
  roles,
  onClose,
}: {
  orgSlug: string;
  user: RbacUser | null;
  roles: RbacRole[];
  onClose: () => void;
}) {
  const assign = useAssignRole(orgSlug);
  const [roleCode, setRoleCode] = useState('');
  const options = useMemo<ComboboxOption[]>(
    () =>
      roles
        .filter((r) => !user?.roles.includes(r.code))
        .map((r) => ({ value: r.code, label: r.name || roleName(r.code), description: r.description })),
    [roles, user],
  );

  function close() {
    setRoleCode('');
    onClose();
  }

  return (
    <QADialog
      open={!!user}
      onOpenChange={(o) => !o && close()}
      title="Give a role"
      description={user ? `${displayName(user)} keeps their other roles and can also do what this one allows.` : undefined}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!user || !roleCode) return;
          assign.mutate({ userId: user.user_id, roleCode }, { onSuccess: close });
        }}
      >
        <div>
          <span className="mb-1 block text-sm font-medium">Role</span>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">They already hold every role.</p>
          ) : (
            <SearchableCombobox options={options} value={roleCode} onChange={setRoleCode} placeholder="Choose a role" searchPlaceholder="Find a role" />
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!roleCode || assign.isPending}>
            {assign.isPending ? 'Saving...' : 'Give role'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

function RolesAndAccess() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { profile } = useServicePermissions();
  const me = profile?.user_id ?? '';
  const search = useDebouncedSearch();

  const roles = useRbacRoles(orgSlug);
  const users = useRbacUsers(orgSlug);
  const revoke = useRevokeRole(orgSlug);
  const [giving, setGiving] = useState<RbacUser | null>(null);
  const [revoking, setRevoking] = useState<{ user: RbacUser; roleCode: string } | null>(null);

  const roleList = useMemo(() => roles.data ?? [], [roles.data]);
  const rows = useMemo(() => {
    const all = users.data ?? [];
    const term = search.term.toLowerCase();
    if (!term) return all;
    return all.filter((u) => [u.name, u.email].some((v) => v?.toLowerCase().includes(term)));
  }, [users.data, search.term]);

  const columns = useMemo<DataTableColumn<RbacUser>[]>(() => {
    const nameOf = (code: string) => roleList.find((r) => r.code === code)?.name || roleName(code);
    return [
      {
        key: 'name',
        header: 'Person',
        primary: true,
        sortable: true,
        accessor: (u) => displayName(u),
        render: (u) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {displayName(u)}
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
        render: (u) =>
          u.roles.length === 0 ? (
            <span className="text-xs text-muted-foreground">No role yet</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {u.roles.map((code) => (
                <span key={code} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                  {nameOf(code)}
                  {u.user_id !== me && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevoking({ user: u, roleCode: code });
                      }}
                      className="-mr-1 grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove the ${nameOf(code)} role from ${displayName(u)}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </span>
              ))}
            </span>
          ),
      },
      { key: 'status', header: 'Status', sortable: true, filterable: true, hideBelow: 'md', render: (u) => <span className="text-sm capitalize text-muted-foreground">{u.status}</span> },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (u) =>
          u.user_id === me ? (
            <span className="text-xs text-muted-foreground">Another administrator changes your roles</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setGiving(u);
              }}
            >
              <Plus className="h-4 w-4" />
              Give role
            </Button>
          ),
      },
    ];
  }, [roleList, me]);

  if (roles.isLoading || users.isLoading) return <PageLoading />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles and access"
        subtitle="Who can do what in projects. People appear here after they first open projects or once you give them a role."
        className="mb-0"
      />

      {roles.isError ? (
        <ListError error={roles.error} title="The roles could not be loaded." onRetry={() => void roles.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roleList.map((r) => (
                <li key={r.code} className="rounded-md border border-border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{r.name || roleName(r.code)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.holders} {r.holders === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ListSearch search={search} label="Search people" busy={users.isFetching} />

      {users.isError ? (
        <ListError error={users.error} title="The people could not be loaded." onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={search.term ? 'Nobody matches that search' : 'Nobody here yet'}
          description={
            search.term
              ? `Nothing matches "${search.term}".`
              : 'People show here once they open projects. Invite people to the organisation in the accounts site.'
          }
          action={
            !search.term ? (
              <a href={`${ACCOUNTS_URL}/dashboard`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline">
                Open the accounts site
              </a>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(u) => u.user_id} gridLines="rows" storageKey="projects-rbac-users-columns" />
      )}

      <GiveRoleDialog orgSlug={orgSlug} user={giving} roles={roleList} onClose={() => setGiving(null)} />

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Remove this role?"
        description={
          revoking
            ? `${displayName(revoking.user)} loses what the ${roleName(revoking.roleCode)} role allowed, unless another of their roles allows it.`
            : undefined
        }
        confirmLabel="Remove role"
        variant="danger"
        loading={revoke.isPending}
        onConfirm={() => {
          if (!revoking) return;
          revoke.mutate({ userId: revoking.user.user_id, roleCode: revoking.roleCode }, { onSettled: () => setRevoking(null) });
        }}
      />
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission anyOf={PERMS.rbacManage}>
      <RolesAndAccess />
    </RequirePermission>
  );
}
