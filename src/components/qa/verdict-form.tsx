'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { RESULT_LABELS, RESULT_ORDER, SEVERITY_LABELS, verdictProblem } from '@/lib/qa/logic';
import { inputClass } from './fields';
import type { QAResultValue, QAVerdictInput } from '@/types/qa';

const TONE: Record<QAResultValue, string> = {
  pass: 'peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-900',
  fail: 'peer-checked:border-red-600 peer-checked:bg-red-50 peer-checked:text-red-900',
  blocked: 'peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-950',
  not_run: 'peer-checked:border-slate-600 peer-checked:bg-slate-100 peer-checked:text-slate-900',
};

interface VerdictFormProps {
  /** Short name of the criterion, for the group's accessible name. */
  label: string;
  value: QAVerdictInput | undefined;
  onChange: (next: QAVerdictInput) => void;
  disabled?: boolean;
}

/**
 * One verdict: pass, fail, blocked or skip, a severity on a failure, and notes. Native radios keep
 * arrow-key movement and screen reader support; used by the invitee checklist and by team members
 * recording their own verdict on the session board.
 */
export function VerdictForm({ label, value, onChange, disabled }: VerdictFormProps) {
  const id = useId();
  const v: QAVerdictInput = value ?? { result: 'not_run', severity: null, notes: '' };
  const chosen = !!value;
  const problem = chosen ? verdictProblem(v) : null;

  return (
    <div className="space-y-3">
      <fieldset disabled={disabled}>
        <legend className="sr-only">Verdict for {label}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RESULT_ORDER.map((r) => (
            <label key={r} className="relative block">
              <input
                type="radio"
                name={`${id}-result`}
                value={r}
                checked={chosen && v.result === r}
                onChange={() => onChange({ ...v, result: r, severity: r === 'fail' ? v.severity ?? null : null })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
                  TONE[r],
                )}
              >
                {RESULT_LABELS[r]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {chosen && v.result === 'fail' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-sev`} className="block text-sm font-medium">
            Severity
          </label>
          <select
            id={`${id}-sev`}
            className={inputClass}
            value={v.severity ?? ''}
            disabled={disabled}
            aria-invalid={v.severity == null}
            aria-describedby={problem ? `${id}-problem` : undefined}
            onChange={(e) => onChange({ ...v, severity: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Choose a severity</option>
            {[1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Severity 1 and 2 open a ticket for the team straight away.</p>
        </div>
      )}

      {chosen && (
        <div className="space-y-1">
          <label htmlFor={`${id}-notes`} className="block text-sm font-medium">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id={`${id}-notes`}
            className={inputClass}
            rows={2}
            maxLength={5000}
            value={v.notes ?? ''}
            disabled={disabled}
            placeholder={v.result === 'fail' ? 'What happened, and the steps to see it again' : 'Anything worth noting'}
            onChange={(e) => onChange({ ...v, notes: e.target.value })}
          />
        </div>
      )}

      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
