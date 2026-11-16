'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, List, LayoutGrid } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { RichTextField } from '@/components/common/rich-text';
import type { Task } from '@/types';
import type { CreateTaskInput } from '@/lib/api/tasks';

const KANBAN_COLS = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
] as const;

const STATUS_OPTIONS: ComboboxOption[] = KANBAN_COLS.map((c) => ({ value: c.status, label: c.label }));
const PRIORITY_OPTIONS: ComboboxOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const PROGRESS_OPTIONS: ComboboxOption[] = [0, 10, 25, 50, 75, 90].map((p) => ({ value: String(p), label: `${p}%` }));

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring';

function CreateTaskModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateTaskInput>({ title: '', priority: 'medium', status: 'todo' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card p-4 shadow-lg sm:mx-4 sm:rounded-xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">New task</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="task-title" className="mb-1 block text-sm font-medium">Title *</label>
            <input
              id="task-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
              placeholder="Task title"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Description</span>
            <RichTextField
              value={form.description ?? ''}
              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              ariaLabel="Description"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-medium">Priority</span>
              <SearchableCombobox
                options={PRIORITY_OPTIONS}
                value={form.priority ?? 'medium'}
                onChange={(v) => setForm((f) => ({ ...f, priority: v || 'medium' }))}
                clearable={false}
                searchPlaceholder="Find a priority"
              />
            </div>
            <div>
              <label htmlFor="task-due" className="mb-1 block text-sm font-medium">Due date</label>
              <input
                id="task-due"
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || undefined }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="task-start" className="mb-1 block text-sm font-medium">Start date</label>
              <input
                id="task-start"
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || undefined }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="task-estimate" className="mb-1 block text-sm font-medium">Estimate (hours)</label>
              <input
                id="task-estimate"
                type="number"
                min={0}
                step={0.5}
                value={form.estimated_hours ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estimated_hours: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
                className={inputClass}
                placeholder="e.g. 8"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Start date and estimate let the project track planned against earned progress.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.title.trim()}>
              {isPending ? 'Creating...' : 'Create task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: string) => void }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3 shadow-sm">
      <p className="break-words text-sm font-medium">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge status={task.priority} />
        {task.due_date && <span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span>}
      </div>
      <SearchableCombobox
        options={STATUS_OPTIONS}
        value={task.status}
        onChange={(v) => v && v !== task.status && onStatusChange(task.id, v)}
        clearable={false}
        searchPlaceholder="Move to"
        className="text-xs"
      />
    </div>
  );
}

export default function TasksPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useTasks(orgSlug, projectId);
  const createTask = useCreateTask(orgSlug, projectId);
  const updateTask = useUpdateTask(orgSlug, projectId);

  const tasks = data?.data ?? [];

  function handleCreate(input: CreateTaskInput) {
    createTask.mutate(input, { onSuccess: () => setShowCreate(false) });
  }

  const columns = useMemo<DataTableColumn<Task>[]>(() => {
    const changeProgress = (id: string, progress: number) => updateTask.mutate({ id, data: { progress_pct: progress } });
    return [
      { key: 'title', header: 'Title', primary: true, sortable: true, render: (t) => <span className="font-medium">{t.title}</span> },
      { key: 'status', header: 'Status', sortable: true, filterable: true, mobileAction: true, render: (t) => <Badge status={t.status} /> },
      { key: 'priority', header: 'Priority', sortable: true, filterable: true, render: (t) => <Badge status={t.priority} /> },
      {
        key: 'due_date',
        header: 'Due date',
        sortable: true,
        accessor: (t) => t.due_date,
        render: (t) => <span className="text-muted-foreground">{formatDate(t.due_date, null, { fallback: '—' })}</span>,
      },
      {
        key: 'estimated_hours',
        header: 'Estimate',
        align: 'right',
        sortable: true,
        hideBelow: 'lg',
        render: (t) => <span className="text-muted-foreground">{t.estimated_hours != null ? `${t.estimated_hours} h` : '—'}</span>,
      },
      {
        key: 'progress_pct',
        header: 'Progress',
        exportable: true,
        accessor: (t) => (t.status === 'done' ? 100 : t.progress_pct ?? 0),
        render: (t) =>
          t.status === 'done' ? (
            <span className="text-xs text-success">100%</span>
          ) : (
            <SearchableCombobox
              options={PROGRESS_OPTIONS}
              value={String(t.progress_pct ?? 0)}
              onChange={(v) => v !== '' && changeProgress(t.id, Number(v))}
              clearable={false}
              searchPlaceholder="Progress"
              className="w-28 text-xs"
            />
          ),
      },
    ];
  }, [updateTask]);

  function handleStatusChange(id: string, status: string) {
    updateTask.mutate({ id, data: { status } });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load tasks." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={
          <>
            <div className="flex flex-none rounded-md border border-border" role="group" aria-label="View">
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={`rounded-l-md p-2 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('kanban')}
                aria-pressed={view === 'kanban'}
                className={`rounded-r-md p-2 transition-colors ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          </>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add your first task to this project."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          }
        />
      ) : view === 'kanban' ? (
        // Phones scroll the columns sideways (each a fixed width); from lg they share the row.
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {KANBAN_COLS.map(({ status, label }) => {
            const colTasks = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="w-[78vw] max-w-72 shrink-0 snap-start space-y-2 sm:w-64 lg:w-auto lg:max-w-none">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="min-h-[100px] space-y-2 rounded-md bg-muted/30 p-2">
                  {colTasks.map((task) => (
                    <KanbanCard key={task.id} task={task} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={tasks}
          rowKey={(t) => t.id}
          gridLines="rows"
          storageKey="projects-tasks-columns"
          showExportCsv
          exportFileName="tasks"
        />
      )}

      {showCreate && (
        <CreateTaskModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} isPending={createTask.isPending} />
      )}
    </div>
  );
}
