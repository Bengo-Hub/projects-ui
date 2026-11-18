'use client';

import { useState } from 'react';
import { Eye, Plus, RefreshCw, Save, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RichTextField } from '@/components/common/rich-text';
import { QADialog } from '@/components/qa/qa-dialog';
import { RagPicker } from '@/components/reports/rag';
import { FinancialTiles, FinancialsHiddenNote, KpiTiles, MilestoneList, ReportView, RiskList } from '@/components/reports/report-view';
import { useDeleteReport, usePublishReport, useRefreshReport, useUpdateReport } from '@/hooks/useStatusReports';
import { errorBody } from '@/lib/api/errors';
import {
  MAX_HIGHLIGHTS,
  MAX_HIGHLIGHT_CHARS,
  RAG_DIMENSIONS,
  draftError,
  draftOf,
  draftPatch,
  financialState,
  publishProblem,
  reportErrorText,
  type ReportDraft,
} from '@/lib/reports/logic';
import type { StatusReport } from '@/types/reports';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm min-h-11 sm:min-h-9';

/**
 * A draft report for a project manager: the four ratings with the auto-fill's suggestion, the
 * narrative, highlights, and the auto-filled sections, which can be trimmed but not rewritten.
 * Mount it with a key of the report's id and updated_at, so a save, refresh or publish starts the
 * form again from what the API holds.
 */
export function ReportEditor({
  orgSlug,
  projectId,
  report,
  onOpenPdf,
  onDeleted,
}: {
  orgSlug: string;
  projectId: string;
  report: StatusReport;
  onOpenPdf: () => void;
  onDeleted: () => void;
}) {
  const [saved] = useState(() => draftOf(report));
  const [form, setForm] = useState<ReportDraft>(saved);
  const [tried, setTried] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const update = useUpdateReport(orgSlug, projectId, report.id);
  const refresh = useRefreshReport(orgSlug, projectId, report.id);
  const publish = usePublishReport(orgSlug, projectId, report.id);
  const del = useDeleteReport(orgSlug, projectId);
  const busy = update.isPending || refresh.isPending || publish.isPending || del.isPending;

  const patch = draftPatch(saved, form);
  const dirty = Object.keys(patch).length > 0;
  const error = draftError(form);
  const publishBody = errorBody(publish.error);
  const publishRefused = publishBody?.code === 'validation_error' ? reportErrorText(publishBody.code, publishBody.error, 'The report was not published.') : null;
  const fin = financialState(report);
  const set = <K extends keyof ReportDraft>(k: K, v: ReportDraft[K]) => setForm((x) => ({ ...x, [k]: v }));

  function save() {
    setTried(true);
    if (error || !dirty) return;
    update.mutate(patch);
  }

  function startPublish() {
    setTried(true);
    const problem = publishProblem(form);
    setPublishNote(problem);
    if (problem || error) return;
    setConfirmPublish(true);
  }

  function doPublish() {
    setConfirmPublish(false);
    if (!dirty) {
      publish.mutate();
      return;
    }
    // Unsaved edits go first, so what is published is what is on screen.
    update.mutateAsync(patch).then(
      () => publish.mutate(),
      () => undefined,
    );
  }

  const highlightsFull = form.highlights.length >= MAX_HIGHLIGHTS;

  return (
    <div className="space-y-5" data-testid="report-editor">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Ratings</CardTitle>
          <p className="text-xs text-muted-foreground">Each starts as the suggestion worked out from the project. Change any you see differently.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} aria-label="Report title" disabled={busy} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {RAG_DIMENSIONS.map((d) => (
              <RagPicker
                key={d.key}
                label={d.label}
                value={form[d.key]}
                onChange={(v) => {
                  set(d.key, v);
                  if (d.key === 'rag_overall') setPublishNote(null);
                }}
                suggestion={report.suggested ? report.suggested[d.suggestion] : undefined}
                reason={d.suggestion === 'overall' ? 'the worst of the three' : report.suggested?.reasons?.[d.suggestion]}
                disabled={busy}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Narrative</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextField value={form.narrative} onChange={(html) => set('narrative', html)} ariaLabel="Narrative" placeholder="Where the project stands, what changed and what comes next" disabled={busy} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Highlights</CardTitle>
          <p className="text-xs text-muted-foreground">
            Filled with the tasks finished and milestones reached in the period. Up to {MAX_HIGHLIGHTS}, {MAX_HIGHLIGHT_CHARS} characters each.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2" data-testid="highlights-editor">
            {form.highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={h}
                  maxLength={MAX_HIGHLIGHT_CHARS}
                  onChange={(e) => set('highlights', form.highlights.map((x, j) => (j === i ? e.target.value : x)))}
                  aria-label={`Highlight ${i + 1}`}
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-11 shrink-0 p-0 text-destructive sm:h-9 sm:w-9"
                  onClick={() => set('highlights', form.highlights.filter((_, j) => j !== i))}
                  aria-label={`Remove highlight ${i + 1}`}
                  disabled={busy}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={busy || highlightsFull} onClick={() => set('highlights', [...form.highlights, ''])}>
            <Plus className="h-4 w-4" aria-hidden />
            Add highlight
          </Button>
          {highlightsFull && <p className="text-xs text-muted-foreground">A report holds at most {MAX_HIGHLIGHTS} highlights.</p>}
        </CardContent>
      </Card>

      {report.kpis && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Key figures</CardTitle>
            <p className="text-xs text-muted-foreground">Taken from the project when the draft was filled. Refresh to take them again.</p>
          </CardHeader>
          <CardContent>
            <KpiTiles kpis={report.kpis} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Milestones</CardTitle>
          <p className="text-xs text-muted-foreground">Due in the period or the 30 days after it, and any overdue. Leave out what the reader does not need.</p>
        </CardHeader>
        <CardContent>
          {form.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones in this report.</p>
          ) : (
            <MilestoneList items={form.milestones} onRemove={busy ? undefined : (i) => set('milestones', form.milestones.filter((_, j) => j !== i))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Top risks</CardTitle>
          <p className="text-xs text-muted-foreground">The open risks with the highest scores from the register.</p>
        </CardHeader>
        <CardContent>
          {form.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks in this report.</p>
          ) : (
            <RiskList items={form.risks} onRemove={busy ? undefined : (i) => set('risks', form.risks.filter((_, j) => j !== i))} />
          )}
        </CardContent>
      </Card>

      {fin !== 'none' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financials</CardTitle>
          </CardHeader>
          <CardContent>{report.financials ? <FinancialTiles f={report.financials} /> : <FinancialsHiddenNote />}</CardContent>
        </Card>
      )}

      {tried && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(publishNote || publishRefused) && (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" data-testid="publish-problem">
          {publishNote ?? publishRefused}
        </p>
      )}
      {dirty && <p className="text-xs text-muted-foreground" data-testid="unsaved-note">You have unsaved changes. Refresh is off until they are saved.</p>}

      <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none" data-testid="report-actions">
        <Button className="h-11 sm:h-9" onClick={save} disabled={busy || !dirty}>
          <Save className="h-4 w-4" aria-hidden />
          {update.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" className="h-11 sm:h-9" onClick={startPublish} disabled={busy}>
          <Send className="h-4 w-4" aria-hidden />
          {publish.isPending ? 'Publishing...' : 'Publish'}
        </Button>
        <Button variant="outline" className="h-11 sm:h-9" onClick={() => refresh.mutate()} disabled={busy || dirty}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {refresh.isPending ? 'Refreshing...' : 'Refresh'}
        </Button>
        <Button variant="outline" className="h-11 sm:h-9" onClick={() => setPreviewing(true)} disabled={busy}>
          <Eye className="h-4 w-4" aria-hidden />
          Preview
        </Button>
        <Button variant="ghost" className="h-11 text-destructive sm:h-9" onClick={() => setConfirmDelete(true)} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete draft
        </Button>
      </div>

      {previewing && (
        <QADialog open onOpenChange={(o) => !o && setPreviewing(false)} title="Preview" description="How the report reads once published. The PDF shows the last saved draft." className="sm:max-w-3xl">
          <div className="space-y-4">
            <ReportView report={{ ...report, ...form }} financialsHidden={report.financials_hidden} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setPreviewing(false)}>
                Close
              </Button>
              <Button
                className="h-11 sm:h-9"
                onClick={() => {
                  // The PDF viewer is its own dialog; close the preview so the viewer is not left under it.
                  setPreviewing(false);
                  onOpenPdf();
                }}
              >
                Open the PDF
              </Button>
            </div>
          </div>
        </QADialog>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish this report?"
        description={dirty ? 'Your changes are saved first. Once published the report can no longer change; it can then be shared with the client.' : 'Once published the report can no longer change; it can then be shared with the client.'}
        confirmLabel="Publish report"
        loading={publish.isPending}
        onConfirm={doPublish}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${report.title}"?`}
        description="The draft is removed for good. A new draft for the same period can be opened afterwards."
        confirmLabel="Delete draft"
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(report.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onDeleted();
            },
          })
        }
      />
    </div>
  );
}
