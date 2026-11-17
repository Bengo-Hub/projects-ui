import { clampPercent } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';

/** Done tasks over all tasks, as the API counts it. Empty until the summary loads. */
export function PortalProgress({ value, className }: { value: number | null | undefined; className?: string }) {
  const pct = clampPercent(value);
  const known = value != null;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium tabular-nums">{known ? `${pct}%` : ''}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? pct : undefined}
      >
        <div className="h-2 rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
