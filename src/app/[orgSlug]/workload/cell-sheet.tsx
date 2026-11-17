'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, UserRoundCog } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMembers } from '@/hooks/useMembers';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useReassignTask, useWorkloadTasks } from '@/hooks/useWorkload';
import type { WorkloadTask } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import { personLabel } from '@/lib/work/people';
import { hoursText, weekLabel } from '@/lib/planning/workload';

export interface CellRef {
  /** A user id or "unassigned". */
  userId: string;
  who: string;
  week: string;
}

/** The people of the task's project, to hand the task to one of them. */
function ReassignPicker({ orgSlug, row, from, onDone }: { orgSlug: string; row: WorkloadTask; from: string; onDone: () => void }) {
  const members = useMembers(orgSlug, row.project_id);
  const reassign = useReassignTask(orgSlug);
  const options: ComboboxOption[] = (members.data?.data ?? [])
    .filter((m) => !m.left_at && m.user_id !== from)
    .map((m) => ({ value: m.user_id, label: personLabel({ userId: m.user_id, name: m.name, email: m.email }), hint: m.email || undefined }));
  return (
    <div className="space-y-1" data-testid="reassign-picker">
      <SearchableCombobox
        options={options}
        value=""
        onChange={(to) => to && reassign.mutate({ projectId: row.project_id, taskId: row.task_id, from, to }, { onSuccess: onDone })}
        placeholder={members.isLoading ? 'Loading the team' : 'Hand it to'}
        searchPlaceholder="Find a project member"
        emptyText="Only the project's team can take it"
        disabled={reassign.isPending}
      />
      {reassign.isPending && <p className="text-xs text-muted-foreground">Reassigning...</p>}
    </div>
  );
}

function TaskRow({ orgSlug, row, from, canReassign }: { orgSlug: string; row: WorkloadTask; from: string; canReassign: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="space-y-2 py-3" data-testid="workload-task">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/${orgSlug}/projects/${row.project_id}/tasks?task=${row.task_id}`} className="inline-flex items-center gap-1 break-words text-sm font-medium hover:underline">
            {row.title}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </Link>
          <p className="text-xs text-muted-foreground">
            {row.project_name}
            {row.due_date ? `, due ${formatDate(row.due_date)}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{hoursText(row.hours)}</span>
      </div>
      {canReassign &&
        (open ? (
          <ReassignPicker orgSlug={orgSlug} row={row} from={from} onDone={() => setOpen(false)} />
        ) : (
          <Button variant="outline" className="h-11 sm:h-8" onClick={() => setOpen(true)} aria-label={`Reassign ${row.title}`}>
            <UserRoundCog className="h-4 w-4" aria-hidden />
            Reassign
          </Button>
        ))}
    </li>
  );
}

/** The tasks behind one workload cell, largest share first, each one reassignable. */
export function CellSheet({ orgSlug, cell, includeDone, onClose }: { orgSlug: string; cell: CellRef | null; includeDone: boolean; onClose: () => void }) {
  const { can } = useServicePermissions();
  const canReassign = can([PERMS.tasksChange, PERMS.tasksChangeOwn]);
  const { data, isLoading, isError } = useWorkloadTasks(orgSlug, cell, includeDone);
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.hours, 0);
  return (
    <Sheet
      open={!!cell}
      onOpenChange={(o) => !o && onClose()}
      title={cell ? `${cell.who || 'Unnamed'}, ${weekLabel(cell.week)}` : 'Tasks'}
      description={cell ? `${hoursText(total)} across ${rows.length} ${rows.length === 1 ? 'task' : 'tasks'}` : undefined}
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">The tasks could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No estimated work this week.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <TaskRow key={r.task_id} orgSlug={orgSlug} row={r} from={cell?.userId ?? ''} canReassign={canReassign} />
          ))}
        </ul>
      )}
      {rows.length >= 100 && <p className="mt-3 text-xs text-muted-foreground">Showing the 100 largest tasks.</p>}
    </Sheet>
  );
}
