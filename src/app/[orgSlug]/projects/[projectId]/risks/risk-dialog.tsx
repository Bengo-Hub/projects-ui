'use client';

import { useState } from 'react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useCreateRisk, useUpdateRisk } from '@/hooks/useRisks';
import type { Person } from '@/hooks/usePeople';
import type { Risk, RiskInput, RiskStatus } from '@/lib/api/planning';
import {
  IMPACT_LABEL,
  LIKELIHOOD_LABEL,
  RISK_STATUSES,
  RISK_STATUS_LABEL,
  SCORE_CLASS,
  SCORE_LABEL,
  riskFormError,
  riskPatch,
  riskScore,
  scoreBand,
} from '@/lib/planning/risks';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm disabled:opacity-70';
const STATUS_OPTIONS: ComboboxOption[] = RISK_STATUSES.map((s) => ({ value: s, label: RISK_STATUS_LABEL[s] }));

interface Form {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  owner_id: string;
  mitigation: string;
  status: RiskStatus;
  due_date: string;
}

function formOf(r: Risk | null): Form {
  return {
    title: r?.title ?? '',
    description: r?.description ?? '',
    category: r?.category ?? '',
    likelihood: r?.likelihood ?? 3,
    impact: r?.impact ?? 3,
    owner_id: r?.owner_id ?? '',
    mitigation: r?.mitigation ?? '',
    status: r?.status ?? 'open',
    due_date: r?.due_date ? r.due_date.slice(0, 10) : '',
  };
}

function Scale({ label, names, value, onChange, disabled }: { label: string; names: string[]; value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
        {names.map((name, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${label} ${n}, ${name}`}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-md border px-1 text-sm font-semibold disabled:opacity-70',
                value === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent',
              )}
            >
              {n}
              <span className="hidden text-[10px] font-normal sm:block">{name}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground sm:hidden">{names[value - 1]}</p>
    </fieldset>
  );
}

/**
 * Raises or edits a risk. Mount it with a key per risk so each opening starts from that risk. With
 * readOnly (no projects.risks.change) it shows the risk without a save.
 */
export function RiskDialog({
  orgSlug,
  projectId,
  risk,
  people,
  readOnly,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  risk: Risk | null;
  people: Person[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const [initial] = useState(() => formOf(risk));
  const [f, setF] = useState<Form>(initial);
  const [tried, setTried] = useState(false);
  const create = useCreateRisk(orgSlug, projectId);
  const update = useUpdateRisk(orgSlug, projectId);
  const pending = create.isPending || update.isPending;
  const error = riskFormError(f);
  const score = riskScore(f.likelihood, f.impact);
  const band = scoreBand(score);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const ownerOptions: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name, hint: p.email }));
  const ownerKnown = !f.owner_id || people.some((p) => p.userId === f.owner_id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (readOnly || error) return;
    const clean: Form = { ...f, title: f.title.trim(), description: f.description.trim(), category: f.category.trim(), mitigation: f.mitigation.trim() };
    if (!risk) {
      const body: RiskInput = { title: clean.title, likelihood: clean.likelihood, impact: clean.impact, status: clean.status };
      if (clean.description) body.description = clean.description;
      if (clean.category) body.category = clean.category;
      if (clean.owner_id) body.owner_id = clean.owner_id;
      if (clean.mitigation) body.mitigation = clean.mitigation;
      if (clean.due_date) body.due_date = clean.due_date;
      create.mutate(body, { onSuccess: onClose });
      return;
    }
    const patch = riskPatch(initial as unknown as Record<string, unknown>, clean as unknown as Record<string, unknown>) as unknown as RiskInput;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: risk.id, body: patch }, { onSuccess: onClose });
  }

  const title = readOnly ? (risk?.title ?? 'Risk') : risk ? 'Edit risk' : 'New risk';
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={title} className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={f.title} onChange={(e) => set('title', e.target.value)} disabled={readOnly} aria-label="Risk title" placeholder="For example: steel delivery runs late" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Scale label="Likelihood" names={LIKELIHOOD_LABEL} value={f.likelihood} onChange={(n) => set('likelihood', n)} disabled={readOnly} />
          <Scale label="Impact" names={IMPACT_LABEL} value={f.impact} onChange={(n) => set('impact', n)} disabled={readOnly} />
        </div>
        <p className="text-sm">
          Score <span className={cn('ml-1 rounded-full px-2 py-0.5 text-xs font-semibold', SCORE_CLASS[band])} data-testid="risk-score-preview">{score}, {SCORE_LABEL[band]}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <span className="block font-medium">Owner</span>
            <SearchableCombobox
              options={ownerOptions}
              value={f.owner_id}
              valueLabel={!ownerKnown ? (risk?.owner_name || 'Former member') : undefined}
              onChange={(v) => set('owner_id', v ?? '')}
              placeholder="No owner"
              searchPlaceholder="Find a project member"
              emptyText="Only the project team can own a risk"
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1 text-sm">
            <span className="block font-medium">Status</span>
            <SearchableCombobox options={STATUS_OPTIONS} value={f.status} onChange={(v) => v && set('status', v as RiskStatus)} clearable={false} searchPlaceholder="Status" disabled={readOnly} />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Category</span>
            <input className={`${inputClass} min-h-11 sm:min-h-9`} value={f.category} onChange={(e) => set('category', e.target.value)} disabled={readOnly} aria-label="Category" placeholder="For example: supply" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Review by</span>
            <input type="date" className={`${inputClass} min-h-11 sm:min-h-9`} value={f.due_date} onChange={(e) => set('due_date', e.target.value)} disabled={readOnly} aria-label="Review by" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea className={`${inputClass} min-h-20`} value={f.description} onChange={(e) => set('description', e.target.value)} disabled={readOnly} aria-label="Description" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Mitigation</span>
          <textarea className={`${inputClass} min-h-20`} value={f.mitigation} onChange={(e) => set('mitigation', e.target.value)} disabled={readOnly} aria-label="Mitigation" placeholder="What we do to make it less likely or less harmful" />
        </label>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={pending}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button type="submit" className="h-11 sm:h-9" disabled={pending}>
              {pending ? 'Saving...' : risk ? 'Save risk' : 'Add risk'}
            </Button>
          )}
        </div>
      </form>
    </QADialog>
  );
}
