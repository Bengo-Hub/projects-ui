import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { QAOutcome } from '@/types/qa';

/** The pass rule's standing: score, must criteria, blocking failures and the reasons it fails. */
export function OutcomeSummary({ outcome, frozen }: { outcome: QAOutcome; frozen?: boolean }) {
  const counts = outcome.counts ?? {};
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          {outcome.accepted ? (
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              The pass rule is met
            </p>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-red-700">
              <XCircle className="h-5 w-5" aria-hidden="true" />
              The pass rule is not met
            </p>
          )}
          <span className="text-xs text-muted-foreground">{frozen ? 'Frozen at close' : 'Live, from current verdicts'}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Weighted score</dt>
            <dd className="text-2xl font-bold">{outcome.score}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Must criteria passed</dt>
            <dd className="text-2xl font-bold">
              {outcome.must_passed} of {outcome.must_total}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Open blocking failures</dt>
            <dd className="text-2xl font-bold">{outcome.open_blocking}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pass, fail, blocked, not run</dt>
            <dd className="text-lg font-semibold">
              {counts.pass ?? 0}, {counts.fail ?? 0}, {counts.blocked ?? 0}, {counts.not_run ?? 0}
            </dd>
          </div>
        </dl>

        {!outcome.accepted && outcome.reasons?.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
            {outcome.reasons.map((r) => (
              <li key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
