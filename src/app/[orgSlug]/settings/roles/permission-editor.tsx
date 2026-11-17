'use client';

import { useMemo, useState } from 'react';
import { Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { useRbacPermissions, useRolePermissionCodes, useSetRolePermissions } from '@/hooks/useRbac';
import {
  PERMISSION_NOTES,
  groupByModule,
  isReservedRole,
  lockedBy,
  moduleTitle,
  permissionName,
  permissionSetProblem,
  roleKind,
  type PermissionCode,
} from '@/lib/auth/permissions';
import type { RbacPermission, RbacRole } from '@/lib/api/rbac';
import { cn } from '@/lib/utils';

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((c) => b.has(c));
}

function viaLabel(code: string): string {
  return code.endsWith('.manage') ? 'via manage' : `via ${permissionName(code)}`;
}

/** Rendered only once the role's real codes are known, so a save never starts from empty. */
function EditorForm({
  orgSlug,
  role,
  catalogue,
  current,
  readOnly,
  readOnlyReason,
  onRename,
}: {
  orgSlug: string;
  role: RbacRole;
  catalogue: RbacPermission[];
  current: string[];
  readOnly: boolean;
  readOnlyReason: string;
  onRename: () => void;
}) {
  const saved = useMemo(() => new Set(current), [current]);
  const [selected, setSelected] = useState(saved);
  const save = useSetRolePermissions(orgSlug);
  const list = useMemo(() => [...selected], [selected]);
  const modules = useMemo(() => groupByModule(catalogue), [catalogue]);
  const problem = permissionSetProblem(list);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  const setAll = (perms: RbacPermission[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (on) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{role.name}</h2>
            <p className="text-xs text-muted-foreground">
              {roleKind(role)} role, {role.holders} {role.holders === 1 ? 'person' : 'people'}
            </p>
            {role.description && <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 sm:h-9" onClick={onRename}>
                <Pencil className="h-4 w-4" aria-hidden />
                Rename
              </Button>
              <Button
                className="h-11 sm:h-9"
                disabled={save.isPending || !!problem || sameSet(selected, saved)}
                onClick={() => save.mutate({ roleId: role.id, codes: list })}
              >
                {save.isPending ? 'Saving...' : 'Save permissions'}
              </Button>
            </div>
          )}
        </div>

        {readOnly ? (
          <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            {readOnlyReason}
          </p>
        ) : role.scope === 'global' ? (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            This is a default role. Your first change makes your organisation&apos;s own copy, and everyone holding it moves to
            the copy. Other organisations keep the default.
          </p>
        ) : null}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {modules.map(({ module, perms }) => {
            const allOn = perms.every((p) => selected.has(p.code) || !!lockedBy(p.code, list));
            return (
              <fieldset key={module} className="rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-semibold">{moduleTitle(module)}</legend>
                {!readOnly && (
                  <button type="button" className="mb-1 min-h-9 text-xs text-primary underline" onClick={() => setAll(perms, !allOn)}>
                    {allOn ? 'Clear all' : 'Select all'}
                  </button>
                )}
                {perms.map((p) => {
                  const via = lockedBy(p.code, list);
                  const checked = selected.has(p.code) || !!via;
                  const note = PERMISSION_NOTES[p.code as PermissionCode];
                  return (
                    <div key={p.code} className="py-0.5">
                      <label className={cn('flex min-h-10 items-center gap-2 text-sm', (readOnly || via) && 'cursor-default')}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={checked}
                          disabled={readOnly || !!via}
                          onChange={() => toggle(p.code)}
                        />
                        <span className={cn('min-w-0', p.code === 'projects.projects.manage' && 'font-medium')}>
                          {p.code === 'projects.projects.manage' ? 'Manage every project' : p.name}
                        </span>
                        {via && (
                          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground" title={`Granted by ${permissionName(via)}`}>
                            {viaLabel(via)}
                          </span>
                        )}
                      </label>
                      {note && <p className="ml-6 text-xs text-muted-foreground">{note}</p>}
                    </div>
                  );
                })}
              </fieldset>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** The permissions of one role, editable by an administrator except for the read only roles. */
export function PermissionEditor({
  orgSlug,
  role,
  adminTier,
  onRename,
}: {
  orgSlug: string;
  role: RbacRole;
  adminTier: boolean;
  onRename: () => void;
}) {
  const catalogue = useRbacPermissions(orgSlug);
  const current = useRolePermissionCodes(orgSlug, role.id);

  if (catalogue.isError || current.isError) return <ErrorBanner message="This role could not be loaded. Try again." />;
  if (!catalogue.data || !current.data) return <PageLoading />;
  const reserved = isReservedRole(role.code);
  const readOnly = reserved || !adminTier;
  const reason = reserved
    ? role.code === 'client'
      ? 'The client role is read only: it gives client portal access and nothing else.'
      : 'The projects administrator role is read only: it always holds every permission.'
    : 'Only an administrator of your organisation can change roles.';
  return (
    <EditorForm
      key={`${role.id}:${current.data.join(',')}`}
      orgSlug={orgSlug}
      role={role}
      catalogue={catalogue.data}
      current={current.data}
      readOnly={readOnly}
      readOnlyReason={reason}
      onRename={onRename}
    />
  );
}
