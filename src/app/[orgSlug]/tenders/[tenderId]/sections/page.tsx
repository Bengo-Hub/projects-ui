'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { StaffPicker } from '@/components/common/staff-picker';
import { CountRow } from '@/components/common/list-parts';
import { TenderNav } from '@/components/tenders/tender-nav';
import { QADialog } from '@/components/qa/qa-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import {
  useCreateSection,
  useDeleteSection,
  useReviewSection,
  useSubmitSection,
  useTender,
  useTenderDocuments,
  useTenderSections,
  useUpdateSection,
} from '@/hooks/useTenders';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/auth';
import { PERMS } from '@/lib/auth/permissions';
import type { SectionInput } from '@/lib/api/tenders';
import { SECTION_STATUS_LABEL, sectionActions, sectionsOpen, type SectionStatus } from '@/lib/tenders/logic';
import type { TenderDocument, TenderSection } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm disabled:opacity-70';

function SectionDialog({
  orgSlug,
  tenderId,
  section,
  canManage,
  documents,
  onClose,
}: {
  orgSlug: string;
  tenderId: string;
  section: TenderSection | null;
  canManage: boolean;
  documents: TenderDocument[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    title: section?.title ?? '',
    description: section?.description ?? '',
    assignee_id: section?.assignee_id ?? '',
    reviewer_id: section?.reviewer_id ?? '',
    due_date: section?.due_date ? section.due_date.slice(0, 10) : '',
    document_id: section?.document_id ?? '',
    status: (section?.status ?? 'not_started') as string,
  });
  const create = useCreateSection(orgSlug, tenderId);
  const update = useUpdateSection(orgSlug, tenderId);
  const pending = create.isPending || update.isPending;
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const docOptions: ComboboxOption[] = documents.map((d) => ({ value: d.id, label: d.file_name }));
  const statusEditable = f.status === 'not_started' || f.status === 'in_progress';

  const error = canManage && !f.title.trim() ? 'The section needs a title.' : f.assignee_id && f.assignee_id === f.reviewer_id ? 'The reviewer must be someone other than the assignee.' : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    if (!section) {
      const body: SectionInput = { title: f.title.trim() };
      if (f.description.trim()) body.description = f.description.trim();
      if (f.assignee_id) body.assignee_id = f.assignee_id;
      if (f.reviewer_id) body.reviewer_id = f.reviewer_id;
      if (f.due_date) body.due_date = f.due_date;
      if (f.document_id) body.document_id = f.document_id;
      create.mutate(body, { onSuccess: onClose });
      return;
    }
    const body: SectionInput = {};
    if (canManage) {
      if (f.title.trim() !== section.title) body.title = f.title.trim();
      if (f.description !== (section.description ?? '')) body.description = f.description;
      if (f.assignee_id !== (section.assignee_id ?? '')) body.assignee_id = f.assignee_id;
      if (f.reviewer_id !== (section.reviewer_id ?? '')) body.reviewer_id = f.reviewer_id;
      if (f.due_date !== (section.due_date ? section.due_date.slice(0, 10) : '')) body.due_date = f.due_date;
    }
    if (f.document_id !== (section.document_id ?? '')) body.document_id = f.document_id;
    if (statusEditable && f.status !== section.status) body.status = f.status as 'not_started' | 'in_progress';
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: section.id, body }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={section ? section.title : 'New section'}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={inputClass} value={f.title} onChange={(e) => set('title', e.target.value)} disabled={!canManage} aria-label="Section title" placeholder="For example: technical proposal" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">What it covers</span>
          <textarea className={`${inputClass} min-h-16`} value={f.description} onChange={(e) => set('description', e.target.value)} disabled={!canManage} aria-label="Section description" />
        </label>
        {canManage && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <span className="font-medium">Assigned to</span>
              <StaffPicker orgSlug={orgSlug} value={f.assignee_id} onChange={(v) => set('assignee_id', v)} />
            </div>
            <div className="space-y-1 text-sm">
              <span className="font-medium">Reviewer</span>
              <StaffPicker orgSlug={orgSlug} value={f.reviewer_id} onChange={(v) => set('reviewer_id', v)} exclude={f.assignee_id ? [f.assignee_id] : []} />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Due</span>
              <input type="date" className={inputClass} value={f.due_date} onChange={(e) => set('due_date', e.target.value)} aria-label="Section due date" />
            </label>
          </div>
        )}
        <div className="space-y-1 text-sm">
          <span className="font-medium">Latest draft</span>
          <SearchableCombobox options={docOptions} value={f.document_id} onChange={(v) => set('document_id', v ?? '')} placeholder="No document" searchPlaceholder="Find a tender document" />
          <p className="text-xs text-muted-foreground">Upload drafts on the Documents page, then pick one here.</p>
        </div>
        {section && statusEditable && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.status === 'in_progress'} onChange={(e) => set('status', e.target.checked ? 'in_progress' : 'not_started')} />
            Work has started
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={pending}>
            {pending ? 'Saving' : section ? 'Save section' : 'Add section'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

function ChangesDialog({ orgSlug, tenderId, section, onClose }: { orgSlug: string; tenderId: string; section: TenderSection; onClose: () => void }) {
  const [comment, setComment] = useState('');
  const review = useReviewSection(orgSlug, tenderId);
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={`Ask for changes: ${section.title}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!comment.trim()) return;
          review.mutate({ id: section.id, approve: false, comment: comment.trim() }, { onSuccess: onClose });
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">What needs to change</span>
          <textarea className={`${inputClass} min-h-24`} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Change request comment" />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={!comment.trim() || review.isPending}>
            Send back
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

/**
 * The bid split into sections (US-1.7 to US-1.9): who writes each, who reviews it, when it is due
 * and where it stands. The assignee submits for review; the reviewer (or a tender manager, never
 * the assignee) approves it or asks for changes.
 */
export default function TenderSectionsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';
  const me = useAuthStore((s) => s.user?.id ?? '');
  const { can } = useServicePermissions();
  const canManage = can(PERMS.tendersManage);
  const tender = useTender(orgSlug, tenderId);
  const list = useTenderSections(orgSlug, tenderId);
  const docs = useTenderDocuments(orgSlug, tenderId);
  const submit = useSubmitSection(orgSlug, tenderId);
  const review = useReviewSection(orgSlug, tenderId);
  const del = useDeleteSection(orgSlug, tenderId);
  const [editing, setEditing] = useState<TenderSection | 'new' | null>(null);
  const [changes, setChanges] = useState<TenderSection | null>(null);
  const [deleting, setDeleting] = useState<TenderSection | null>(null);

  const open = tender.data ? sectionsOpen(tender.data.status) : false;
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);

  const columns = useMemo<DataTableColumn<TenderSection>[]>(() => {
    const cols: DataTableColumn<TenderSection>[] = [
      {
        key: 'title',
        header: 'Section',
        primary: true,
        render: (s) => (
          <span className="min-w-0">
            <span className="font-medium">{s.title}</span>
            {s.status === 'changes_requested' && s.review_comment && <span className="block text-xs text-warning">{s.review_comment}</span>}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (s) => s.status,
        render: (s) => <Badge status={s.status}>{SECTION_STATUS_LABEL[s.status as SectionStatus] ?? s.status}</Badge>,
      },
      { key: 'assignee', header: 'Assigned to', accessor: (s) => s.assignee_name, render: (s) => s.assignee_name || <span className="text-muted-foreground">Nobody</span> },
      { key: 'reviewer', header: 'Reviewer', hideBelow: 'md', accessor: (s) => s.reviewer_name, render: (s) => s.reviewer_name || <span className="text-muted-foreground">Any tender manager</span> },
      { key: 'due', header: 'Due', hideBelow: 'md', accessor: (s) => s.due_date ?? '', render: (s) => formatDate(s.due_date ?? null, null, { fallback: '-' }) },
    ];
    if (open) {
      cols.push({
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (s) => {
          const a = sectionActions(s, me, canManage);
          return (
            <span className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {a.canSubmit && (
                <Button variant="outline" className="h-10 sm:h-8" disabled={submit.isPending} onClick={() => submit.mutate(s.id)} aria-label={`Send ${s.title} for review`}>
                  Send for review
                </Button>
              )}
              {a.canReview && (
                <>
                  <Button className="h-10 sm:h-8" disabled={review.isPending} onClick={() => review.mutate({ id: s.id, approve: true, comment: '' })} aria-label={`Approve ${s.title}`}>
                    Approve
                  </Button>
                  <Button variant="outline" className="h-10 sm:h-8" onClick={() => setChanges(s)} aria-label={`Ask for changes on ${s.title}`}>
                    Ask for changes
                  </Button>
                </>
              )}
              {a.canEdit && (
                <Button variant="ghost" className="h-10 w-10 p-0 text-destructive sm:h-8 sm:w-8" onClick={() => setDeleting(s)} aria-label={`Delete section ${s.title}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </span>
          );
        },
      });
    }
    return cols;
  }, [open, me, canManage, submit, review]);

  if (tender.isLoading || list.isLoading) return <PageLoading />;
  if (tender.isError || list.isError || !tender.data) return <ErrorBanner message="The sections could not be loaded." />;
  const summary = list.data?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sections"
        subtitle={tender.data.title}
        back={{ href: `/${orgSlug}/tenders/${tenderId}`, label: 'Tender' }}
        className="mb-0"
        actions={
          canManage && open ? (
            <Button className="h-11 sm:h-9" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" aria-hidden />
              Add section
            </Button>
          ) : undefined
        }
      />
      <TenderNav orgSlug={orgSlug} tenderId={tenderId} />
      {summary && summary.total > 0 && (
        <CountRow
          items={[
            { label: 'Sections', value: summary.total },
            { label: 'Approved', value: summary.by_status.approved ?? 0 },
            { label: 'In review', value: summary.by_status.in_review ?? 0 },
            { label: 'Ready to submit', value: summary.ready ? 'Yes' : 'Not yet' },
          ]}
        />
      )}
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="No sections yet" description={canManage ? 'Split the bid into parts and give each one to a person.' : 'The bid has not been split into sections.'} />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={(s) => setEditing(s)} gridLines="rows" storageKey="projects-tender-sections-columns" />
      )}

      {editing && (
        <SectionDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgSlug={orgSlug}
          tenderId={tenderId}
          section={editing === 'new' ? null : editing}
          canManage={canManage && open}
          documents={docs.data?.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {changes && <ChangesDialog orgSlug={orgSlug} tenderId={tenderId} section={changes} onClose={() => setChanges(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.title ?? 'section'}"?`}
        description="The section and its review trail go; its documents stay on the tender."
        confirmLabel="Delete section"
        variant="danger"
        onConfirm={() => {
          if (deleting) del.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
