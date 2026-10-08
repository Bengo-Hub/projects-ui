'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import type { Comment } from '@/types';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { useDeleteComment, useUpdateComment } from '@/hooks/useComments';
import { who } from './activity-feed';

const inputCls =
  'w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

function CommentItem({
  comment,
  meId,
  orgSlug,
  projectId,
}: {
  comment: Comment;
  meId?: string;
  orgSlug: string;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const update = useUpdateComment(orgSlug, projectId);
  const remove = useDeleteComment(orgSlug, projectId);
  const mine = !!meId && comment.user_id === meId;
  const edited = comment.updated_at && comment.updated_at !== comment.created_at;

  function save() {
    if (!draft.trim()) return;
    update.mutate({ id: comment.id, data: { content: draft.trim() } }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{who(comment.user_id, meId)}</span>{' '}
          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          {edited ? ' (edited)' : ''}
        </p>
        {mine && !editing && (
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              title="Edit comment"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this comment?')) remove.mutate(comment.id);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-red-600"
              title="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className={inputCls} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(comment.content); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending || !draft.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      )}
    </li>
  );
}

export function CommentThread({
  comments,
  isLoading,
  meId,
  orgSlug,
  projectId,
  onAdd,
  isAdding,
}: {
  comments: Comment[];
  isLoading?: boolean;
  meId?: string;
  orgSlug: string;
  projectId: string;
  onAdd: (content: string, done: () => void) => void;
  isAdding?: boolean;
}) {
  const [text, setText] = useState('');
  // Oldest first reads like a conversation.
  const ordered = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), () => setText(''));
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Loading size="sm" />
      ) : ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((c) => (
            <CommentItem key={c.id} comment={c} meId={meId} orgSlug={orgSlug} projectId={projectId} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Write a comment"
          className={inputCls}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isAdding || !text.trim()}>
            {isAdding ? 'Posting...' : 'Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
