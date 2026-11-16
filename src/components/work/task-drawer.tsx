'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate, formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { AssigneeAvatars, AssigneePicker } from '@/components/work/assignees';
import { PRIORITY_OPTIONS, StatusPill, statusLabel } from '@/components/work/status-pill';
import { TaskChecklist } from '@/components/work/task-checklist';
import { TaskComments } from '@/components/work/task-comments';
import { TaskAttachments } from '@/components/work/task-attachments';
import {
  useChangeStatus,
  useCreateTask,
  useDeleteTask,
  useProjectStatuses,
  useReschedule,
  useSubtasks,
  useTask,
  useUpdateTask,
} from '@/hooks/useTasks';
import { useTaskActivities } from '@/hooks/useActivities';
import { useProjectPeople } from '@/hooks/usePeople';
import { useTaskAccess } from '@/hooks/useTaskAccess';
import { useTaskTitles } from '@/hooks/useTaskTitles';
import { useProjectStream } from '@/hooks/useProjectStream';
import { isNotFound } from '@/lib/api/errors';
import { conflictMessage } from '@/lib/work/gantt';
import type { TaskDetail } from '@/types';

const fieldClass =
  'h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 sm:h-9 sm:text-sm';

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Collapsible({ title, children, onOpen }: { title: string; children: ReactNode; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) onOpen?.();
        }}
        className="flex min-h-11 w-full items-center justify-between text-sm font-semibold"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="pt-2">{children}</div>}
    </section>
  );
}

const ymd = (v?: string) => (v ? v.slice(0, 10) : '');

/**
 * The task drawer (US-12.1): every field of a task, its checklist, subtasks, comments, files and
 * history, opened from any view by ?task=<id>. Live updates keep it current while open.
 */
export function TaskDrawer({
  orgSlug,
  projectId,
  taskId,
  onClose,
  onOpenTask,
  live = true,
}: {
  orgSlug: string;
  projectId: string;
  taskId: string;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  /** False when the page already holds the project's stream. */
  live?: boolean;
}) {
  const access = useTaskAccess();
  const { data: task, isLoading, error } = useTask(orgSlug, projectId, taskId);
  useProjectStream(orgSlug, projectId, live && !!taskId && access.canViewAll && access.tracking);

  return (
    <Sheet
      open={!!taskId}
      onOpenChange={(o) => !o && onClose()}
      title={task ? <span className="break-words">{task.title}</span> : isLoading ? 'Loading task' : 'Task'}
      description={task?.wbs_code ? `WBS ${task.wbs_code}` : undefined}
    >
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : isNotFound(error) || !task ? (
        <p className="text-sm text-muted-foreground">This task was deleted or is not shared with you.</p>
      ) : (
        <TaskBody orgSlug={orgSlug} projectId={projectId} task={task} onClose={onClose} onOpenTask={onOpenTask} />
      )}
    </Sheet>
  );
}

function TaskBody({
  orgSlug,
  projectId,
  task,
  onClose,
  onOpenTask,
}: {
  orgSlug: string;
  projectId: string;
  task: TaskDetail;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const access = useTaskAccess();
  const editable = access.canEdit(task);
  const { people, nameOf } = useProjectPeople(orgSlug, projectId);
  const statuses = useProjectStatuses(orgSlug, projectId).data;
  const titleOf = useTaskTitles(orgSlug, projectId);
  const update = useUpdateTask(orgSlug, projectId);
  const changeStatus = useChangeStatus(orgSlug, projectId);
  const del = useDeleteTask(orgSlug, projectId);
  const [conflict, setConflict] = useState<string | null>(null);
  const reschedule = useReschedule(orgSlug, projectId, (blocking) => setConflict(conflictMessage(blocking, titleOf)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [editingDescription, setEditingDescription] = useState(false);
  const serverEstimate = task.estimated_hours != null ? String(task.estimated_hours) : '';
  const [estimate, setEstimate] = useState(serverEstimate);
  // A live update replaces the server copy: the local inputs follow it while rendering (React's
  // "adjust state when a prop changes" pattern), and the description only while it is not being
  // edited, catching up when editing ends.
  const [seen, setSeen] = useState({ title: task.title, description: task.description ?? '', estimate: serverEstimate, editing: editingDescription });
  if (seen.title !== task.title || seen.estimate !== serverEstimate || seen.description !== (task.description ?? '') || seen.editing !== editingDescription) {
    if (seen.title !== task.title) setTitle(task.title);
    if (seen.estimate !== serverEstimate) setEstimate(serverEstimate);
    if (!editingDescription && (seen.description !== (task.description ?? '') || seen.editing !== editingDescription)) {
      setDescription(task.description ?? '');
    }
    setSeen({ title: task.title, description: task.description ?? '', estimate: serverEstimate, editing: editingDescription });
  }

  const statusOptions: ComboboxOption[] = (statuses ?? []).map((s) => ({ value: s.key, label: s.label }));
  const assigneeIds = (task.edges?.assignees ?? []).map((a) => a.user_id);
  const save = (data: Parameters<typeof update.mutate>[0]['data']) => update.mutate({ id: task.id, data });
  const setDate = (field: 'start_date' | 'due_date', value: string) => {
    setConflict(null);
    reschedule.mutate({ id: task.id, dates: { [field]: value } });
  };

  return (
    <div className="space-y-5">
      {editable && (
        <Field label="Title" htmlFor="drawer-title">
          <input
            id="drawer-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && save({ title: title.trim() })}
            className={fieldClass}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Status">
          {editable && statusOptions.length > 0 ? (
            <SearchableCombobox
              options={statusOptions}
              value={task.status}
              valueLabel={statusLabel(statuses, task.status)}
              onChange={(v) => v && v !== task.status && changeStatus.mutate({ task, to: v })}
              clearable={false}
              searchPlaceholder="Move to"
            />
          ) : (
            <StatusPill status={task.status} statuses={statuses} />
          )}
        </Field>
        <Field label="Priority">
          {editable ? (
            <SearchableCombobox
              options={PRIORITY_OPTIONS}
              value={task.priority}
              onChange={(v) => v && v !== task.priority && save({ priority: v })}
              clearable={false}
              searchPlaceholder="Priority"
            />
          ) : (
            <Badge status={task.priority} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Assignees">
            {editable ? (
              <AssigneePicker people={people} value={assigneeIds} onChange={(ids) => save({ assignee_ids: ids })} disabled={update.isPending} />
            ) : (
              <AssigneeAvatars assignees={task.edges?.assignees} nameOf={nameOf} max={6} />
            )}
          </Field>
        </div>
        <Field label="Start date" htmlFor="drawer-start">
          <input
            id="drawer-start"
            type="date"
            disabled={!editable || reschedule.isPending}
            value={ymd(task.start_date)}
            onChange={(e) => setDate('start_date', e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Due date" htmlFor="drawer-due">
          <input
            id="drawer-due"
            type="date"
            disabled={!editable || reschedule.isPending}
            value={ymd(task.due_date)}
            onChange={(e) => setDate('due_date', e.target.value)}
            className={fieldClass}
          />
        </Field>
        {conflict && (
          <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm sm:col-span-2">
            {conflict}
          </p>
        )}
        <Field label="Estimate (hours)" htmlFor="drawer-estimate">
          <input
            id="drawer-estimate"
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            disabled={!editable}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => {
              const n = estimate === '' ? undefined : Number(estimate);
              if (n !== task.estimated_hours && (n === undefined || Number.isFinite(n))) save({ estimated_hours: n ?? 0 });
            }}
            className={fieldClass}
          />
        </Field>
        <Field label="Progress" htmlFor="drawer-progress">
          <div className="flex h-11 items-center gap-3 sm:h-9">
            <input
              id="drawer-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={!editable || task.status === 'done'}
              defaultValue={task.progress_pct ?? 0}
              key={`${task.id}-${task.progress_pct}`}
              onPointerUp={(e) => save({ progress_pct: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => save({ progress_pct: Number((e.target as HTMLInputElement).value) })}
              className="min-w-0 flex-1 accent-primary"
            />
            <span className="w-10 text-right text-sm tabular-nums">{task.progress_pct ?? 0}%</span>
          </div>
        </Field>
      </div>

      <section aria-labelledby="description-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 id="description-heading" className="text-sm font-semibold">
            Description
          </h3>
          {editable && !editingDescription && (
            <Button variant="ghost" size="sm" onClick={() => setEditingDescription(true)}>
              Edit
            </Button>
          )}
        </div>
        {editingDescription ? (
          <div className="space-y-2">
            <RichTextField value={description} onChange={setDescription} ariaLabel="Description" />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDescription(task.description ?? '');
                  setEditingDescription(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: task.id, data: { description } }, { onSuccess: () => setEditingDescription(false) })}
              >
                Save
              </Button>
            </div>
          </div>
        ) : task.description ? (
          <RichTextView value={task.description} />
        ) : (
          <p className="text-sm text-muted-foreground">No description.</p>
        )}
      </section>

      <TaskChecklist orgSlug={orgSlug} projectId={projectId} task={task} editable={editable} />

      <Subtasks orgSlug={orgSlug} projectId={projectId} parent={task} onOpenTask={onOpenTask} />

      {access.canViewComments && <TaskComments orgSlug={orgSlug} projectId={projectId} task={task} access={access} nameOf={nameOf} />}
      {access.canViewComments && <TaskAttachments orgSlug={orgSlug} projectId={projectId} taskId={task.id} access={access} nameOf={nameOf} />}
      {!access.collaboration && (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">Comments and files come with team collaboration on a higher plan.</p>
      )}

      {access.canViewActivity && <Activity orgSlug={orgSlug} projectId={projectId} taskId={task.id} nameOf={nameOf} />}

      <p className="text-xs text-muted-foreground">
        Created {formatDate(task.created_at)}, updated {formatDateTime(task.updated_at)}
      </p>

      {access.canDelete && (
        <div className="border-t border-border pt-4">
          <Button variant="outline" className="h-11 text-destructive sm:h-9" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete task
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description="Its checklist, comments and files go with it. This cannot be undone."
        confirmLabel="Delete task"
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(task.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </div>
  );
}

function Subtasks({ orgSlug, projectId, parent, onOpenTask }: { orgSlug: string; projectId: string; parent: TaskDetail; onOpenTask: (id: string) => void }) {
  const access = useTaskAccess();
  const [open, setOpen] = useState(false);
  const subtasks = useSubtasks(orgSlug, projectId, parent.id, open);
  const subtaskRows = subtasks.tasks;
  const create = useCreateTask(orgSlug, projectId);
  const statuses = useProjectStatuses(orgSlug, projectId).data;
  const [draft, setDraft] = useState('');
  return (
    <Collapsible title="Subtasks" onOpen={() => setOpen(true)}>
      {subtasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading subtasks</p>
      ) : subtaskRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subtasks.</p>
      ) : (
        <ul className="space-y-1">
          {subtaskRows.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onOpenTask(s.id)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent">
                <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                <StatusPill status={s.status} statuses={statuses} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {subtasks.hasNextPage && (
        <Button variant="outline" className="mt-2 h-11 w-full sm:h-9" disabled={subtasks.isFetchingNextPage} onClick={() => void subtasks.fetchNextPage()}>
          {subtasks.isFetchingNextPage ? 'Loading more subtasks' : `Show more subtasks (${subtasks.total - subtaskRows.length})`}
        </Button>
      )}
      {access.canAdd && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            create.mutate({ title: draft.trim(), parent_id: parent.id, priority: 'medium' }, { onSuccess: () => setDraft('') });
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a subtask"
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm"
            aria-label="New subtask"
          />
          <Button type="submit" variant="outline" className="h-11 sm:h-9" disabled={!draft.trim() || create.isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </form>
      )}
    </Collapsible>
  );
}

const ACTIVITY_TEXT: Record<string, string> = {
  'task.created': 'created the task',
  'task.updated': 'updated the task',
  'task.status_changed': 'changed the status',
  'task.moved': 'moved the task',
  'task.deleted': 'deleted the task',
  'comment.created': 'commented',
  'comment.updated': 'edited a comment',
  'comment.deleted': 'deleted a comment',
  'attachment.added': 'attached a file',
};

function Activity({
  orgSlug,
  projectId,
  taskId,
  nameOf,
}: {
  orgSlug: string;
  projectId: string;
  taskId: string;
  nameOf: (id: string, known?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useTaskActivities(orgSlug, projectId, taskId, open);
  return (
    <Collapsible title="Activity" onOpen={() => setOpen(true)}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading activity</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-2">
          {(data ?? []).slice(0, 50).map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-medium">{nameOf(a.user_id, a.actor_name)}</span>{' '}
              <span className="text-muted-foreground">{ACTIVITY_TEXT[a.activity_type] ?? a.activity_type.replace(/[._]/g, ' ')}</span>
              <span className="block text-xs text-muted-foreground">{formatDateTime(a.occurred_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Collapsible>
  );
}
