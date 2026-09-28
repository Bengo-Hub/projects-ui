'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Trash2, X } from 'lucide-react';
import { useTask, useTasks, useUpdateTask, useDeleteTask, useAddDependency, useRemoveDependency } from '@/hooks/useTasks';
import { useTaskComments, useCreateTaskComment } from '@/hooks/useComments';
import { useTaskAttachments, useCreateAttachment, useDeleteAttachment } from '@/hooks/useAttachments';
import { useTaskActivities } from '@/hooks/useActivities';
import { useMe } from '@/hooks/useMe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { CommentThread } from '@/components/collab/comment-thread';
import { AttachmentList } from '@/components/collab/attachment-list';
import { ActivityFeed } from '@/components/collab/activity-feed';
import type { Task } from '@/types';
import type { CreateTaskInput } from '@/lib/api/tasks';

const inputCls =
  'w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PROGRESS = [0, 10, 25, 50, 75, 90, 100];

/** Dates arrive as RFC 3339; date inputs want yyyy-mm-dd. */
const day = (v?: string) => (v ? v.slice(0, 10) : '');

type Form = {
  title: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  estimated_hours: string;
  progress_pct: number;
};

function toForm(t: Task): Form {
  return {
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: t.priority,
    start_date: day(t.start_date),
    due_date: day(t.due_date),
    estimated_hours: t.estimated_hours != null ? String(t.estimated_hours) : '',
    progress_pct: t.progress_pct ?? 0,
  };
}

/** changed returns only the fields that differ from the task, so an update never blanks the rest. */
function changed(t: Task, f: Form): Partial<CreateTaskInput> {
  const out: Partial<CreateTaskInput> = {};
  const o = toForm(t);
  if (f.title.trim() !== o.title) out.title = f.title.trim();
  if (f.description !== o.description) out.description = f.description;
  if (f.status !== o.status) out.status = f.status;
  if (f.priority !== o.priority) out.priority = f.priority;
  if (f.start_date !== o.start_date && f.start_date) out.start_date = f.start_date;
  if (f.due_date !== o.due_date && f.due_date) out.due_date = f.due_date;
  if (f.estimated_hours !== o.estimated_hours && f.estimated_hours !== '') out.estimated_hours = Number(f.estimated_hours);
  if (f.progress_pct !== o.progress_pct) out.progress_pct = f.progress_pct;
  return out;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const taskId = (params?.taskId as string) ?? '';

  const { user } = useMe();
  const { data: task, isLoading, isError } = useTask(orgSlug, projectId, taskId);
  const { data: allTasks } = useTasks(orgSlug, projectId, { limit: 100 });
  const comments = useTaskComments(orgSlug, projectId, taskId);
  const attachments = useTaskAttachments(orgSlug, projectId, taskId);
  const activities = useTaskActivities(orgSlug, projectId, taskId);

  const updateTask = useUpdateTask(orgSlug, projectId);
  const deleteTask = useDeleteTask(orgSlug, projectId);
  const addComment = useCreateTaskComment(orgSlug, projectId, taskId);
  const addAttachment = useCreateAttachment(orgSlug, projectId, taskId);
  const removeAttachment = useDeleteAttachment(orgSlug, projectId);
  const addDep = useAddDependency(orgSlug, projectId, taskId);
  const removeDep = useRemoveDependency(orgSlug, projectId, taskId);

  const [form, setForm] = useState<Form | null>(null);
  const [depId, setDepId] = useState('');

  useEffect(() => {
    if (task) setForm(toForm(task));
  }, [task]);

  if (isLoading || (task && !form)) return <PageLoading />;
  if (isError || !task || !form) return <ErrorBanner message="Failed to load task." />;

  const back = (
    <Link
      href={`/${orgSlug}/projects/${projectId}/tasks`}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Tasks
    </Link>
  );

  const diff = changed(task, form);
  const dirty = Object.keys(diff).length > 0;
  const titles = new Map((allTasks?.data ?? []).map((t) => [t.id, t.title]));
  const deps = task.edges?.dependencies ?? [];
  const depIds = new Set(deps.map((d) => d.depends_on_task_id));
  const candidates = (allTasks?.data ?? []).filter((t) => t.id !== task.id && !depIds.has(t.id));
  const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

  function save() {
    if (!dirty) return;
    updateTask.mutate({ id: task!.id, data: diff });
  }

  function remove() {
    if (!confirm(`Delete task "${task!.title}"?`)) return;
    deleteTask.mutate(task!.id, { onSuccess: () => router.push(`/${orgSlug}/projects/${projectId}/tasks`) });
  }

  return (
    <div className="space-y-5">
      {back}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{task.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge status={task.status} />
            <Badge status={task.priority} />
            {task.wbs_code && <span className="text-xs text-muted-foreground">WBS {task.wbs_code}</span>}
            {overdue && <span className="text-xs font-medium text-red-600">Overdue</span>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={remove} disabled={deleteTask.isPending}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Progress</label>
                  <select
                    value={form.status === 'done' ? 100 : form.progress_pct}
                    disabled={form.status === 'done'}
                    onChange={(e) => setForm({ ...form, progress_pct: Number(e.target.value) })}
                    className={inputCls}
                  >
                    {PROGRESS.map((p) => (
                      <option key={p} value={p}>{p}%</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estimate (h)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.estimated_hours}
                    onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Due date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setForm(toForm(task))} disabled={!dirty}>
                  Reset
                </Button>
                <Button size="sm" onClick={save} disabled={!dirty || !form.title.trim() || updateTask.isPending}>
                  {updateTask.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={comments.data?.data ?? []}
                isLoading={comments.isLoading}
                meId={user?.id}
                orgSlug={orgSlug}
                projectId={projectId}
                isAdding={addComment.isPending}
                onAdd={(content, done) => addComment.mutate({ content }, { onSuccess: done })}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList
                items={attachments.data?.data ?? []}
                isLoading={attachments.isLoading}
                isAdding={addAttachment.isPending}
                onAdd={(input, done) => addAttachment.mutate(input, { onSuccess: done })}
                onRemove={(id) => removeAttachment.mutate(id)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Depends on</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dependencies.</p>
              ) : (
                <ul className="space-y-1">
                  {deps.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <Link
                        href={`/${orgSlug}/projects/${projectId}/tasks/${d.depends_on_task_id}`}
                        className="flex-1 truncate hover:underline"
                      >
                        {titles.get(d.depends_on_task_id) ?? d.depends_on_task_id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-muted-foreground">{d.dependency_type}</span>
                      <button
                        onClick={() => removeDep.mutate(d.depends_on_task_id)}
                        className="rounded p-0.5 text-muted-foreground hover:text-red-600"
                        title="Remove dependency"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {candidates.length > 0 && (
                <div className="flex gap-2">
                  <select value={depId} onChange={(e) => setDepId(e.target.value)} className={inputCls}>
                    <option value="">Add a task this one waits on</option>
                    {candidates.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!depId || addDep.isPending}
                    onClick={() =>
                      addDep.mutate({ depends_on_task_id: depId, dependency_type: 'FS' }, { onSuccess: () => setDepId('') })
                    }
                  >
                    Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                items={activities.data?.data ?? []}
                isLoading={activities.isLoading}
                meId={user?.id}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
