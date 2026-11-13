'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, LogOut } from 'lucide-react';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { InviteeAccess } from '@/components/qa/invitee-access';
import { InviteeChecklist } from '@/components/qa/invitee-checklist';
import { OutcomeSummary } from '@/components/qa/outcome-summary';
import { QADialog } from '@/components/qa/qa-dialog';
import { ResultBadge, RoleBadge, SessionStatusBadge, WeightBadge } from '@/components/qa/qa-badges';
import { useQAAccessInfo, useQAInviteeLogout, useQAInviteeSession } from '@/hooks/useQAInvitee';
import { httpStatus, qaInviteeApi } from '@/lib/api/qa-invitee';
import { draftStorageKey, parseDrafts } from '@/lib/qa/logic';
import type { QAInviteeSession } from '@/types/qa';

/** Signers and observers: the standing they sign or watch, and the report to print. */
function SignerView({ session, onReport }: { session: QAInviteeSession; onReport: () => void }) {
  const o = session.outcome;
  return (
    <div className="space-y-4">
      {session.role === 'signer' && (
        <Card>
          <CardContent className="space-y-3 pt-5 text-sm">
            <p className="font-medium">How to sign</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Read the outcome and the criteria below.</li>
              <li>Open the report, print it and sign it.</li>
              <li>Return the signed copy to the person who invited you.</li>
            </ol>
            {session.status === 'open' && <p className="text-muted-foreground">Testing is still going on, so the outcome can change until the session is closed.</p>}
            <Button onClick={onReport} className="h-11 w-full sm:w-auto">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Open the report to print
            </Button>
          </CardContent>
        </Card>
      )}
      {o ? <OutcomeSummary outcome={o} frozen={session.status !== 'open'} /> : <p className="text-sm text-muted-foreground">The outcome is not available yet.</p>}
      {o && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {o.criteria.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                {c.area_code && <span className="mr-2 font-mono text-xs text-muted-foreground">{c.area_code}</span>}
                {c.title}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <WeightBadge weight={c.weight} />
                <ResultBadge result={c.status} severity={c.severity} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {session.role === 'observer' && (
        <Button variant="outline" onClick={onReport}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Open the report
        </Button>
      )}
    </div>
  );
}

export default function InviteePage() {
  const params = useParams();
  const code = (params?.code as string) ?? '';
  // The saved sign-in lives in localStorage; render after mount so server and client agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const info = useQAAccessInfo(code);
  const session = useQAInviteeSession(code);
  const logout = useQAInviteeLogout(code);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });
  const [confirmLeave, setConfirmLeave] = useState(false);

  const data = session.data;
  const needsAccess = session.isError && [401, 403].includes(httpStatus(session.error) ?? 0);

  function unsentCount(): number {
    if (!data) return 0;
    try {
      return Object.keys(parseDrafts(localStorage.getItem(draftStorageKey(data.session_id, code)))).length;
    } catch {
      return 0;
    }
  }

  function report() {
    void openPreview(() => qaInviteeApi.report(code), { fileName: `acceptance-${data?.session_id ?? code}.pdf`, title: 'Acceptance report' });
  }

  let body: React.ReactNode;
  if (!mounted || (session.isLoading && info.isLoading)) {
    body = <Loading className="py-16" text="Loading..." />;
  } else if (info.isError && httpStatus(info.error) === 404) {
    body = (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-2 pt-6 text-center">
          <h1 className="text-lg font-semibold">This link is not open</h1>
          <p className="text-sm text-muted-foreground">The session has not been opened yet, or the link is wrong. Ask the person who invited you.</p>
        </CardContent>
      </Card>
    );
  } else if (data) {
    body = (
      <div className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold break-words sm:text-2xl">{data.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <SessionStatusBadge status={data.status} />
              <RoleBadge role={data.role} />
            </div>
          </div>
          <div className="flex gap-2">
            {data.role === 'tester' && (
              <Button variant="outline" onClick={report}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Report
              </Button>
            )}
            <Button variant="ghost" onClick={() => (unsentCount() ? setConfirmLeave(true) : logout.mutate())} disabled={logout.isPending}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>
        {data.role === 'tester' ? <InviteeChecklist code={code} session={data} /> : <SignerView session={data} onReport={report} />}
      </div>
    );
  } else if (needsAccess || info.isSuccess) {
    body = <InviteeAccess code={code} tenantSlug={info.data?.tenant_slug} />;
  } else {
    body = (
      <Card className="mx-auto max-w-md">
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-sm">The session could not be reached. Check your connection.</p>
          <Button variant="outline" onClick={() => void Promise.all([info.refetch(), session.refetch()])}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-accent/5">
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Acceptance testing</p>
        {body}
      </main>
      <QADialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Some verdicts are not sent yet"
        description="They are kept on this device and sent the next time you open the link here. Sign out anyway?"
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button
            onClick={() => {
              setConfirmLeave(false);
              logout.mutate();
            }}
          >
            Sign out
          </Button>
        </div>
      </QADialog>
      <PdfPreview {...previewProps} />
    </div>
  );
}
