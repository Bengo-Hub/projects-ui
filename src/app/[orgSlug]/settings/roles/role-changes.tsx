'use client';

import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoleChanges } from '@/hooks/useRbac';
import { auditLabel, auditSubject } from '@/lib/auth/permissions';
import type { RbacAuditLog } from '@/lib/api/rbac';

const columns: DataTableColumn<RbacAuditLog>[] = [
  { key: 'action', header: 'Change', primary: true, accessor: (c) => auditLabel(c.action) },
  { key: 'subject', header: 'Role or person', accessor: (c) => auditSubject(c.changes) },
  { key: 'by', header: 'Changed by', hideBelow: 'md', accessor: (c) => c.actor_email || 'An administrator' },
  { key: 'when', header: 'When', align: 'right', accessor: (c) => c.created_at, render: (c) => <span className="text-muted-foreground">{formatDateTime(c.created_at)}</span> },
];

/** Who changed which roles and people, newest first. */
export function RoleChanges({ orgSlug }: { orgSlug: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useRoleChanges(orgSlug, page);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role changes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? null : isError ? (
          <p className="text-sm text-muted-foreground">The changes could not be loaded.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes yet. They appear here as roles and people are edited.</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            gridLines="rows"
            storageKey="projects-role-changes-columns"
            page={page}
            totalPages={Math.max(1, Math.ceil(total / 20))}
            onPageChange={setPage}
            total={total}
          />
        )}
      </CardContent>
    </Card>
  );
}
