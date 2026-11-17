'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, FileText, Link2, Trash2, Upload } from 'lucide-react';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TenderNav } from '@/components/tenders/tender-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { useAddTenderLink, useDeleteTenderDocument, useTender, useTenderDocuments, useUploadTenderDocument } from '@/hooks/useTenders';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import type { TenderDocument } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

/** https only, as projects-api accepts. */
function httpsLink(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && !!u.host;
  } catch {
    return false;
  }
}

/**
 * The tender's documents: files uploaded straight to the shared object storage, or links to files
 * kept elsewhere. A converted tender's documents are linked to its project, never copied.
 */
export default function TenderDocumentsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';
  const { can } = useServicePermissions();
  const canManage = can(PERMS.tendersManage);
  const tender = useTender(orgSlug, tenderId);
  const list = useTenderDocuments(orgSlug, tenderId);
  const upload = useUploadTenderDocument(orgSlug, tenderId);
  const addLink = useAddTenderLink(orgSlug, tenderId);
  const del = useDeleteTenderDocument(orgSlug, tenderId);
  const [link, setLink] = useState({ url: '', name: '' });
  const [deleting, setDeleting] = useState<TenderDocument | null>(null);

  if (tender.isLoading || list.isLoading) return <PageLoading />;
  if (tender.isError || list.isError || !tender.data) return <ErrorBanner message="The documents could not be loaded." />;
  const rows = list.data?.data ?? [];
  const linkOk = httpsLink(link.url) && !!link.name.trim();

  return (
    <div className="space-y-5">
      <PageHeader title="Documents" subtitle={tender.data.title} back={{ href: `/${orgSlug}/tenders/${tenderId}`, label: 'Tender' }} className="mb-0" />
      <TenderNav orgSlug={orgSlug} tenderId={tenderId} />
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-4 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" aria-hidden />
              {upload.isPending ? 'Uploading' : 'Upload a file'}
              <input
                type="file"
                className="sr-only"
                aria-label="Upload a tender document"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload.mutate(file);
                }}
              />
            </label>
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!linkOk) return;
                addLink.mutate({ file_url: link.url.trim(), file_name: link.name.trim() }, { onSuccess: () => setLink({ url: '', name: '' }) });
              }}
            >
              <input className={inputClass} value={link.name} onChange={(e) => setLink((l) => ({ ...l, name: e.target.value }))} placeholder="Name" aria-label="Link name" />
              <input className={inputClass} value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} placeholder="https://" aria-label="Link address" />
              <Button type="submit" variant="outline" className="h-11 sm:h-9" disabled={!linkOk || addLink.isPending}>
                <Link2 className="h-4 w-4" aria-hidden />
                Add link
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="The tender notice, drafts, the final bid and proofs of delivery go here." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card" aria-label="Documents">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3 text-sm">
              {d.stored ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0 flex-1">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline">
                    <span className="truncate">{d.file_name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <span className="truncate font-medium">{d.file_name}</span>
                )}
                <p className="text-xs text-muted-foreground">{formatDateTime(d.uploaded_at)}</p>
              </div>
              {canManage && (
                <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 text-destructive sm:h-8 sm:w-8" onClick={() => setDeleting(d)} aria-label={`Remove ${d.file_name}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove "${deleting?.file_name ?? 'document'}"?`}
        description="A document a submission records stays. A project the tender became keeps its link to the file."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (deleting) del.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
