'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Copy, FileText, Lock, Play, RefreshCw, ThumbsDown, ThumbsUp, UserPlus, X } from 'lucide-react';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { Field, inputClass } from '@/components/qa/fields';
import { OutcomeSummary } from '@/components/qa/outcome-summary';
import { QADialog } from '@/components/qa/qa-dialog';
import { QANoAccess } from '@/components/qa/qa-nav';
import {
  DefectStatusBadge,
  InviteStatusBadge,
  ResultBadge,
  RoleBadge,
  SessionStatusBadge,
  SeverityBadge,
  WeightBadge,
} from '@/components/qa/qa-badges';
import { VerdictForm } from '@/components/qa/verdict-form';
import {
  useCloseQASession,
  useDecideQASession,
  useInviteQA,
  useOpenQASession,
  useQAPermissions,
  useQASession,
  useQASessionBoard,
  useRaiseQADefect,
  useRecordQAResult,
  useRevokeQAInvite,
} from '@/hooks/useQA';
import { qaApi } from '@/lib/api/qa';
import {
  acceptBlockedReason,
  canRaiseTicket,
  describeDevice,
  groupByCriterion,
  normalizeVerdict,
  QA_PERMISSIONS,
  ROLE_HELP,
  ROLE_LABELS,
  shareLink,
  verdictProblem,
} from '@/lib/qa/logic';
import { cn, formatDate } from '@/lib/utils';
import type { InviteInput } from '@/lib/api/qa';
import type { QADefect, QARole, QASnapshotCriterion, QAVerdictInput } from '@/types/qa';

type Tab = 'criteria' | 'defects' | 'invites';

/** The signed-in team member's own verdict on one criterion (projects.qa.run). */
function RecordMine({ orgSlug, sessionId, criterion }: { orgSlug: string; sessionId: string; criterion: QASnapshotCriterion }) {
  const record = useRecordQAResult(orgSlug, sessionId);
  const [v, setV] = useState<QAVerdictInput | undefined>();
  const problem = v ? verdictProblem(v) : 'Choose a verdict.';
  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <p className="text-sm font-medium">Record my verdict</p>
      <VerdictForm label={criterion.title} value={v} onChange={setV} disabled={record.isPending} />
      <Button
        size="sm"
        disabled={!!problem || record.isPending}
        onClick={() =>
          v &&
          record.mutate(
            { criterionId: criterion.id, verdict: { ...normalizeVerdict(v), device: describeDevice(navigator.userAgent) } },
            { onSuccess: () => setV(undefined) },
          )
        }
      >
        {record.isPending ? 'Saving...' : 'Save verdict'}
      </Button>
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSend, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onSend: (list: InviteInput[]) => void; pending: boolean }) {
  const blank: InviteInput = { email: '', name: '', role: 'tester' };
  const [rows, setRows] = useState<InviteInput[]>([blank]);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = rows.map((r) => ({ ...r, email: r.email.trim(), name: (r.name ?? '').trim() })).filter((r) => r.email);
    if (!list.length) return setError('Add at least one email address.');
    const bad = list.find((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    if (bad) return setError(`${bad.email} is not a valid email address.`);
    setError(null);
    onSend(list);
  }

  return (
    <QADialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setRows([blank]);
        onOpenChange(o);
      }}
      title="Invite people"
      description="Each address gets the link by email and proves it with a code or by signing in. Addresses are kept only as a masked hint."
      className="sm:max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {rows.map((r, i) => (
          <fieldset key={i} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
            <legend className="sr-only">Person {i + 1}</legend>
            <Field label="Email" required>
              {({ id }) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="off"
                  className={inputClass}
                  value={r.email}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                />
              )}
            </Field>
            <Field label="Name">
              {({ id }) => (
                <input id={id} className={inputClass} maxLength={200} value={r.name} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              )}
            </Field>
            <Field label="Role">
              {({ id }) => (
                <select id={id} className={inputClass} value={r.role} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, role: e.target.value as QARole } : x)))}>
                  {(Object.keys(ROLE_LABELS) as QARole[]).map((role) => (
                    <option key={role} value={role} title={ROLE_HELP[role]}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove person ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </fieldset>
        ))}
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(Object.keys(ROLE_LABELS) as QARole[]).map((role) => (
            <li key={role}>
              <span className="font-medium text-foreground">{ROLE_LABELS[role]}:</span> {ROLE_HELP[role]}
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 100} onClick={() => setRows((rs) => [...rs, { ...blank }])}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add another
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending...' : 'Send invitations'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

export default function QASessionPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const sessionId = (params?.sessionId as string) ?? '';
  const perms = useQAPermissions();
  const { data: session, isLoading, isError, refetch } = useQASession(orgSlug, sessionId, perms.canView);
  const board = useQASessionBoard(orgSlug, sessionId, perms.canView);
  const open = useOpenQASession(orgSlug, sessionId);
  const close = useCloseQASession(orgSlug, sessionId);
  const decide = useDecideQASession(orgSlug, sessionId);
  const invite = useInviteQA(orgSlug, sessionId);
  const revoke = useRevokeQAInvite(orgSlug, sessionId);
  const raise = useRaiseQADefect(orgSlug, sessionId);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });

  const [tab, setTab] = useState<Tab>('criteria');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [deciding, setDeciding] = useState<'accepted' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');

  const outcome = board.outcome.data;
  const results = useMemo(() => groupByCriterion(board.results.data?.data), [board.results.data]);
  const defects = board.defects.data?.data ?? [];
  const defectByCriterion = useMemo(() => new Map<string, QADefect>(defects.map((d) => [d.criterion_id, d])), [defects]);
  const invites = board.invites.data?.data ?? [];

  if (perms.isLoading || (perms.canView && isLoading)) return <PageLoading />;
  if (!perms.canView) return <QANoAccess permission={QA_PERMISSIONS.view} />;
  if (isError || !session) return <ErrorBanner message="The session could not be loaded." />;

  const status = session.status ?? 'draft';
  const criteria = [...(session.criteria_snapshot ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const statusById = new Map((outcome?.criteria ?? []).map((c) => [c.id, c]));
  const titleById = new Map(criteria.map((c) => [c.id, c]));
  const frozen = status !== 'draft' && status !== 'open';
  const acceptBlocked = acceptBlockedReason(status, outcome);
  const decided = status === 'accepted' || status === 'rejected';
  const link = session.share_code && typeof window !== 'undefined' ? shareLink(window.location.origin, session.share_code) : '';

  function refreshAll() {
    void refetch();
    Object.values(board).forEach((q) => void q.refetch());
  }

  function retryTicket(criterionId: string) {
    raise.mutate(criterionId, {
      onSuccess: (d) => {
        const def = d as QADefect;
        if (def.status === 'ticketed') toast.success(def.ticket_number ? `Ticket ${def.ticket_number} raised` : 'Ticket raised');
        else toast.error(def.last_error ? `The ticket did not open: ${def.last_error}` : 'The ticket did not open; try again later');
      },
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'criteria', label: `Criteria (${criteria.length})` },
    { id: 'defects', label: `Defects (${defects.length})` },
    { id: 'invites', label: `People (${invites.filter((i) => i.status !== 'revoked').length})` },
  ];

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/qa`} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Sessions
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{session.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <SessionStatusBadge status={status} />
            {session.metadata?.template_name && <span>From {session.metadata.template_name}</span>}
            {session.subject_kind === 'service' && <span>Service {session.subject_ref}</span>}
            {session.opened_at && <span>Opened {formatDate(session.opened_at)}</span>}
            {session.closed_at && <span>Closed {formatDate(session.closed_at)}</span>}
          </div>
          {session.metadata?.decision?.reason && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Decision note:</span> {session.metadata.decision.reason}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={refreshAll} aria-label="Refresh the board">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void openPreview(() => qaApi.reportPdf(orgSlug, sessionId), {
                fileName: `acceptance-${sessionId}.pdf`,
                title: frozen ? 'Acceptance report' : 'Acceptance report (draft, not yet closed)',
              })
            }
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Report PDF
          </Button>
          {perms.canManage && status === 'draft' && (
            <Button onClick={() => open.mutate(undefined)} disabled={open.isPending || !criteria.length}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Open for testing
            </Button>
          )}
          {perms.canManage && status === 'open' && (
            <Button onClick={() => setConfirmClose(true)} disabled={close.isPending}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Close session
            </Button>
          )}
          {perms.canManage && status === 'closed' && (
            <>
              <Button onClick={() => setDeciding('accepted')} disabled={!!acceptBlocked} aria-describedby={acceptBlocked ? 'accept-blocked' : undefined}>
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                Accept
              </Button>
              <Button variant="destructive" onClick={() => setDeciding('rejected')}>
                <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {perms.canManage && status === 'closed' && acceptBlocked && (
        <p id="accept-blocked" role="note" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Accept is not available. {acceptBlocked}
        </p>
      )}

      {session.document_hash && (
        <p className="break-all text-xs text-muted-foreground">
          Report SHA-256 at close: <span className="font-mono">{session.document_hash}</span>
        </p>
      )}

      {link && status !== 'draft' && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Link for invited people</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{link}</p>
              <p className="text-xs text-muted-foreground">The link alone grants nothing: each person proves an invited email first.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(link)
                  .then(() => toast.success('Link copied'))
                  .catch(() => toast.error('Copy did not work; select the link instead'))
              }
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy link
            </Button>
          </CardContent>
        </Card>
      )}
      {status === 'draft' && (
        <p className="text-sm text-muted-foreground">Invited people can get in once the session is opened.</p>
      )}

      {outcome ? <OutcomeSummary outcome={outcome} frozen={frozen} /> : board.outcome.isError ? <ErrorBanner message="The outcome could not be loaded." /> : null}

      <div role="tablist" aria-label="Session details" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.id === tab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                setTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }
            }}
            className={cn(
              'min-h-10 whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'criteria' && (
        <section id="panel-criteria" role="tabpanel" aria-labelledby="tab-criteria" className="space-y-2">
          {criteria.map((c) => {
            const st = statusById.get(c.id);
            const mine = results.get(c.id) ?? [];
            const defect = defectByCriterion.get(c.id);
            const isOpen = expanded === c.id;
            return (
              <Card key={c.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`crit-${c.id}`}
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="flex w-full flex-col gap-2 rounded-lg p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    {c.area_code && <span className="mr-2 font-mono text-xs text-muted-foreground">{c.area_code}</span>}
                    <span className="font-medium">{c.title}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    <WeightBadge weight={c.weight} />
                    <ResultBadge result={st?.status ?? 'not_run'} severity={st?.severity} />
                    <span className="text-xs text-muted-foreground">
                      {st?.testers ?? 0} {st?.testers === 1 ? 'tester' : 'testers'}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <CardContent id={`crit-${c.id}`} className="space-y-4">
                    {(c.steps || c.expected_result) && (
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        {c.steps && (
                          <div>
                            <dt className="text-xs font-medium text-muted-foreground">Steps</dt>
                            <dd className="whitespace-pre-wrap">{c.steps}</dd>
                          </div>
                        )}
                        {c.expected_result && (
                          <div>
                            <dt className="text-xs font-medium text-muted-foreground">Expected result</dt>
                            <dd className="whitespace-pre-wrap">{c.expected_result}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    <div>
                      <h3 className="mb-2 text-sm font-medium">Verdicts by tester</h3>
                      {mine.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No verdict yet.</p>
                      ) : (
                        <ul className="divide-y divide-border rounded-md border border-border">
                          {mine.map((r) => (
                            <li key={r.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium">{r.tester_hint ?? 'Tester'}</p>
                                {r.notes && <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p>}
                                {r.device && <p className="text-xs text-muted-foreground">{r.device}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <ResultBadge result={r.result} severity={r.severity} />
                                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {perms.canManage && canRaiseTicket(st?.status ?? 'not_run', defect) && (
                      <Button size="sm" variant="outline" disabled={raise.isPending} onClick={() => retryTicket(c.id)}>
                        {defect ? 'Retry the ticket' : 'Raise a ticket'}
                      </Button>
                    )}
                    {perms.canRun && status === 'open' && <RecordMine orgSlug={orgSlug} sessionId={sessionId} criterion={c} />}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'defects' && (
        <section id="panel-defects" role="tabpanel" aria-labelledby="tab-defects">
          {defects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No defects. Severity 1 and 2 failures open a ticket on their own; 3 and 4 can be raised from the criterion.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {defects.map((d) => (
                <li key={d.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{titleById.get(d.criterion_id)?.title ?? 'Criterion'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <SeverityBadge severity={d.severity} />
                      <DefectStatusBadge status={d.status} />
                      {d.ticket_number && <span className="font-mono text-xs">Ticket {d.ticket_number}</span>}
                    </div>
                    {d.status === 'ticket_failed' && d.last_error && <p className="mt-1 text-xs text-destructive">{d.last_error}</p>}
                  </div>
                  {perms.canManage && d.status !== 'ticketed' && (
                    <Button size="sm" variant="outline" disabled={raise.isPending} onClick={() => retryTicket(d.criterion_id)}>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Retry ticket
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'invites' && (
        <section id="panel-invites" role="tabpanel" aria-labelledby="tab-invites" className="space-y-3">
          {perms.canManage && !decided && (
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite people
            </Button>
          )}
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is invited yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{i.name || i.email_hint}</p>
                    {i.name && <p className="text-xs text-muted-foreground">{i.email_hint}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <RoleBadge role={i.role} />
                      <InviteStatusBadge status={i.status} />
                      {i.last_seen_at && <span className="text-xs text-muted-foreground">Last seen {formatDate(i.last_seen_at)}</span>}
                    </div>
                  </div>
                  {perms.canManage && i.status !== 'revoked' && (
                    <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)} aria-label={`Revoke access for ${i.name || i.email_hint}`}>
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">To change a role, invite the same address again with the new role. Revoking ends access at once.</p>
        </section>
      )}

      <InviteDialog open={showInvite} onOpenChange={setShowInvite} pending={invite.isPending} onSend={(list) => invite.mutate(list, { onSuccess: () => setShowInvite(false) })} />

      <QADialog open={confirmClose} onOpenChange={setConfirmClose} title="Close this session?" description="Recording stops, the outcome is frozen and the report is stored with its hash.">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirmClose(false)}>
            Keep it open
          </Button>
          <Button disabled={close.isPending} onClick={() => close.mutate(undefined, { onSuccess: () => setConfirmClose(false) })}>
            {close.isPending ? 'Closing...' : 'Close session'}
          </Button>
        </div>
      </QADialog>

      <QADialog
        open={!!deciding}
        onOpenChange={(o) => {
          if (!o) {
            setDeciding(null);
            setReason('');
          }
        }}
        title={deciding === 'accepted' ? 'Accept this session' : 'Reject this session'}
        description="The decision is final and is sent to the session owner and the signers."
      >
        <div className="space-y-4">
          <Field label={deciding === 'rejected' ? 'Reason' : 'Note (optional)'} required={deciding === 'rejected'}>
            {({ id }) => <textarea id={id} rows={3} maxLength={2000} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button
              variant={deciding === 'rejected' ? 'destructive' : 'default'}
              disabled={decide.isPending || (deciding === 'rejected' && !reason.trim())}
              onClick={() =>
                deciding &&
                decide.mutate(
                  { decision: deciding, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      setDeciding(null);
                      setReason('');
                    },
                  },
                )
              }
            >
              {decide.isPending ? 'Saving...' : deciding === 'accepted' ? 'Accept' : 'Reject'}
            </Button>
          </div>
        </div>
      </QADialog>

      <PdfPreview {...previewProps} />
    </div>
  );
}
