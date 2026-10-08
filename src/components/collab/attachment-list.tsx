'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react';
import type { Attachment } from '@/types';
import type { CreateAttachmentInput } from '@/lib/api/attachments';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';

const inputCls =
  'w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

/** fileNameFromUrl takes the last path segment of a link as a default name. */
function fileNameFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : '';
  } catch {
    return '';
  }
}

function isHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function AttachmentList({
  items,
  isLoading,
  onAdd,
  isAdding,
  onRemove,
}: {
  items: Attachment[];
  isLoading?: boolean;
  onAdd: (input: CreateAttachmentInput, done: () => void) => void;
  isAdding?: boolean;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const valid = isHttpUrl(url.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const fileUrl = url.trim();
    onAdd({ file_url: fileUrl, file_name: name.trim() || fileNameFromUrl(fileUrl) || fileUrl }, () => {
      setUrl('');
      setName('');
      setOpen(false);
    });
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Loading size="sm" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <span className="truncate">{a.file_name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(a.uploaded_at), 'MMM d, yyyy')}
                  {a.mime_type ? ` · ${a.mime_type}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remove ${a.file_name}?`)) onRemove(a.id);
                }}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-red-600"
                title="Remove attachment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-border p-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.example.com/file.pdf"
            className={inputCls}
            required
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground">
            Paste a link to the file in your drive or document store.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isAdding || !valid}>
              {isAdding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add link
        </Button>
      )}
    </div>
  );
}
