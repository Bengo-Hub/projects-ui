'use client';

import { useState } from 'react';
import { Repeat } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { useUpdateTask } from '@/hooks/useTasks';
import {
  metadataWithRepeat,
  modeOf,
  readRepeat,
  repeatError,
  repeatText,
  ruleFrom,
  sameRule,
  type RepeatFreq,
  type RepeatMode,
  type RepeatRule,
} from '@/lib/planning/repeat';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

const MODE_OPTIONS: ComboboxOption[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'interval', label: 'Every few days, weeks or months' },
];
const FREQ_OPTIONS: ComboboxOption[] = [
  { value: 'daily', label: 'days' },
  { value: 'weekly', label: 'weeks' },
  { value: 'monthly', label: 'months' },
];
const fieldClass = 'h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 sm:h-9 sm:text-sm';

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A small repeat marker for board cards and list rows. */
export function RepeatIcon({ metadata, className }: { metadata?: Record<string, unknown>; className?: string }) {
  const rule = readRepeat(metadata);
  if (!rule) return null;
  const text = repeatText(rule);
  return (
    <span className={cn('inline-flex text-muted-foreground', className)} title={text} aria-label={text} role="img" data-testid="repeat-icon">
      <Repeat className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function Editor({ orgSlug, projectId, task, rule }: { orgSlug: string; projectId: string; task: Task; rule: RepeatRule | null }) {
  const update = useUpdateTask(orgSlug, projectId);
  const [mode, setMode] = useState<RepeatMode>(modeOf(rule));
  const [freq, setFreq] = useState<RepeatFreq>(rule?.freq ?? 'weekly');
  const [every, setEvery] = useState(String(rule?.interval ?? 2));
  const [until, setUntil] = useState(rule?.until ?? '');
  const n = Number(every);
  const draft = ruleFrom(mode, freq, Number.isFinite(n) ? n : NaN, until);
  const error = repeatError(draft, today());
  const changed = !sameRule(draft, rule);

  return (
    <div className="space-y-2">
      <SearchableCombobox options={MODE_OPTIONS} value={mode} onChange={(v) => v && setMode(v as RepeatMode)} clearable={false} searchPlaceholder="Repeat" />
      {mode === 'interval' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <input
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            className={cn(fieldClass, 'w-20')}
            value={every}
            onChange={(e) => setEvery(e.target.value)}
            aria-label="Repeat every"
          />
          <div className="min-w-0 flex-1">
            <SearchableCombobox options={FREQ_OPTIONS} value={freq} onChange={(v) => v && setFreq(v as RepeatFreq)} clearable={false} searchPlaceholder="Unit" />
          </div>
        </div>
      )}
      {mode !== 'none' && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Until (optional)</span>
          <input type="date" className={fieldClass} value={until} min={today()} onChange={(e) => setUntil(e.target.value)} aria-label="Repeat until" />
        </label>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {changed && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{repeatText(draft)}</span>
          <Button
            size="sm"
            className="h-11 sm:h-8"
            disabled={!!error || update.isPending}
            onClick={() => update.mutate({ id: task.id, data: { metadata: metadataWithRepeat(task.metadata, draft) } })}
          >
            {update.isPending ? 'Saving...' : 'Save repeat'}
          </Button>
        </div>
      )}
      {mode !== 'none' && !task.due_date && <p className="text-xs text-muted-foreground">Without a due date the next copy comes once this task is done.</p>}
    </div>
  );
}

/**
 * The Repeat control in the task drawer (US-16.6): none, daily, weekly, monthly or every few days,
 * weeks or months, until a date. It writes metadata.repeat through the normal task update; the
 * API makes the next copy once the task is done or its due date passes.
 */
export function RepeatControl({ orgSlug, projectId, task, editable }: { orgSlug: string; projectId: string; task: Task; editable: boolean }) {
  const rule = readRepeat(task.metadata);
  const occurrence = Number((task.metadata?.recurrence as { occurrence?: number } | undefined)?.occurrence ?? 0);
  return (
    <section aria-labelledby="repeat-heading" className="space-y-2" data-testid="repeat-control">
      <h3 id="repeat-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden />
        Repeat
      </h3>
      <p className="text-sm" data-testid="repeat-text">
        {repeatText(rule)}
        {occurrence > 1 && <span className="text-muted-foreground">. This is copy {occurrence}.</span>}
      </p>
      {/* Keyed on the saved rule, so a save or a live update starts the editor afresh. */}
      {editable && <Editor key={`${task.id}-${JSON.stringify(rule)}`} orgSlug={orgSlug} projectId={projectId} task={task} rule={rule} />}
    </section>
  );
}
