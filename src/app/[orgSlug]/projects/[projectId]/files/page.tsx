'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { ShowMore } from '@/components/common/list-parts';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { EmptyState } from '@/components/ui/empty-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { AttachFilesButton } from '@/components/work/task-attachments';
import { ShareSwitch } from '@/components/portal/share-switch';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '@/hooks/useAttachments';
import { useClientPortalAccess, useShareFile } from '@/hooks/useClients';
import { isClientVisible } from '@/lib/portal/logic';
import { useProjectPeople } from '@/hooks/usePeople';
import { useTaskAccess } from '@/hooks/useTaskAccess';
import { useTaskTitles } from '@/hooks/useTaskTitles';
import { isNotFound } from '@/lib/api/errors';
import { filePlace, fileSize } from '@/lib/work/files';
import type { Attachment } from '@/types';

/**
 * Every file on the project and its tasks, newest first, on the shared data table (cards on
 * phones). Upload adds a file to the project itself; task files are added from the task drawer.
 */
export default function ProjectFilesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const access = useTaskAccess();
  const { nameOf } = useProjectPeople(orgSlug, projectId);
  const titleOf = useTaskTitles(orgSlug, projectId);
  const list = useAttachments(orgSlug, projectId, undefined, access.canViewComments);
  const upload = useUploadAttachment(orgSlug, projectId);
  const remove = useDeleteAttachment(orgSlug, projectId);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const total = list.data?.pages[0]?.total ?? 0;
  const portal = useClientPortalAccess();
  const share = useShareFile(orgSlug, projectId);

  const columns = useMemo<DataTableColumn<Attachment>[]>(
    () => [
      {
        key: 'file_name',
        header: 'File',
        primary: true,
        sortable: true,
        render: (f) =>
          f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-2 font-medium text-primary hover:underline">
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{f.file_name}</span>
            </a>
          ) : (
            <span className="font-medium">{f.file_name}</span>
          ),
      },
      {
        key: 'place',
        header: 'On',
        sortable: true,
        filterable: true,
        accessor: (f) => filePlace(f, orgSlug, projectId, titleOf).label,
        render: (f) => {
          const place = filePlace(f, orgSlug, projectId, titleOf);
          return place.href ? (
            <Link href={place.href} className="text-primary hover:underline">
              {place.label}
            </Link>
          ) : (
            <span className="text-muted-foreground">{place.label}</span>
          );
        },
      },
      { key: 'file_size', header: 'Size', align: 'right', sortable: true, render: (f) => <span className="tabular-nums text-muted-foreground">{fileSize(f.file_size)}</span> },
      {
        key: 'uploaded_by',
        header: 'Added by',
        sortable: true,
        filterable: true,
        accessor: (f) => nameOf(f.uploaded_by),
      },
      {
        key: 'uploaded_at',
        header: 'Added',
        sortable: true,
        render: (f) => <span className="text-muted-foreground">{formatDateTime(f.uploaded_at)}</span>,
      },
      ...(portal.canManage
        ? [
            {
              key: 'client_visible',
              header: 'Client',
              filterable: true,
              accessor: (f: Attachment) => (isClientVisible(f.metadata) ? 'Visible to client' : 'Team only'),
              render: (f: Attachment) => (
                <ShareSwitch
                  checked={isClientVisible(f.metadata)}
                  disabled={share.isPending}
                  label={`Visible to client: ${f.file_name}`}
                  onChange={(visible) => share.mutate({ attachmentId: f.id, visible })}
                />
              ),
            } satisfies DataTableColumn<Attachment>,
          ]
        : []),
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (f) =>
          access.canDeleteFile(f) ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRemoving(f);
              }}
              className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${f.file_name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null,
      },
    ],
    [orgSlug, projectId, titleOf, nameOf, access, portal.canManage, share],
  );

  if (!access.isLoading && !access.collaboration) {
    return <FeatureLocked title="Files are part of team collaboration" description="Upgrade your plan to share files on projects and tasks." />;
  }
  if (isNotFound(list.error)) return <ProjectNotFound orgSlug={orgSlug} />;

  const sendFiles = (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) upload.mutate(f);
  };
  const uploadButton = access.canAttach ? <AttachFilesButton onFiles={sendFiles} pending={upload.isPending} label="Upload a file" /> : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title={total > 0 ? `Files (${total})` : 'Files'}
        subtitle="Files on the project and its tasks. PDF, images, text, Word and Excel, up to 25 MB each."
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={uploadButton}
      />
      <DataTable
        columns={columns}
        rows={list.files}
        rowKey={(f) => f.id}
        loading={list.isLoading}
        loadingRows={5}
        error={list.isError}
        onRetry={() => void list.refetch()}
        emptyState={
          <EmptyState
            icon={Paperclip}
            title="No files yet"
            description={access.canAttach ? 'Upload drawings, quotes or photos so the whole team works from the same copy.' : 'Nobody has shared a file on this project yet.'}
            action={uploadButton}
          />
        }
        gridLines="rows"
        storageKey="projects-files-columns"
        showExportCsv
        exportFileName="project-files"
      />
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
    </div>
  );
}
