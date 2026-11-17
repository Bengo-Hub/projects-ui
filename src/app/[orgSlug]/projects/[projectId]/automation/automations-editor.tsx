'use client';

import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { MultiSelectCombobox, SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSaveAutomations } from '@/hooks/useAutomation';
import type { Person } from '@/hooks/usePeople';
import {
  AUTOMATION_PRIORITIES,
  MAX_ACTIONS,
  MAX_AUTOMATIONS,
  automationSummary,
  automationsBody,
  automationsError,
  blankAction,
  newAutomation,
  type ActionType,
  type AutomationAction,
  type AutomationRule,
} from '@/lib/planning/rules';
import type { ProjectStatus } from '@/types';

const inputClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm';
const ACTION_OPTIONS: ComboboxOption[] = [
  { value: 'assign', label: 'Assign people' },
  { value: 'notify', label: 'Notify people' },
  { value: 'set_field', label: 'Set a field' },
];
const MODE_OPTIONS: ComboboxOption[] = [
  { value: 'add', label: 'Add to the assignees' },
  { value: 'replace', label: 'Replace the assignees' },
];
const PRIORITY_OPTIONS: ComboboxOption[] = AUTOMATION_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));

function ActionEditor({
  action,
  index,
  people,
  onChange,
  onRemove,
  canRemove,
}: {
  action: AutomationAction;
  index: number;
  people: ComboboxOption[];
  onChange: (a: AutomationAction) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const custom = action.type === 'set_field' && action.field !== 'priority';
  return (
    <li className="space-y-2 rounded-md border border-border p-2" data-testid="automation-action">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchableCombobox options={ACTION_OPTIONS} value={action.type} onChange={(v) => v && v !== action.type && onChange(blankAction(v as ActionType))} clearable={false} searchPlaceholder="Action" />
        </div>
        <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9" disabled={!canRemove} onClick={onRemove} aria-label={`Remove action ${index + 1}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {action.type === 'assign' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <MultiSelectCombobox options={people} values={action.user_ids ?? []} onChange={(ids) => onChange({ ...action, user_ids: ids })} placeholder="Pick people" searchPlaceholder="Find a project member" emptyText="Only the project team can be assigned" />
          <SearchableCombobox options={MODE_OPTIONS} value={action.mode ?? 'add'} onChange={(v) => v && onChange({ ...action, mode: v as 'add' | 'replace' })} clearable={false} searchPlaceholder="How" />
        </div>
      )}
      {action.type === 'notify' && (
        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={(action.recipients ?? []).includes('assignees')}
              onChange={(e) => onChange({ ...action, recipients: e.target.checked ? ['assignees'] : [] })}
            />
            The task&apos;s assignees
          </label>
          <MultiSelectCombobox options={people} values={action.user_ids ?? []} onChange={(ids) => onChange({ ...action, user_ids: ids })} placeholder="And these people" searchPlaceholder="Find a project member" emptyText="Only the project team can be notified" />
          <input className={inputClass} value={action.message ?? ''} onChange={(e) => onChange({ ...action, message: e.target.value })} maxLength={500} placeholder="Message (optional)" aria-label={`Message for action ${index + 1}`} />
        </div>
      )}
      {action.type === 'set_field' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <SearchableCombobox
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'custom', label: 'A custom field' },
            ]}
            value={custom ? 'custom' : 'priority'}
            onChange={(v) => v && onChange(v === 'priority' ? { ...action, field: 'priority', value: 'high' } : { ...action, field: 'metadata.', value: '' })}
            clearable={false}
            searchPlaceholder="Field"
          />
          {custom ? (
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputClass}
                value={(action.field ?? '').replace(/^metadata\./, '')}
                onChange={(e) => onChange({ ...action, field: `metadata.${e.target.value.trim().toLowerCase()}` })}
                placeholder="Key, for example stage"
                aria-label={`Field key for action ${index + 1}`}
              />
              <input className={inputClass} value={String(action.value ?? '')} onChange={(e) => onChange({ ...action, value: e.target.value })} placeholder="Value" aria-label={`Field value for action ${index + 1}`} />
            </div>
          ) : (
            <SearchableCombobox options={PRIORITY_OPTIONS} value={String(action.value ?? 'high')} onChange={(v) => v && onChange({ ...action, value: v })} clearable={false} searchPlaceholder="Priority" />
          )}
        </div>
      )}
    </li>
  );
}

function RuleEditor({
  rule,
  index,
  statusOptions,
  people,
  onChange,
  onRemove,
}: {
  rule: AutomationRule;
  index: number;
  statusOptions: ComboboxOption[];
  people: ComboboxOption[];
  onChange: (r: AutomationRule) => void;
  onRemove: () => void;
}) {
  const setAction = (i: number, a: AutomationAction) => onChange({ ...rule, actions: rule.actions.map((x, n) => (n === i ? a : x)) });
  return (
    <li className="space-y-3 rounded-md border border-border p-3" data-testid="automation-rule">
      <div className="flex items-start gap-2">
        <label className="block min-w-0 flex-1 space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Name</span>
          <input className={inputClass} value={rule.name} onChange={(e) => onChange({ ...rule, name: e.target.value })} maxLength={120} placeholder="For example: hand finished work to QA" aria-label={`Automation ${index + 1} name`} />
        </label>
        <label className="flex min-h-11 shrink-0 items-center gap-2 pt-5 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={rule.enabled} onChange={(e) => onChange({ ...rule, enabled: e.target.checked })} />
          On
        </label>
        <Button type="button" variant="ghost" className="mt-5 h-11 w-11 shrink-0 p-0 text-destructive sm:h-9 sm:w-9" onClick={onRemove} aria-label={`Delete automation ${rule.name || index + 1}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <span className="block text-xs text-muted-foreground">When a task moves to</span>
          <SearchableCombobox options={statusOptions} value={rule.trigger.to} onChange={(v) => v && onChange({ ...rule, trigger: { ...rule.trigger, to: v } })} clearable={false} searchPlaceholder="Status" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="block text-xs text-muted-foreground">From (optional)</span>
          <SearchableCombobox options={statusOptions} value={rule.trigger.from ?? ''} onChange={(v) => onChange({ ...rule, trigger: { to: rule.trigger.to, ...(v ? { from: v } : {}) } })} placeholder="Any status" searchPlaceholder="Status" />
        </div>
      </div>
      <ul className="space-y-2">
        {rule.actions.map((a, i) => (
          <ActionEditor
            key={i}
            action={a}
            index={i}
            people={people}
            onChange={(x) => setAction(i, x)}
            onRemove={() => onChange({ ...rule, actions: rule.actions.filter((_, n) => n !== i) })}
            canRemove={rule.actions.length > 1}
          />
        ))}
      </ul>
      <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={rule.actions.length >= MAX_ACTIONS} onClick={() => onChange({ ...rule, actions: [...rule.actions, blankAction('notify')] })}>
        <Plus className="h-4 w-4" aria-hidden />
        Add an action
      </Button>
    </li>
  );
}

/**
 * Automations (US-16.8): when a task moves to a status, assign people, notify people or set a
 * field, in the same save as the move. At most 25 rules of 5 actions. Read only without
 * projects.automation.manage. Mount it with a key on the saved list so a save starts it afresh.
 */
export function AutomationsEditor({
  orgSlug,
  projectId,
  statuses,
  saved,
  people,
  nameOf,
  editable,
}: {
  orgSlug: string;
  projectId: string;
  statuses: ProjectStatus[];
  saved: AutomationRule[];
  people: Person[];
  nameOf: (id: string) => string;
  editable: boolean;
}) {
  const [list, setList] = useState<AutomationRule[]>(saved);
  const [tried, setTried] = useState(false);
  const save = useSaveAutomations(orgSlug, projectId);
  const keys = statuses.map((s) => s.key);
  const labelOf = (k: string) => statuses.find((s) => s.key === k)?.label ?? k;
  const statusOptions: ComboboxOption[] = statuses.map((s) => ({ value: s.key, label: s.label }));
  const peopleOptions: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name, hint: p.email }));
  const error = automationsError(list, keys);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const doneKey = statuses.find((s) => s.category === 'done')?.key ?? keys[keys.length - 1] ?? '';

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Automations</CardTitle>
        <p className="text-sm text-muted-foreground">
          When a task moves, these run in the same save. {list.length} of {MAX_AUTOMATIONS} used.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.length === 0 ? (
          <EmptyState icon={Zap} title="No automations yet" description={editable ? 'Add one to assign, notify or set a field when a task moves.' : 'Nobody has set up an automation on this project.'} />
        ) : editable ? (
          <ul className="space-y-3">
            {list.map((r, i) => (
              <RuleEditor
                key={r.id ?? `new-${i}`}
                rule={r}
                index={i}
                statusOptions={statusOptions}
                people={peopleOptions}
                onChange={(x) => setList((l) => l.map((y, n) => (n === i ? x : y)))}
                onRemove={() => setList((l) => l.filter((_, n) => n !== i))}
              />
            ))}
          </ul>
        ) : (
          <ul className="space-y-2" data-testid="automation-summaries">
            {list.map((r, i) => (
              <li key={r.id ?? i} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {r.name}
                  {!r.enabled && <span className="ml-2 text-xs font-normal text-muted-foreground">Off</span>}
                </p>
                <p className="text-muted-foreground">{automationSummary(r, labelOf, nameOf)}</p>
              </li>
            ))}
          </ul>
        )}
        {(tried || dirty) && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {editable && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" className="h-11 sm:h-9" disabled={list.length >= MAX_AUTOMATIONS || !doneKey} onClick={() => setList((l) => [...l, newAutomation(doneKey)])}>
              <Plus className="h-4 w-4" aria-hidden />
              Add automation
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="h-11 sm:h-9" disabled={!dirty || save.isPending} onClick={() => setList(saved)}>
                Undo changes
              </Button>
              <Button
                className="h-11 sm:h-9"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  setTried(true);
                  if (!error) save.mutate(automationsBody(list));
                }}
              >
                {save.isPending ? 'Saving...' : 'Save automations'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
