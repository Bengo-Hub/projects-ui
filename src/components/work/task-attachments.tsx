'use client';

import { useRef, useState } from 'react';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { ShowMore } from '@/components/common/list-parts';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ShareSwitch } from '@/components/portal/share-switch';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '@/hooks/useAttachments';
import { useClientPortalAccess, useShareFile } from '@/hooks/useClients';
import { isClientVisible } from '@/lib/portal/logic';
import type { TaskAccess } from '@/hooks/useTaskAccess';
import { fileSize } from '@/lib/work/files';
import type { Attachment } from '@/types';

/** The "Attach a file" button with its hidden multi-file input (task drawer and project files page). */
export function AttachFilesButton({ onFiles, pending, label = 'Attach a file' }: { onFiles: (files: FileList | null) => void; pending: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Choose files to attach"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant="outline" className="h-11 sm:h-9" disabled={pending} onClick={() => input.current?.click()}>
        <Paperclip className="h-4 w-4" aria-hidden />
        {pending ? 'Uploading...' : label}
      </Button>
    </>
  );
}

/** Files on a task (or on the project when taskId is empty): upload straight to storage, list, remove. */
export function TaskAttachments({
  orgSlug,
  projectId,
  taskId,
  access,
  nameOf,
}: {
  orgSlug: string;
  projectId: string;
  taskId?: string;
  access: TaskAccess;
  nameOf: (userId: string) => string;
}) {
  const list = useAttachments(orgSlug, projectId, taskId, access.canViewComments);
  const upload = useUploadAttachment(orgSlug, projectId, taskId);
  const remove = useDeleteAttachment(orgSlug, projectId);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [over, setOver] = useState(false);
  const portal = useClientPortalAccess();
  const share = useShareFile(orgSlug, projectId);

  const sendFiles = (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) upload.mutate(f);
  };

  return (
    <section aria-labelledby="files-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="files-heading" className="text-sm font-semibold">
          Files
        </h3>
        {access.canAttach && <AttachFilesButton onFiles={sendFiles} pending={upload.isPending} />}
      </div>
      {access.canAttach && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            sendFiles(e.dataTransfer.files);
          }}
          className={`hidden rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground md:block ${over ? 'border-primary bg-primary/5' : 'border-border'}`}
        >
          Drop files here. PDF, images, text, Word and Excel, up to 25 MB each.
        </div>
      )}
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading files</p>
      ) : list.files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {list.files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-2">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-primary hover:underline">
                    {f.file_name}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium">{f.file_name}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {fileSize(f.file_size)} · {nameOf(f.uploaded_by)} · {formatDateTime(f.uploaded_at)}
                </span>
              </div>
              {portal.canManage && (
                <ShareSwitch
                  checked={isClientVisible(f.metadata)}
                  disabled={share.isPending}
                  label={`Visible to client: ${f.file_name}`}
                  onChange={(visible) => share.mutate({ attachmentId: f.id, visible })}
                  compact
                  className="shrink-0"
                />
              )}
              {access.canDeleteFile(f) && (
                <button
                  type="button"
                  onClick={() => setRemoving(f)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label={`Remove ${f.file_name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="grid">
        <ShowMore show={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
      </div>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this file?"
        description={removing ? `${removing.file_name} is deleted from storage for everyone.` : undefined}
        confirmLabel="Remove"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </section>
  );
}
