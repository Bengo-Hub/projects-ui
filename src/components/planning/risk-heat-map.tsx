'use client';

import { heatRows, IMPACT_LABEL, LIKELIHOOD_LABEL, SCORE_CLASS, type CellFilter } from '@/lib/planning/risks';
import { cn } from '@/lib/utils';

/**
 * The 5x5 risk heat map (US-16.3): likelihood rows from almost certain at the top, impact columns
 * from minor on the left, each cell the number of risks there. A cell is a button that filters the
 * register; pressing it again clears the filter.
 */
export function RiskHeatMap({
  grid,
  selected,
  onSelect,
}: {
  grid: number[][] | undefined;
  selected: CellFilter | null;
  onSelect: (cell: CellFilter) => void;
}) {
  const rows = heatRows(grid);
  return (
    <div className="space-y-2" data-testid="risk-heatmap">
      <div className="flex gap-2">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-xs text-muted-foreground">Likelihood</span>
        </div>
        <div className="min-w-0 flex-1">
          <div role="grid" aria-label="Risks by likelihood and impact" className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
            {rows.map((row) => (
              <div role="row" key={row[0].likelihood} className="contents">
                <div role="rowheader" className="flex items-center pr-1 text-[10px] leading-tight text-muted-foreground sm:text-xs" title={LIKELIHOOD_LABEL[row[0].likelihood - 1]}>
                  {row[0].likelihood}
                  <span className="ml-1 hidden md:inline">{LIKELIHOOD_LABEL[row[0].likelihood - 1]}</span>
                </div>
                {row.map((c) => {
                  const on = selected?.likelihood === c.likelihood && selected?.impact === c.impact;
                  return (
                    <div role="gridcell" key={c.impact}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`Likelihood ${c.likelihood}, impact ${c.impact}: ${c.count} ${c.count === 1 ? 'risk' : 'risks'}`}
                        onClick={() => onSelect({ likelihood: c.likelihood, impact: c.impact })}
                        className={cn(
                          'flex h-11 w-full items-center justify-center rounded text-sm font-semibold tabular-nums transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          SCORE_CLASS[c.band],
                          c.count === 0 && 'opacity-50',
                          on && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                        )}
                        data-testid={`heat-${c.likelihood}-${c.impact}`}
                      >
                        {c.count > 0 ? c.count : ''}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            <div aria-hidden />
            {IMPACT_LABEL.map((label, i) => (
              <div key={label} className="text-center text-[10px] leading-tight text-muted-foreground sm:text-xs" title={label}>
                {i + 1}
                <span className="hidden md:block">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">Impact</p>
        </div>
      </div>
    </div>
  );
}
