'use client';

import { useState } from 'react';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
import { ShowMore } from '@/components/common/list-parts';
import { threadAuthor } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { ThreadComment } from '@/types/portal';

/**
 * The client thread, oldest first, with a composer: the same screen for the team and for the
 * client. Each entry names its author with a Client or Team tag (author_kind). The editor gets no mention list, so nobody can @mention on this thread (the API notifies
 * nobody from it either).
 */
export function ClientThread({
  items,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onMore,
  meId,
  canPost,
  posting,
  onPost,
  emptyText,
  placeholder,
}: {
  items: ThreadComment[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  meId?: string;
  canPost: boolean;
  posting: boolean;
  onPost: (content: string, done: () => void) => void;
  emptyText: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <span>The messages could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="space-y-3" data-testid="client-thread">
          {items.map((c) => {
            const who = threadAuthor(c, meId);
            return (
              <li
                key={c.id}
                data-author-kind={c.author_kind}
                className={who.mine ? 'rounded-md border border-primary/20 bg-primary/5 p-3' : 'rounded-md border border-border p-3'}
              >
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{who.name}</span>
                  <Badge className={cn('px-2 py-0 text-[11px]', who.tag === 'Client' ? 'bg-warning/15 text-foreground' : 'bg-primary/10 text-primary')}>
                    {who.tag}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                </div>
                <RichTextView value={c.content} />
              </li>
            );
          })}
        </ol>
      )}
      <div className="grid">
        <ShowMore show={hasMore} loading={loadingMore} onClick={onMore} />
      </div>
      {canPost && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft) return;
            onPost(draft, () => setDraft(''));
          }}
        >
          <RichTextField value={draft} onChange={setDraft} placeholder={placeholder} ariaLabel="New message" className="min-h-20" />
          <div className="flex justify-end">
            <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto" disabled={!draft || posting}>
              {posting ? 'Sending...' : 'Send message'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
