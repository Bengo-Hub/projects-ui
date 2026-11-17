'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageHeader } from '@/components/common/page-header';
import { ListError } from '@/components/common/list-parts';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useDeleteRole, useRbacRoles } from '@/hooks/useRbac';
import { PERMS, isAdminTier, isReservedRole, roleDeletable, roleKind } from '@/lib/auth/permissions';
import type { RbacRole } from '@/lib/api/rbac';
import { cn } from '@/lib/utils';
import { PermissionEditor } from './permission-editor';
import { RoleChanges } from './role-changes';
import { RoleFormDialog, type RoleFormMode } from './role-form-dialog';

const KIND_CLASS: Record<ReturnType<typeof roleKind>, string> = {
  Default: 'border border-border text-muted-foreground',
  Customised: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  'Your role': 'bg-secondary text-secondary-foreground',
};

function RolesAndAccess() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { profile, subject } = useServicePermissions();
  const adminTier = isAdminTier(profile, !!subject?.bypass);
  const myRoles = profile?.roles ?? [];
  const roles = useRbacRoles(orgSlug);
  const remove = useDeleteRole(orgSlug);
  // Selection follows the code: the first edit of a default role gives it a new id.
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormMode | null>(null);
  const [deleting, setDeleting] = useState<RbacRole | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  if (roles.isLoading) return <PageLoading />;
  const list = roles.data ?? [];
  const selected = list.find((r) => r.code === selectedCode) ?? list[0] ?? null;

  const openRole = (role: RbacRole) => {
    setSelectedCode(role.code);
    // On a phone the editor sits below the list, so opening a role brings it into view.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles and access"
        subtitle={
          <>
            What each role can do. Changes apply at once to everyone holding the role, and only in your organisation.{' '}
            <Link className="text-primary underline" href={`/${orgSlug}/settings/team`}>
              Team
            </Link>
          </>
        }
        className="mb-0"
        actions={
          adminTier ? (
            <Button onClick={() => setForm({ kind: 'new' })}>
              <Plus className="h-4 w-4" aria-hidden />
              New role
            </Button>
          ) : undefined
        }
      />

      {roles.isError ? (
        <ListError error={roles.error} title="The roles could not be loaded." onRetry={() => void roles.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Card className="self-start">
            <CardContent className="p-2">
              <ul className="space-y-1" aria-label="Roles">
                {list.map((role) => {
                  const active = selected?.id === role.id;
                  const kind = roleKind(role);
                  return (
                    <li key={role.id} className={cn('flex items-center gap-1 rounded-lg', active && 'bg-primary/10')}>
                      <button type="button" aria-current={active} className="min-h-11 min-w-0 flex-1 rounded-lg p-2 text-left" onClick={() => openRole(role)}>
                        <span className="block truncate text-sm font-medium">{role.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', KIND_CLASS[kind])}>{kind}</span>
                          {myRoles.includes(role.code) && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">You hold this</span>
                          )}
                          {role.holders} {role.holders === 1 ? 'person' : 'people'}
                        </span>
                      </button>
                      {adminTier && !isReservedRole(role.code) && (
                        <button
                          type="button"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                          aria-label={`Copy ${role.name}`}
                          onClick={() => setForm({ kind: 'copy', source: role })}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                      {adminTier && roleDeletable(role) && (
                        <button
                          type="button"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${role.name}`}
                          onClick={() => setDeleting(role)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <div ref={editorRef} className="min-w-0 scroll-mt-20">
            {selected && (
              <PermissionEditor
                key={selected.id}
                orgSlug={orgSlug}
                role={selected}
                adminTier={adminTier}
                onRename={() => setForm({ kind: 'rename', role: selected })}
              />
            )}
          </div>
        </div>
      )}

      <RoleChanges orgSlug={orgSlug} />

      <RoleFormDialog orgSlug={orgSlug} mode={form} onClose={() => setForm(null)} onSaved={(code) => setSelectedCode(code)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'role'}?`}
        description={
          deleting?.is_customized
            ? 'Your organisation goes back to the default role. Anyone still holding this one has to be moved to another role first.'
            : 'This cannot be undone. Anyone still holding the role has to be moved to another role first.'
        }
        confirmLabel="Delete role"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => setSelectedCode(null),
            onSettled: () => setDeleting(null),
          });
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
