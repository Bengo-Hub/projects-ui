'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity as ActivityIcon,
  CheckSquare,
  Flag,
  MessageSquare,
  Paperclip,
  Trash2,
  UserPlus,
  Link2,
  Pencil,
} from 'lucide-react';
import type { Activity } from '@/types';
import { Loading } from '@/components/ui/loading';

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const label = (v: unknown) => str(v).replace(/_/g, ' ');

type Change = { from?: unknown; to?: unknown };

/** The task fields worth naming in a feed line, in display order. */
const FIELD_LABELS: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  progress_pct: 'progress',
  assignee_id: 'assignee',
  due_date: 'due date',
  start_date: 'start date',
  estimated_hours: 'estimate',
  title: 'title',
  description: 'description',
};

function describeChanges(changes: Record<string, Change> | undefined): string {
  if (!changes) return '';
  const parts: string[] = [];
  for (const [field, name] of Object.entries(FIELD_LABELS)) {
    const c = changes[field];
    if (!c) continue;
    if (field === 'status' || field === 'priority') parts.push(`${name} ${label(c.from) || 'none'} → ${label(c.to)}`);
    else if (field === 'progress_pct') parts.push(`${name} ${str(c.from) || 0}% → ${str(c.to)}%`);
    else parts.push(`${name} changed`);
  }
  return parts.join(', ');
}

/** describe turns an activity row into an icon and a sentence. Unknown types fall back to the type name. */
export function describe(a: Activity): { icon: React.ElementType; text: string } {
  const p = a.payload ?? {};
  const title = str(p.title) || str(p.name);
  const q = title ? `"${title}"` : '';
  switch (a.activity_type) {
    case 'task.created':
      return { icon: CheckSquare, text: `created task ${q}` };
    case 'task.updated': {
      const d = describeChanges(p.changes as Record<string, Change> | undefined);
      return { icon: Pencil, text: `updated task ${q}${d ? `: ${d}` : ''}` };
    }
    case 'task.deleted':
      return { icon: Trash2, text: `deleted task ${q}` };
    case 'comment.added':
      return { icon: MessageSquare, text: a.task_id ? `commented on task ${q}` : 'commented on the project' };
    case 'attachment.added':
      return { icon: Paperclip, text: `attached ${str(p.file_name)}` };
    case 'attachment.removed':
      return { icon: Paperclip, text: `removed attachment ${str(p.file_name)}` };
    case 'milestone.created':
      return { icon: Flag, text: `added milestone ${q}` };
    case 'milestone.updated':
      return { icon: Flag, text: `updated milestone ${q}${p.status ? ` (${label(p.status)})` : ''}` };
    case 'milestone.deleted':
      return { icon: Flag, text: `removed milestone ${q}` };
    case 'member.added':
      return { icon: UserPlus, text: `added a member as ${label(p.role_code)}` };
    case 'member.role_changed':
      return { icon: UserPlus, text: `changed a member's role to ${label(p.role_code)}` };
    case 'member.removed':
      return { icon: UserPlus, text: 'removed a member' };
    case 'dependency.added':
      return { icon: Link2, text: `linked a dependency on ${q}` };
    case 'dependency.removed':
      return { icon: Link2, text: `removed a dependency from ${q}` };
    case 'project.updated':
      return { icon: Pencil, text: `updated the project${p.status ? ` (status ${label(p.status)})` : ''}` };
    default:
      return { icon: ActivityIcon, text: label(a.activity_type.replace('.', ' ')) };
  }
}

/** who shows "You" for the signed-in user and a short id otherwise (the API returns ids only). */
export function who(userId: string, meId?: string) {
  if (meId && userId === meId) return 'You';
  return `User ${userId.slice(0, 8)}`;
}

export function ActivityFeed({
  items,
  isLoading,
  meId,
  orgSlug,
  projectId,
  emptyText = 'No activity yet.',
}: {
  items: Activity[];
  isLoading?: boolean;
  meId?: string;
  /** With orgSlug and projectId set, task activity links to the task. */
  orgSlug?: string;
  projectId?: string;
  emptyText?: string;
}) {
  if (isLoading) return <Loading size="sm" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const { icon: Icon, text } = describe(a);
        const linkTask = orgSlug && projectId && a.task_id && a.activity_type !== 'task.deleted';
        return (
          <li key={a.id} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p>
                <span className="font-medium">{who(a.user_id, meId)}</span>{' '}
                {linkTask ? (
                  <Link href={`/${orgSlug}/projects/${projectId}/tasks/${a.task_id}`} className="hover:underline">
                    {text}
                  </Link>
                ) : (
                  text
                )}
              </p>
              <p className="text-xs text-muted-foreground" title={new Date(a.occurred_at).toLocaleString()}>
                {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
