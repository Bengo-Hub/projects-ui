'use client';

import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useCreateTaskComment, useDeleteComment, useOlderTaskComments, useUpdateComment } from '@/hooks/useComments';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useProjectPeople } from '@/hooks/usePeople';
import type { TaskAccess } from '@/hooks/useTaskAccess';
import type { Comment, TaskDetail } from '@/types';

/**
 * A task's comments, oldest first: the latest 50 come with the task, "Show older" pages back.
 * Posting works offline (queued). Mentions arrive as Tiptap mention spans; the shared editor has
 * no mention picker yet, so they are shown here but cannot be typed.
 */
export function TaskComments({
  orgSlug,
  projectId,
  task,
  access,
  nameOf,
}: {
  orgSlug: string;
  projectId: string;
  task: TaskDetail;
  access: TaskAccess;
  nameOf: (userId: string, known?: string) => string;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const older = useOlderTaskComments(orgSlug, projectId, task.id, task.comments_total, showOlder);
  const create = useCreateTaskComment(orgSlug, projectId, task.id);
  const update = useUpdateComment(orgSlug, projectId);
  const remove = useDeleteComment(orgSlug, projectId);
  const queue = useOfflineQueue();
  const { people } = useProjectPeople(orgSlug, projectId);
  // Project members can be mentioned; the author is left out (the API never notifies them).
  const mentionOptions = useMemo(
    () => people.filter((p) => !p.isMe).map((p) => ({ id: p.userId, label: p.name, description: p.email })),
    [people],
  );
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Comment | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleting, setDeleting] = useState<Comment | null>(null);

  const comments = useMemo(() => {
    const byId = new Map<string, Comment>();
    for (const p of older.data?.pages ?? []) for (const c of p.data ?? []) byId.set(c.id, c);
    for (const c of task.comments ?? []) byId.set(c.id, c);
    return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [older.data, task.comments]);
  const waiting = queue.filter((q) => q.kind === 'comment' && q.taskId === task.id);
  const hiddenOlder = Math.max(0, task.comments_total - comments.length);
  const canLoadOlder = hiddenOlder > 0 && (!showOlder || older.hasNextPage);

  return (
    <section aria-labelledby="comments-heading" className="space-y-3">
      <h3 id="comments-heading" className="text-sm font-semibold">
        Comments {task.comments_total > 0 && <span className="font-normal text-muted-foreground">({task.comments_total})</span>}
      </h3>
      {canLoadOlder && (
        <Button
          variant="outline"
          className="h-11 w-full sm:h-9"
          disabled={older.isFetching}
          onClick={() => (showOlder ? void older.fetchNextPage() : setShowOlder(true))}
        >
          {older.isFetching ? 'Loading older comments' : `Show older comments (${hiddenOlder})`}
        </Button>
      )}
      {comments.length === 0 && waiting.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ol className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium">{nameOf(c.user_id, c.author_name)}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
              <span className="ml-auto flex gap-1">
                {access.canEditComment(c) && (
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                    aria-label="Edit comment"
                    onClick={() => {
                      setEditing(c);
                      setEditDraft(c.content);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                )}
                {access.canDeleteComment(c) && (
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete comment"
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </span>
            </div>
            {editing?.id === c.id ? (
              <div className="space-y-2">
                <RichTextField value={editDraft} onChange={setEditDraft} ariaLabel="Edit comment" mentions={mentionOptions} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!editDraft || update.isPending}
                    onClick={() => update.mutate({ id: c.id, data: { content: editDraft } }, { onSuccess: () => setEditing(null) })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <RichTextView value={c.content} />
            )}
          </li>
        ))}
        {waiting.map((q) => (
          <li key={q.key} className="rounded-md border border-dashed border-border p-3 opacity-80">
            <p className="mb-1 text-xs text-muted-foreground">Waiting to post when you reconnect</p>
            <RichTextView value={q.kind === 'comment' ? q.content : ''} />
          </li>
        ))}
      </ol>
      {access.canComment && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft) return;
            create.mutate({ content: draft }, { onSuccess: () => setDraft('') });
          }}
        >
          <RichTextField value={draft} onChange={setDraft} placeholder="Write a comment, @ to mention someone" ariaLabel="New comment" className="min-h-20" mentions={mentionOptions} />
          <div className="flex justify-end">
            <Button type="submit" className="h-11 sm:h-9" disabled={!draft || create.isPending}>
              {create.isPending ? 'Posting...' : 'Post comment'}
            </Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this comment?"
        description="It is removed for everyone on the project."
        confirmLabel="Delete"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </section>
  );
}
