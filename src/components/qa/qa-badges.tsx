import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RESULT_LABELS, ROLE_LABELS, SEVERITY_LABELS, WEIGHT_LABELS } from '@/lib/qa/logic';
import type { QADefectStatus, QAInviteStatus, QAResultValue, QARole, QASessionStatus, QAWeight } from '@/types/qa';

// Every badge carries its meaning in text; colour only repeats it.

const SESSION: Record<QASessionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const RESULT: Record<QAResultValue, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  blocked: 'bg-amber-100 text-amber-900',
  not_run: 'bg-slate-100 text-slate-700',
};

const DEFECT: Record<QADefectStatus, { cls: string; label: string }> = {
  open: { cls: 'bg-amber-100 text-amber-900', label: 'No ticket yet' },
  ticketed: { cls: 'bg-green-100 text-green-800', label: 'Ticket open' },
  ticket_failed: { cls: 'bg-red-100 text-red-800', label: 'Ticket failed' },
};

const INVITE: Record<QAInviteStatus, string> = {
  invited: 'bg-slate-100 text-slate-700',
  active: 'bg-green-100 text-green-800',
  revoked: 'bg-red-100 text-red-800',
};

export function SessionStatusBadge({ status }: { status?: QASessionStatus }) {
  const s = status ?? 'draft';
  return <Badge className={cn('capitalize', SESSION[s])}>{s}</Badge>;
}

export function ResultBadge({ result, severity }: { result: QAResultValue; severity?: number | null }) {
  const label = result === 'not_run' ? 'Not run' : RESULT_LABELS[result];
  return (
    <Badge className={RESULT[result]}>
      {label}
      {result === 'fail' && severity ? `, S${severity}` : ''}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: number }) {
  const cls = severity <= 2 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900';
  return <Badge className={cls}>{SEVERITY_LABELS[severity] ?? `S${severity}`}</Badge>;
}

export function WeightBadge({ weight }: { weight?: QAWeight }) {
  const w = weight ?? 'must';
  const cls = w === 'must' ? 'bg-slate-800 text-white' : w === 'should' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600';
  return <Badge className={cls}>{WEIGHT_LABELS[w]}</Badge>;
}

export function DefectStatusBadge({ status }: { status?: QADefectStatus }) {
  const d = DEFECT[status ?? 'open'];
  return <Badge className={d.cls}>{d.label}</Badge>;
}

export function RoleBadge({ role }: { role?: QARole }) {
  return <Badge className="bg-indigo-50 text-indigo-800">{ROLE_LABELS[role ?? 'tester']}</Badge>;
}

export function InviteStatusBadge({ status }: { status?: QAInviteStatus }) {
  const s = status ?? 'invited';
  return <Badge className={cn('capitalize', INVITE[s])}>{s}</Badge>;
}
