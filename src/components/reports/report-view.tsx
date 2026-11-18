'use client';

import type { ReactNode } from 'react';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { EyeOff } from 'lucide-react';
import { RichTextView } from '@/components/common/rich-text';
import { StatTile } from '@/components/common/stat-tile';
import { RagChip } from '@/components/reports/rag';
import { dayOnly, indexText, percentText, ragOf } from '@/lib/reports/logic';
import type { PortalReport, Rag, ReportFinancials, ReportKpis, ReportMilestone, ReportRisk } from '@/types/reports';
import { cn } from '@/lib/utils';

/** What the reading view needs: the team's report and the portal's copy both fit. */
export type ReportViewData = Pick<
  PortalReport,
  'title' | 'period_start' | 'period_end' | 'rag_overall' | 'rag_schedule' | 'rag_scope' | 'narrative' | 'highlights' | 'risks' | 'milestones' | 'kpis' | 'financials'
> & { rag_cost?: Rag };

/** A date-only value shown on its own day in any time zone. */
export function dayText(s: string | null | undefined): string {
  const d = dayOnly(s);
  return d ? formatDate(`${d}T12:00:00Z`) : '';
}

export function periodText(start: string, end: string): string {
  return `${dayText(start)} to ${dayText(end)}`;
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-2" aria-label={title} data-testid={testId}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** The delivery figures as tiles. */
export function KpiTiles({ kpis }: { kpis: ReportKpis }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="report-kpis">
      <StatTile compact label="Complete" value={percentText(kpis.percent_complete)} hint={`Planned ${percentText(kpis.percent_planned)}`} />
      <StatTile compact label="Schedule index" value={indexText(kpis.schedule_index)} hint="Earned over planned work" />
      <StatTile compact label="Tasks done" value={`${kpis.tasks_done} of ${kpis.tasks_total}`} hint={`${kpis.tasks_completed_in_period} this period`} />
      <StatTile compact label="Overdue tasks" value={kpis.tasks_overdue} />
      <StatTile compact label="Milestones done" value={`${kpis.milestones_done} of ${kpis.milestones_total}`} hint={kpis.milestones_overdue ? `${kpis.milestones_overdue} overdue` : undefined} />
      <StatTile compact label="Open risks" value={kpis.open_risks} hint={kpis.high_risks ? `${kpis.high_risks} high` : undefined} />
      <StatTile compact label="Changes waiting" value={kpis.pending_change_requests} hint={kpis.pending_scope_changes ? `${kpis.pending_scope_changes} on scope` : undefined} />
    </dl>
  );
}

/** The money snapshot as tiles, with treasury's error when it was down. */
export function FinancialTiles({ f }: { f: ReportFinancials }) {
  const money = (n: number) => formatCurrency(n, f.currency || 'KES');
  return (
    <div className="space-y-2" data-testid="report-financials">
      {f.treasury_error && (
        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">Treasury could not be reached when this was filled, so the money figures may be incomplete.</p>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile compact label="Budget" value={money(f.bac)} />
        <StatTile compact label="Actual cost" value={money(f.ac)} hint={`${percentText(f.percent_spent)} spent`} />
        <StatTile compact label="Earned value" value={money(f.ev)} />
        <StatTile compact label="Forecast at completion" value={money(f.eac)} hint={`Variance ${money(f.vac)}`} />
        <StatTile compact label="Cost index" value={indexText(f.cpi)} />
        <StatTile compact label="Schedule index (money)" value={indexText(f.spi)} />
        <StatTile compact label="Committed" value={money(f.committed)} />
        <StatTile compact label="Margin" value={money(f.margin)} hint={percentText(f.margin_pct)} />
      </dl>
      {f.health_reason && <p className="text-xs text-muted-foreground">{f.health_reason}</p>}
    </div>
  );
}

export function MilestoneList({ items, onRemove }: { items: ReportMilestone[]; onRemove?: (index: number) => void }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="report-milestones">
      {items.map((m, i) => (
        <li key={`${m.milestone_id}-${i}`} className="flex items-start justify-between gap-3 p-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium wrap-break-word">{m.name}</p>
            <p className="text-xs text-muted-foreground">
              {m.target_date ? `Due ${formatDate(m.target_date)}` : 'No date'} · {m.status.replace(/_/g, ' ')}
              {m.overdue && <span className="ml-1 font-semibold text-destructive">Overdue</span>}
            </p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="h-10 shrink-0 rounded-md px-3 text-xs font-medium text-destructive hover:bg-destructive/10 sm:h-8"
              aria-label={`Leave out milestone ${m.name}`}
            >
              Leave out
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function RiskList({ items, onRemove }: { items: ReportRisk[]; onRemove?: (index: number) => void }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="report-risks">
      {items.map((r, i) => (
        <li key={`${r.risk_id ?? r.title}-${i}`} className="flex items-start justify-between gap-3 p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium wrap-break-word">
              <span className="mr-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums" title={`Likelihood ${r.likelihood} x impact ${r.impact}`}>
                {r.score}
              </span>
              {r.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.status.replace(/_/g, ' ')}
              {r.owner_name ? ` · ${r.owner_name}` : ''}
            </p>
            {r.mitigation && <p className="text-xs text-muted-foreground">Mitigation: {r.mitigation}</p>}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="h-10 shrink-0 rounded-md px-3 text-xs font-medium text-destructive hover:bg-destructive/10 sm:h-8"
              aria-label={`Leave out risk ${r.title}`}
            >
              Leave out
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A status report to read: the ratings, the narrative (rendered through the safe rich text view),
 * highlights, milestones, risks, key figures and, when present, the money. The team's preview and
 * the client portal use this same view, so the team sees what the client will see.
 */
export function ReportView({
  report,
  financialsHidden,
  hideEmptyCost,
  className,
}: {
  report: ReportViewData;
  financialsHidden?: boolean;
  /** The portal: an empty cost rating means the money was not shared, so it is left out. */
  hideEmptyCost?: boolean;
  className?: string;
}) {
  const highlights = report.highlights ?? [];
  const milestones = report.milestones ?? [];
  const risks = report.risks ?? [];
  const showCost = !(hideEmptyCost && !ragOf(report.rag_cost));
  return (
    <article className={cn('space-y-5', className)} data-testid="report-view">
      <header className="space-y-2">
        <h2 className="font-display text-lg font-semibold wrap-break-word">{report.title}</h2>
        <p className="text-sm text-muted-foreground">{periodText(report.period_start, report.period_end)}</p>
        <div className="flex flex-wrap gap-2" data-testid="report-ratings">
          <RagChip label="Overall" value={ragOf(report.rag_overall)} className="text-sm" />
          <RagChip label="Schedule" value={ragOf(report.rag_schedule)} />
          {showCost && <RagChip label="Cost" value={ragOf(report.rag_cost)} />}
          <RagChip label="Scope" value={ragOf(report.rag_scope)} />
        </div>
      </header>

      {report.narrative && (
        <Section title="Summary">
          <RichTextView value={report.narrative} />
        </Section>
      )}

      {highlights.length > 0 && (
        <Section title="Highlights" testId="report-highlights">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {highlights.map((h, i) => (
              <li key={`${i}-${h}`} className="wrap-break-word">
                {h}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.kpis && (
        <Section title="Key figures">
          <KpiTiles kpis={report.kpis} />
        </Section>
      )}

      {milestones.length > 0 && (
        <Section title="Milestones">
          <MilestoneList items={milestones} />
        </Section>
      )}

      {risks.length > 0 && (
        <Section title="Top risks">
          <RiskList items={risks} />
        </Section>
      )}

      {report.financials ? (
        <Section title="Financials">
          <FinancialTiles f={report.financials} />
        </Section>
      ) : (
        financialsHidden && <FinancialsHiddenNote />
      )}
    </article>
  );
}

export function FinancialsHiddenNote() {
  return (
    <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground" data-testid="financials-hidden">
      <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
      Financials are hidden for your role.
    </p>
  );
}
