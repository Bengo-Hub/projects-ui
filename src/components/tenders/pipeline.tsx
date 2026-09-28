import type { TenderMetrics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCompact } from '@/lib/utils';

/** Open stages in the order a tender moves through them. */
const OPEN_STAGES = [
  { status: 'draft', label: 'Draft', bar: 'bg-slate-400' },
  { status: 'evaluating', label: 'Evaluating', bar: 'bg-purple-500' },
  { status: 'submitted', label: 'Submitted', bar: 'bg-blue-500' },
] as const;

const CLOSED_STAGES = [
  { status: 'awarded', label: 'Awarded', bar: 'bg-green-500' },
  { status: 'lost', label: 'Lost', bar: 'bg-red-400' },
  { status: 'cancelled', label: 'Cancelled', bar: 'bg-slate-300' },
] as const;

type Stage = { status: string; label: string; bar: string };

/**
 * TenderPipeline shows each stage's count and estimated value as bars scaled to the largest
 * stage value, plus the open pipeline value and the win rate (awarded of awarded + lost).
 */
export function TenderPipeline({
  metrics,
  activeStatus,
  onSelect,
}: {
  metrics: TenderMetrics;
  activeStatus?: string;
  onSelect?: (status: string) => void;
}) {
  const by = metrics.by_status ?? {};
  const all: Stage[] = [...OPEN_STAGES, ...CLOSED_STAGES];
  const maxValue = Math.max(1, ...all.map((s) => by[s.status]?.value ?? 0));
  const decided = (by.awarded?.count ?? 0) + (by.lost?.count ?? 0);

  function StageRow({ s }: { s: Stage }) {
    const m = by[s.status] ?? { count: 0, value: 0 };
    const active = activeStatus === s.status;
    return (
      <button
        type="button"
        onClick={() => onSelect?.(s.status)}
        className={`grid w-full grid-cols-[6.5rem_1fr_auto] items-center gap-3 rounded px-1 py-1 text-left text-sm hover:bg-accent/50 ${
          active ? 'bg-accent' : ''
        }`}
        title={`Show ${s.label.toLowerCase()} tenders`}
      >
        <span className="flex items-center justify-between gap-2">
          <span>{s.label}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{m.count}</span>
        </span>
        <span className="h-2 rounded-full bg-muted">
          <span
            className={`block h-2 rounded-full ${s.bar}`}
            style={{ width: `${m.value > 0 ? Math.max(2, (m.value / maxValue) * 100) : 0}%` }}
          />
        </span>
        <span className="w-20 text-right text-xs tabular-nums">{m.value ? formatCompact(m.value) : '—'}</span>
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[1fr_12rem]">
        <div className="space-y-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Open</p>
            {OPEN_STAGES.map((s) => (
              <StageRow key={s.status} s={s} />
            ))}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Closed</p>
            {CLOSED_STAGES.map((s) => (
              <StageRow key={s.status} s={s} />
            ))}
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Open pipeline value</dt>
            <dd className="text-lg font-bold">{formatCompact(metrics.pipeline_value ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Won value</dt>
            <dd className="text-lg font-bold text-green-700">{formatCompact(metrics.awarded_value ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Win rate</dt>
            <dd className="text-lg font-bold">{decided > 0 ? `${(metrics.win_rate ?? 0).toFixed(0)}%` : '—'}</dd>
            <dd className="text-xs text-muted-foreground">
              {decided > 0 ? `${by.awarded?.count ?? 0} won of ${decided} decided` : 'No decided tenders yet'}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
