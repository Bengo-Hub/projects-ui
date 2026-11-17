'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Send } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { TenderNav } from '@/components/tenders/tender-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { useRecordSubmission, useTender, useTenderDocuments, useTenderSections, useTenderSubmissions } from '@/hooks/useTenders';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import type { SubmissionInput } from '@/lib/api/tenders';
import { SUBMISSION_METHODS, SUBMISSION_METHOD_LABEL, canDecide, canSubmit, submissionError, type SubmissionMethod } from '@/lib/tenders/logic';
import type { Tender, TenderDocument, TenderSectionSummary } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const METHOD_OPTIONS: ComboboxOption[] = SUBMISSION_METHODS.map((m) => ({ value: m, label: SUBMISSION_METHOD_LABEL[m] }));

function RecordForm({
  orgSlug,
  tender,
  documents,
  sections,
}: {
  orgSlug: string;
  tender: Tender;
  documents: TenderDocument[];
  sections: TenderSectionSummary | undefined;
}) {
  const [f, setF] = useState({
    method: (tender.submission_type as SubmissionMethod) || 'online',
    recipient: '',
    reference: '',
    courier: '',
    email_subject: '',
    submitted_at: '',
    notes: '',
    document_id: '',
    proof_document_id: '',
    override_sections: false,
  });
  const [tried, setTried] = useState(false);
  const record = useRecordSubmission(orgSlug, tender.id);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const docOptions: ComboboxOption[] = documents.map((d) => ({ value: d.id, label: d.file_name }));
  const first = tender.status === 'preparing';
  const sectionsOpen = first && !!sections && sections.total > 0 && !sections.ready;
  const error = submissionError(f.method, f.recipient) ?? (sectionsOpen && !f.override_sections ? `${sections?.by_status.approved ?? 0} of ${sections?.total} sections are approved.` : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const body: SubmissionInput = { method: f.method };
    for (const k of ['recipient', 'reference', 'courier', 'email_subject', 'notes'] as const) if (f[k].trim()) body[k] = f[k].trim();
    if (f.submitted_at) body.submitted_at = new Date(f.submitted_at).toISOString();
    if (f.document_id) body.document_id = f.document_id;
    if (f.proof_document_id) body.proof_document_id = f.proof_document_id;
    if (f.override_sections) body.override_sections = true;
    record.mutate(body, {
      onSuccess: () => {
        setTried(false);
        setF((x) => ({ ...x, reference: '', courier: '', email_subject: '', submitted_at: '', notes: '', document_id: '', proof_document_id: '', override_sections: false }));
      },
    });
  }

  const recipientLabel = f.method === 'email' ? 'Sent to (email address)' : f.method === 'physical' ? 'Delivered to (address)' : 'Portal';
  const referenceLabel = f.method === 'physical' ? 'Tracking or receipt number' : f.method === 'email' ? 'Message reference' : 'Portal confirmation number';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{first ? 'Submit the bid' : 'Record another submission'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <span className="font-medium">How it went out</span>
              <SearchableCombobox options={METHOD_OPTIONS} value={f.method} onChange={(v) => set('method', (v || 'online') as SubmissionMethod)} clearable={false} searchPlaceholder="Method" />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">When</span>
              <input type="datetime-local" className={inputClass} value={f.submitted_at} onChange={(e) => set('submitted_at', e.target.value)} aria-label="Submitted at" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{recipientLabel}</span>
              <input className={inputClass} value={f.recipient} onChange={(e) => set('recipient', e.target.value)} aria-label="Recipient" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{referenceLabel}</span>
              <input className={inputClass} value={f.reference} onChange={(e) => set('reference', e.target.value)} aria-label="Reference" />
            </label>
            {f.method === 'physical' && (
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Courier</span>
                <input className={inputClass} value={f.courier} onChange={(e) => set('courier', e.target.value)} aria-label="Courier" />
              </label>
            )}
            {f.method === 'email' && (
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Email subject</span>
                <input className={inputClass} value={f.email_subject} onChange={(e) => set('email_subject', e.target.value)} aria-label="Email subject" />
              </label>
            )}
            <div className="space-y-1 text-sm">
              <span className="font-medium">The bid as sent</span>
              <SearchableCombobox options={docOptions} value={f.document_id} onChange={(v) => set('document_id', v ?? '')} placeholder="No document" searchPlaceholder="Find a document" />
            </div>
            <div className="space-y-1 text-sm">
              <span className="font-medium">Proof of receipt</span>
              <SearchableCombobox options={docOptions} value={f.proof_document_id} onChange={(v) => set('proof_document_id', v ?? '')} placeholder="No document" searchPlaceholder="Find a document" />
            </div>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Notes</span>
            <textarea className={`${inputClass} min-h-16`} value={f.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Submission notes" />
          </label>
          {sectionsOpen && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.override_sections} onChange={(e) => set('override_sections', e.target.checked)} />
              Submit although not every section is approved
            </label>
          )}
          {tried && error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" className="h-11 sm:h-9" disabled={record.isPending}>
              <Send className="h-4 w-4" aria-hidden />
              {record.isPending ? 'Saving' : 'Record submission'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** How the bid went out (US-1.10, US-1.11): every delivery, with its reference and proof. */
export default function TenderSubmissionsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';
  const { can } = useServicePermissions();
  const canManage = can(PERMS.tendersManage);
  const tender = useTender(orgSlug, tenderId);
  const list = useTenderSubmissions(orgSlug, tenderId);
  const docs = useTenderDocuments(orgSlug, tenderId);
  const sections = useTenderSections(orgSlug, tenderId);

  if (tender.isLoading || list.isLoading) return <PageLoading />;
  if (tender.isError || list.isError || !tender.data) return <ErrorBanner message="The submissions could not be loaded." />;
  const t = tender.data;
  const rows = list.data?.data ?? [];
  const documents = docs.data?.data ?? [];
  const docName = (id?: string | null) => documents.find((d) => d.id === id)?.file_name;

  return (
    <div className="space-y-5">
      <PageHeader title="Submissions" subtitle={t.title} back={{ href: `/${orgSlug}/tenders/${tenderId}`, label: 'Tender' }} className="mb-0" />
      <TenderNav orgSlug={orgSlug} tenderId={tenderId} />
      {canManage && canSubmit(t.status) && <RecordForm orgSlug={orgSlug} tender={t} documents={documents} sections={sections.data?.summary} />}
      {canManage && canDecide(t.status) && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">Make the go decision on the overview before submitting the bid.</p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Send} title="Not submitted yet" description="Each delivery of the bid is recorded here." />
      ) : (
        <ul className="space-y-3" aria-label="Submissions">
          {rows.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-card p-4 text-sm" data-testid="submission">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {SUBMISSION_METHOD_LABEL[s.method] ?? s.method}
                  {s.metadata?.resubmission ? ' (again)' : ''}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(s.submitted_at)}</span>
              </div>
              {s.recipient && <p className="mt-1 break-words">To {s.recipient}</p>}
              {s.reference && <p className="text-muted-foreground">Reference {s.reference}</p>}
              {s.courier && <p className="text-muted-foreground">By {s.courier}</p>}
              {s.metadata?.email_subject && <p className="text-muted-foreground">Subject: {s.metadata.email_subject}</p>}
              {docName(s.document_id) && <p className="text-muted-foreground">Bid: {docName(s.document_id)}</p>}
              {docName(s.proof_document_id) && <p className="text-muted-foreground">Proof: {docName(s.proof_document_id)}</p>}
              {s.notes && <p className="mt-1 whitespace-pre-wrap">{s.notes}</p>}
              {s.metadata?.sections_overridden && <p className="mt-1 text-xs text-warning">Sent before every section was approved.</p>}
              <p className="mt-1 text-xs text-muted-foreground">Recorded by {s.submitted_by_name || 'someone not signed in to Projects'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
