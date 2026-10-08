'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, List, LayoutGrid } from 'lucide-react';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import type { Task } from '@/types';
import type { CreateTaskInput } from '@/lib/api/tasks';

const KANBAN_COLS = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
] as const;

type KanbanStatus = (typeof KANBAN_COLS)[number]['status'];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">New Task</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Task title"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={form.priority ?? 'medium'}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || undefined }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || undefined }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimate (hours)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.estimated_hours ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estimated_hours: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
              {isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  href,
  onStatusChange,
}: {
  task: Task;
  href: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-white p-3 shadow-sm space-y-2">
      <Link href={href} className="block text-sm font-medium hover:underline">
        {task.title}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <Badge status={task.priority} />
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
      <select
        value={task.status}
        onChange={(e) => onStatusChange(task.id, e.target.value)}
        className="w-full text-xs border border-border rounded px-1.5 py-1 focus:outline-none"
      >
        {KANBAN_COLS.map((col) => (
          <option key={col.status} value={col.status}>{col.label}</option>
        ))}
      </select>
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
  const taskHref = (id: string) => `/${orgSlug}/projects/${projectId}/tasks/${id}`;

  function handleCreate(input: CreateTaskInput) {
    createTask.mutate(input, { onSuccess: () => setShowCreate(false) });
  }

  function handleStatusChange(id: string, status: string) {
    updateTask.mutate({ id, data: { status } });
  }

  function handleProgressChange(id: string, progress: number) {
    updateTask.mutate({ id, data: { progress_pct: progress } });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load tasks." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button
              onClick={() => setView('list')}
              className={`p-1.5 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'} rounded-l-md transition-colors`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-1.5 ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'} rounded-r-md transition-colors`}
              title="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add your first task to this project."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          }
        />
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KANBAN_COLS.map(({ status, label }) => {
            const colTasks = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px] rounded-md bg-muted/30 p-2">
                  {colTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      href={taskHref(task.id)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Priority</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Due Date</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Estimate</th>
                  <th className="py-3 text-left font-medium text-muted-foreground pl-4">Progress</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="py-3 font-medium">
                      <Link href={taskHref(task.id)} className="hover:underline">
                        {task.title}
                      </Link>
                    </td>
                    <td className="py-3"><Badge status={task.status} /></td>
                    <td className="py-3"><Badge status={task.priority} /></td>
                    <td className="py-3 text-muted-foreground">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right text-muted-foreground">
                      {task.estimated_hours != null ? `${task.estimated_hours} h` : "—"}
                    </td>
                    <td className="py-3 pl-4">
                      {task.status === "done" ? (
                        <span className="text-xs text-green-700">100%</span>
                      ) : (
                        <select
                          value={task.progress_pct ?? 0}
                          onChange={(e) => handleProgressChange(task.id, Number(e.target.value))}
                          className="text-xs border border-border rounded px-1.5 py-1 focus:outline-none"
                          aria-label="Progress"
                        >
                          {[0, 10, 25, 50, 75, 90].map((p) => (
                            <option key={p} value={p}>{p}%</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createTask.isPending}
        />
      )}
    </div>
  );
}
