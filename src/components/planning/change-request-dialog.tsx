'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useCreateChange } from '@/hooks/useChangeRequests';
import { useProjectFinancials } from '@/hooks/useFinancials';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useTasks } from '@/hooks/useTasks';
import { numOf } from '@/lib/api/financials';
import type { ChangeRequestInput } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import { KIND_LABEL, changeFormError, shiftText, shiftedDate, validAmount, type BudgetDraft, type ChangeDraft, type LineDraft } from '@/lib/planning/changes';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'capex', label: 'Capital' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'other', label: 'Other' },
];
const PERIOD_OPTIONS: ComboboxOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

function draftFor(project: Project | undefined): ChangeDraft {
  const year = String(new Date().getFullYear());
  return {
    title: '',
    kind: 'scope',
    shifts: [],
    budgetMode: 'new',
    budgetId: '',
    budget: {
      name: project ? `${project.name} budget` : 'Project budget',
      fiscal_year: year,
      period_type: 'monthly',
      start_date: project?.start_date?.slice(0, 10) ?? `${year}-01-01`,
      end_date: project?.end_date?.slice(0, 10) ?? `${year}-12-31`,
      currency: project?.currency || 'KES',
      lines: [{ category: 'expense', name: '', planned_amount: '' }],
    },
  };
}

function bodyOf(d: ChangeDraft, description: string): ChangeRequestInput {
  const body: ChangeRequestInput = { title: d.title.trim(), kind: d.kind };
  if (description.trim()) body.description = description.trim();
  if (d.kind === 'schedule') body.date_shifts = d.shifts.map((s) => ({ task_id: s.task_id, shift_days: s.shift_days }));
  if (d.kind === 'cost') {
    if (d.budgetMode === 'existing') body.budget_id = d.budgetId;
    else
      body.budget = {
        name: d.budget.name.trim(),
        fiscal_year: d.budget.fiscal_year.trim(),
        period_type: d.budget.period_type,
        start_date: d.budget.start_date,
        end_date: d.budget.end_date,
        currency: d.budget.currency.trim().toUpperCase(),
        lines: d.budget.lines.map((l) => ({ category: l.category, name: l.name.trim(), planned_amount: l.planned_amount.trim() })),
      };
  }
  return body;
}

function ShiftsEditor({ orgSlug, projectId, draft, onChange }: { orgSlug: string; projectId: string; draft: ChangeDraft; onChange: (d: ChangeDraft) => void }) {
  const tasks = useTasks(orgSlug, projectId);
  const byId = useMemo(() => new Map(tasks.tasks.map((t) => [t.id, t])), [tasks.tasks]);
  const optionsFor = (current: string): ComboboxOption[] =>
    tasks.tasks
      .filter((t) => t.id === current || !draft.shifts.some((s) => s.task_id === t.id))
      .map((t) => ({ value: t.id, label: t.title, hint: t.due_date ? `Due ${formatDate(t.due_date)}` : 'No due date' }));
  const setShift = (i: number, patch: Partial<ChangeDraft['shifts'][number]>) => onChange({ ...draft, shifts: draft.shifts.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Tasks to move</legend>
      <p className="text-xs text-muted-foreground">Each task&apos;s start and due dates move together. Moving a chain together keeps its links intact.</p>
      <ul className="space-y-2">
        {draft.shifts.map((s, i) => {
          const t = byId.get(s.task_id);
          return (
            <li key={i} className="space-y-1 rounded-md border border-border p-2" data-testid="date-shift">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SearchableCombobox
                    options={optionsFor(s.task_id)}
                    value={s.task_id}
                    onChange={(v) => setShift(i, { task_id: v ?? '' })}
                    placeholder="Pick a task"
                    searchPlaceholder="Find a task"
                    hasMore={!!tasks.hasNextPage}
                    onLoadMore={() => void tasks.fetchNextPage()}
                    loading={tasks.isLoading || tasks.isFetchingNextPage}
                    clearable={false}
                  />
                </div>
                <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9" onClick={() => onChange({ ...draft, shifts: draft.shifts.filter((_, n) => n !== i) })} aria-label="Remove this task">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Move by</span>
                  <input
                    type="number"
                    step={1}
                    className={`${inputClass} min-h-11 w-24 sm:min-h-9`}
                    value={Number.isFinite(s.shift_days) ? s.shift_days : ''}
                    onChange={(e) => setShift(i, { shift_days: e.target.value === '' ? NaN : Number(e.target.value) })}
                    aria-label={`Days to move ${t?.title ?? 'this task'}`}
                  />
                  <span className="text-muted-foreground">days</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {Number.isFinite(s.shift_days) ? shiftText(s.shift_days) : ''}
                  {t?.due_date && Number.isFinite(s.shift_days) && s.shift_days !== 0 ? `, due ${formatDate(shiftedDate(t.due_date, s.shift_days))} instead of ${formatDate(t.due_date)}` : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onChange({ ...draft, shifts: [...draft.shifts, { task_id: '', shift_days: 7 }] })}>
        <Plus className="h-4 w-4" aria-hidden />
        Add a task
      </Button>
    </fieldset>
  );
}

function BudgetEditor({ draft, onChange, existing }: { draft: ChangeDraft; onChange: (d: ChangeDraft) => void; existing: { id: string; status: string; total: string } | null }) {
  const b = draft.budget;
  const setB = (patch: Partial<BudgetDraft>) => onChange({ ...draft, budget: { ...b, ...patch } });
  const setLine = (i: number, patch: Partial<LineDraft>) => setB({ lines: b.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) });
  const total = b.lines.reduce((s, l) => s + (validAmount(l.planned_amount) ? Number(l.planned_amount) : 0), 0);
  const options: ComboboxOption[] = existing
    ? [{ value: existing.id, label: `The project's budget (${existing.status})`, hint: existing.total, description: 'Submitted for approval in treasury once this change is approved' }]
    : [];
  const mode = (m: ChangeDraft['budgetMode'], label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={draft.budgetMode === m}
      disabled={disabled}
      onClick={() => onChange({ ...draft, budgetMode: m, budgetId: m === 'existing' ? (existing?.id ?? '') : '' })}
      className={cn('h-10 flex-1 rounded-md px-3 text-sm font-medium disabled:opacity-50', draft.budgetMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Budget</legend>
      <div role="radiogroup" aria-label="Budget" className="flex gap-1 rounded-lg bg-muted p-1">
        {mode('new', 'New budget lines')}
        {mode('existing', "The project's budget", !existing)}
      </div>
      {!existing && <p className="text-xs text-muted-foreground">This project has no budget in treasury yet, so the change proposes a new one.</p>}
      {draft.budgetMode === 'existing' ? (
        <SearchableCombobox options={options} value={draft.budgetId} onChange={(v) => onChange({ ...draft, budgetId: v ?? '' })} placeholder="Pick the budget" searchPlaceholder="Budget" />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Budget name</span>
              <input className={`${inputClass} min-h-11 sm:min-h-9`} value={b.name} onChange={(e) => setB({ name: e.target.value })} aria-label="Budget name" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Fiscal year</span>
              <input className={`${inputClass} min-h-11 sm:min-h-9`} inputMode="numeric" value={b.fiscal_year} onChange={(e) => setB({ fiscal_year: e.target.value })} aria-label="Fiscal year" />
            </label>
            <div className="space-y-1 text-sm">
              <span className="block text-xs text-muted-foreground">Phased</span>
              <SearchableCombobox options={PERIOD_OPTIONS} value={b.period_type} onChange={(v) => v && setB({ period_type: v as BudgetDraft['period_type'] })} clearable={false} searchPlaceholder="Phasing" />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Starts</span>
              <input type="date" className={`${inputClass} min-h-11 sm:min-h-9`} value={b.start_date} onChange={(e) => setB({ start_date: e.target.value })} aria-label="Budget starts" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Ends</span>
              <input type="date" className={`${inputClass} min-h-11 sm:min-h-9`} value={b.end_date} onChange={(e) => setB({ end_date: e.target.value })} aria-label="Budget ends" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Currency</span>
              <input className={`${inputClass} min-h-11 uppercase sm:min-h-9`} maxLength={3} value={b.currency} onChange={(e) => setB({ currency: e.target.value.toUpperCase() })} aria-label="Currency" />
            </label>
          </div>
          <ul className="space-y-2">
            {b.lines.map((l, i) => (
              <li key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[8rem_minmax(0,1fr)_9rem_auto] sm:items-center" data-testid="budget-line">
                <SearchableCombobox options={CATEGORY_OPTIONS} value={l.category} onChange={(v) => v && setLine(i, { category: v as LineDraft['category'] })} clearable={false} searchPlaceholder="Category" />
                <input className={`${inputClass} min-h-11 sm:min-h-9`} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="What it is for" aria-label={`Line ${i + 1} name`} />
                <input className={`${inputClass} min-h-11 sm:min-h-9`} inputMode="decimal" value={l.planned_amount} onChange={(e) => setLine(i, { planned_amount: e.target.value })} placeholder="Amount" aria-label={`Line ${i + 1} amount`} />
                <Button type="button" variant="ghost" className="h-11 w-11 p-0 sm:h-9 sm:w-9" disabled={b.lines.length === 1} onClick={() => setB({ lines: b.lines.filter((_, n) => n !== i) })} aria-label={`Remove line ${i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setB({ lines: [...b.lines, { category: 'expense', name: '', planned_amount: '' }] })}>
              <Plus className="h-4 w-4" aria-hidden />
              Add a line
            </Button>
            <span className="text-sm">
              Total <span className="font-semibold tabular-nums">{formatCurrency(total, b.currency || 'KES')}</span>
            </span>
          </div>
        </div>
      )}
    </fieldset>
  );
}

/**
 * Raises a change request (US-16.4): a scope change in words, a schedule change that moves tasks, or
 * a cost change with new budget lines or the project's own treasury budget. It waits for someone
 * with change approvals to decide.
 */
export function ChangeRequestDialog({ orgSlug, project, onClose, onCreated }: { orgSlug: string; project: Project | undefined; onClose: () => void; onCreated?: (id: string) => void }) {
  const projectId = project?.id ?? '';
  const [draft, setDraft] = useState<ChangeDraft>(() => draftFor(project));
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState(false);
  const create = useCreateChange(orgSlug, projectId);
  const hasBudgetTracking = useFeature('budget_tracking');
  const { can } = useServicePermissions();
  const fin = useProjectFinancials(orgSlug, projectId, draft.kind === 'cost' && hasBudgetTracking && can(PERMS.financialsView));
  const money = fin.data?.money;
  const existing = money?.budget_id ? { id: money.budget_id, status: money.budget_status ?? 'draft', total: formatCurrency(numOf(money.budget_cost), money.currency || 'KES') } : null;
  const error = changeFormError(draft);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    create.mutate(bodyOf(draft, description), {
      onSuccess: (cr) => {
        onCreated?.(cr.id);
        onClose();
      },
    });
  }

  const kind = (k: ChangeDraft['kind']) => (
    <button
      type="button"
      role="radio"
      aria-checked={draft.kind === k}
      onClick={() => setDraft((d) => ({ ...d, kind: k }))}
      className={cn('h-10 flex-1 rounded-md px-3 text-sm font-medium', draft.kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
    >
      {KIND_LABEL[k]}
    </button>
  );

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Raise a change" description="Someone with change approvals decides it. Nothing moves until it is approved." className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={200} aria-label="Change title" placeholder="For example: add a second floor fit-out" />
        </label>
        <div className="space-y-1">
          <span className="block text-sm font-medium">Kind of change</span>
          <div role="radiogroup" aria-label="Kind of change" className="flex gap-1 rounded-lg bg-muted p-1">
            {kind('scope')}
            {kind('schedule')}
            {kind('cost')}
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Why</span>
          <textarea className={`${inputClass} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Why" placeholder="What changes, why, and what happens if it is not approved" />
        </label>
        {draft.kind === 'schedule' && <ShiftsEditor orgSlug={orgSlug} projectId={projectId} draft={draft} onChange={setDraft} />}
        {draft.kind === 'cost' && <BudgetEditor draft={draft} onChange={setDraft} existing={existing} />}
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={create.isPending}>
            {create.isPending ? 'Raising...' : 'Raise change'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
