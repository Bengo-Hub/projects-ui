'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects';
import { useMilestones } from '@/hooks/useMilestones';
import { useTasks } from '@/hooks/useTasks';
import { SUBJECT_LABELS, toCriterionInput, WEIGHT_LABELS } from '@/lib/qa/logic';
import { Field, inputClass } from './fields';
import { FeaturePicker } from './feature-picker';
import { QADialog } from './qa-dialog';
import type { QACriterion, QACriterionInput, QACriterionSubject, QAWeight } from '@/types/qa';

interface CriterionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  serviceTag?: string;
  /** A platform template checks features or free criteria only. */
  platform: boolean;
  initial?: QACriterion | null;
  pending: boolean;
  onSubmit: (input: QACriterionInput) => void;
}

const EMPTY: QACriterionInput = { subject_kind: 'none', subject_ref: '', title: '', weight: 'must' };

function fromCriterion(c?: QACriterion | null): QACriterionInput {
  if (!c) return { ...EMPTY };
  return {
    subject_kind: c.subject_kind ?? 'none',
    subject_ref: c.subject_ref ?? '',
    area_code: c.area_code ?? '',
    title: c.title,
    requirement_ref: c.requirement_ref ?? '',
    preconditions: c.preconditions ?? '',
    steps: c.steps ?? '',
    expected_result: c.expected_result ?? '',
    weight: c.weight ?? 'must',
    automated_ref: c.automated_ref ?? '',
    sort_order: c.sort_order,
  };
}

/** Picks a milestone or a task: first the project, then the item in it. */
function WorkItemPicker({
  orgSlug,
  kind,
  value,
  onChange,
  error,
}: {
  orgSlug: string;
  kind: 'milestone' | 'task';
  value: string;
  onChange: (id: string) => void;
  error?: string | null;
}) {
  const [projectId, setProjectId] = useState('');
  const projects = useProjects(orgSlug, { limit: 100 });
  const milestones = useMilestones(orgSlug, kind === 'milestone' ? projectId : '');
  const tasks = useTasks(orgSlug, kind === 'task' ? projectId : '', { limit: 200 });
  const items =
    kind === 'milestone'
      ? (milestones.data?.data ?? []).map((m) => ({ id: m.id, label: m.name }))
      : (tasks.data?.data ?? []).map((t) => ({ id: t.id, label: t.wbs_code ? `${t.wbs_code} ${t.title}` : t.title }));
  const loadingItems = kind === 'milestone' ? milestones.isLoading : tasks.isLoading;

  return (
    <div className="space-y-3">
      <Field label="Project">
        {({ id }) => (
          <select id={id} className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{projects.isLoading ? 'Loading projects...' : 'Choose a project'}</option>
            {(projects.data?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={kind === 'milestone' ? 'Milestone' : 'Task'} required error={error}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            className={inputClass}
            value={value}
            disabled={!projectId && !value}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{!projectId ? 'Choose a project first' : loadingItems ? 'Loading...' : `Choose a ${kind}`}</option>
            {value && !items.some((i) => i.id === value) && <option value={value}>Current {kind} ({value.slice(0, 8)})</option>}
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}

/** Adds or edits one criterion of a template. */
export function CriterionDialog({ open, onOpenChange, orgSlug, serviceTag, platform, initial, pending, onSubmit }: CriterionDialogProps) {
  const [form, setForm] = useState<QACriterionInput>(() => fromCriterion(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(fromCriterion(initial));
      setError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof QACriterionInput>(k: K, v: QACriterionInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { value, error: problem } = toCriterionInput(form as unknown as Record<string, unknown>, 1, platform);
    if (!value) {
      setError((problem ?? 'Check the criterion.').replace(/^Row 1: /, ''));
      return;
    }
    onSubmit({ ...value, sort_order: form.sort_order });
  }

  const subjects: QACriterionSubject[] = ['feature', 'milestone', 'task', 'none'];
  const refError = error && /feature|milestone|task/i.test(error) ? error : null;

  return (
    <QADialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit criterion' : 'Add criterion'}
      description="What is checked, how to check it and how much it counts."
      className="sm:max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" required error={error && !refError ? error : null}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className={inputClass}
              value={form.title}
              maxLength={300}
              required
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => set('title', e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Area code" hint="Groups the report, for example OWN">
            {({ id, describedBy }) => (
              <input id={id} className={inputClass} value={form.area_code ?? ''} maxLength={32} aria-describedby={describedBy} onChange={(e) => set('area_code', e.target.value)} />
            )}
          </Field>
          <Field label="Weight">
            {({ id }) => (
              <select id={id} className={inputClass} value={form.weight} onChange={(e) => set('weight', e.target.value as QAWeight)}>
                {(Object.keys(WEIGHT_LABELS) as QAWeight[]).map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_LABELS[w]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Requirement ref" hint="For example FR-12">
            {({ id, describedBy }) => (
              <input id={id} className={inputClass} value={form.requirement_ref ?? ''} maxLength={100} aria-describedby={describedBy} onChange={(e) => set('requirement_ref', e.target.value)} />
            )}
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">What it checks</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {subjects.map((s) => {
              const off = platform && (s === 'milestone' || s === 'task');
              return (
                <label key={s} className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="subject_kind"
                    value={s}
                    checked={form.subject_kind === s}
                    disabled={off}
                    onChange={() => setForm((f) => ({ ...f, subject_kind: s, subject_ref: '' }))}
                    className="h-4 w-4"
                  />
                  <span className={off ? 'text-muted-foreground' : undefined}>{SUBJECT_LABELS[s]}</span>
                </label>
              );
            })}
          </div>
          {platform && <p className="text-xs text-muted-foreground">A platform template checks features or free criteria only.</p>}
          {form.subject_kind === 'feature' && (
            <FeaturePicker orgSlug={orgSlug} serviceTag={serviceTag} value={form.subject_ref ?? ''} onChange={(v) => set('subject_ref', v)} error={refError} />
          )}
          {(form.subject_kind === 'milestone' || form.subject_kind === 'task') && (
            <WorkItemPicker orgSlug={orgSlug} kind={form.subject_kind} value={form.subject_ref ?? ''} onChange={(v) => set('subject_ref', v)} error={refError} />
          )}
        </fieldset>

        <Field label="Preconditions">
          {({ id }) => <textarea id={id} rows={2} className={inputClass} value={form.preconditions ?? ''} onChange={(e) => set('preconditions', e.target.value)} />}
        </Field>
        <Field label="Steps">
          {({ id }) => <textarea id={id} rows={3} className={inputClass} value={form.steps ?? ''} onChange={(e) => set('steps', e.target.value)} />}
        </Field>
        <Field label="Expected result">
          {({ id }) => <textarea id={id} rows={2} className={inputClass} value={form.expected_result ?? ''} onChange={(e) => set('expected_result', e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Automated test" hint="The test that covers it, when one exists">
            {({ id, describedBy }) => (
              <input id={id} className={inputClass} value={form.automated_ref ?? ''} maxLength={300} aria-describedby={describedBy} onChange={(e) => set('automated_ref', e.target.value)} />
            )}
          </Field>
          <Field label="Order" hint="Lower numbers come first">
            {({ id, describedBy }) => (
              <input
                id={id}
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={form.sort_order ?? ''}
                aria-describedby={describedBy}
                onChange={(e) => set('sort_order', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : initial ? 'Save criterion' : 'Add criterion'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
