'use client';

import { RAG_VALUES, RAG_LABEL, ragClass, ragLabel, ragOf } from '@/lib/reports/logic';
import type { Rag } from '@/types/reports';
import { cn } from '@/lib/utils';

/** A rating as a coloured chip that also says the rating in words. */
export function RagChip({ value, label, className }: { value: string | null | undefined; label?: string; className?: string }) {
  const text = ragLabel(value);
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', ragClass(value), className)}
      data-testid="rag-chip"
      aria-label={label ? `${label}: ${text}` : text}
    >
      {label && <span className="font-normal">{label}</span>}
      {text}
    </span>
  );
}

/**
 * One rating of a draft: green, amber, red or not rated, with the auto-fill's suggestion and its
 * reason underneath, and a button to take the suggestion when the rating differs from it.
 */
export function RagPicker({
  label,
  value,
  onChange,
  suggestion,
  reason,
  disabled,
}: {
  label: string;
  value: Rag;
  onChange: (v: Rag) => void;
  suggestion?: string | null;
  reason?: string;
  disabled?: boolean;
}) {
  const suggested = ragOf(suggestion);
  const options: { v: Rag; text: string }[] = [...RAG_VALUES.map((v) => ({ v: v as Rag, text: RAG_LABEL[v] })), { v: '', text: 'Not rated' }];
  return (
    <fieldset className="space-y-1.5 rounded-lg border border-border p-3" data-testid={`rag-picker-${label.toLowerCase()}`}>
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={`${label} rating`} className="grid grid-cols-4 gap-1">
        {options.map(({ v, text }) => (
          <button
            key={v || 'none'}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`${label} ${text}`}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'min-h-11 rounded-md border px-1 text-xs font-semibold disabled:opacity-70 sm:min-h-9',
              value === v ? cn(ragClass(v), 'border-transparent ring-2 ring-primary') : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {suggestion !== undefined && suggestion !== null && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" data-testid="rag-suggestion">
          <span>
            Suggested: <span className="font-medium text-foreground">{ragLabel(suggested)}</span>
            {reason ? `, ${reason}` : ''}
          </span>
          {!disabled && value !== suggested && (
            <button type="button" className="min-h-8 text-primary underline-offset-2 hover:underline" onClick={() => onChange(suggested)}>
              Use the suggestion
            </button>
          )}
        </p>
      )}
    </fieldset>
  );
}
