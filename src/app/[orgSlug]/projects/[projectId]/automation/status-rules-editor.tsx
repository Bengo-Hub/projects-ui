'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaveStatusRules } from '@/hooks/useAutomation';
import {
  FIELD_CODES,
  clearMoves,
  fieldLabel,
  moveAllowed,
  requiredFor,
  restricted,
  rulesError,
  setRequired,
  toggleMove,
  validFieldCode,
  type StatusRules,
} from '@/lib/planning/rules';
import type { ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';

const inputClass = 'h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm';

function Check({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return (
    <label className={cn('inline-flex h-11 w-11 items-center justify-center rounded-md sm:h-9 sm:w-9', !disabled && 'cursor-pointer hover:bg-accent')}>
      <input type="checkbox" className="h-5 w-5 accent-primary" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
    </label>
  );
}

/** Which columns a card may move to from each column: a grid on wider screens, a card per column on a phone. */
function MovesMatrix({ rules, statuses, editable, onChange }: { rules: StatusRules; statuses: ProjectStatus[]; editable: boolean; onChange: (r: StatusRules) => void }) {
  const keys = statuses.map((s) => s.key);
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm" data-testid="moves-matrix">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                From
              </th>
              {statuses.map((s) => (
                <th key={s.key} scope="col" className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                  {s.label}
                </th>
              ))}
              <th scope="col" className="sr-only">
                Reset
              </th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((from) => (
              <tr key={from.key} className="border-b border-border/60">
                <th scope="row" className="px-2 py-1 text-left font-medium">
                  {from.label}
                  {!restricted(rules, from.key) && <span className="block text-xs font-normal text-muted-foreground">Moves anywhere</span>}
                </th>
                {statuses.map((to) => (
                  <td key={to.key} className="text-center">
                    {from.key === to.key ? (
                      <span className="text-muted-foreground" aria-hidden>
                        -
                      </span>
                    ) : (
                      <Check
                        checked={moveAllowed(rules, from.key, to.key)}
                        disabled={!editable}
                        label={`Allow ${from.label} to ${to.label}`}
                        onChange={() => onChange(toggleMove(rules, keys, from.key, to.key))}
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 text-right">
                  {editable && restricted(rules, from.key) && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange(clearMoves(rules, from.key))}>
                      Allow all
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 sm:hidden">
        {statuses.map((from) => (
          <li key={from.key} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">From {from.label}</p>
              {editable && restricted(rules, from.key) && (
                <Button variant="ghost" className="h-11" onClick={() => onChange(clearMoves(rules, from.key))}>
                  Allow all
                </Button>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {statuses
                .filter((to) => to.key !== from.key)
                .map((to) => (
                  <label key={to.key} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={moveAllowed(rules, from.key, to.key)}
                      disabled={!editable}
                      onChange={() => onChange(toggleMove(rules, keys, from.key, to.key))}
                      aria-label={`Allow ${from.label} to ${to.label}`}
                    />
                    {to.label}
                  </label>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function RequiredFields({ rules, statuses, editable, onChange }: { rules: StatusRules; statuses: ProjectStatus[]; editable: boolean; onChange: (r: StatusRules) => void }) {
  const [custom, setCustom] = useState<Record<string, string>>({});
  return (
    <ul className="space-y-3" data-testid="required-fields">
      {statuses.map((s) => {
        const fields = requiredFor(rules, s.key);
        const extra = fields.filter((f) => !FIELD_CODES.includes(f));
        const draft = (custom[s.key] ?? '').trim().toLowerCase();
        const code = draft ? `metadata.${draft}` : '';
        return (
          <li key={s.key} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Before moving to {s.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FIELD_CODES.map((f) => {
                const on = fields.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    disabled={!editable}
                    onClick={() => onChange(setRequired(rules, s.key, on ? fields.filter((x) => x !== f) : [...fields, f]))}
                    className={cn(
                      'min-h-11 rounded-full border px-3 text-sm sm:min-h-8',
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                      editable ? 'hover:border-primary' : 'cursor-default',
                    )}
                    aria-label={`${s.label} needs ${fieldLabel(f).toLowerCase()}`}
                  >
                    {fieldLabel(f)}
                  </button>
                );
              })}
              {extra.map((f) => (
                <span key={f} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 text-sm text-primary sm:min-h-8">
                  {fieldLabel(f)}
                  {editable && (
                    <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => onChange(setRequired(rules, s.key, fields.filter((x) => x !== f)))} aria-label={`Stop requiring ${fieldLabel(f)}`}>
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {editable && (
              <div className="mt-2 flex gap-2">
                <input
                  className={inputClass}
                  value={custom[s.key] ?? ''}
                  onChange={(e) => setCustom((c) => ({ ...c, [s.key]: e.target.value }))}
                  placeholder="Custom field key, for example signed_off"
                  aria-label={`Custom required field for ${s.label}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 sm:h-9"
                  disabled={!code || !validFieldCode(code) || fields.includes(code)}
                  onClick={() => {
                    onChange(setRequired(rules, s.key, [...fields, code]));
                    setCustom((c) => ({ ...c, [s.key]: '' }));
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The project's status rules (US-16.7): which moves are allowed and what a task needs before it may
 * enter a column. Mount it with a key on the saved rules so a save starts it afresh.
 */
export function StatusRulesEditor({ orgSlug, projectId, statuses, saved, editable }: { orgSlug: string; projectId: string; statuses: ProjectStatus[]; saved: StatusRules; editable: boolean }) {
  const [rules, setRules] = useState<StatusRules>(saved);
  const [tried, setTried] = useState(false);
  const save = useSaveStatusRules(orgSlug, projectId);
  const keys = statuses.map((s) => s.key);
  const labelOf = (k: string) => statuses.find((s) => s.key === k)?.label ?? k;
  const error = rulesError(rules, keys, labelOf);
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Status rules</CardTitle>
        <p className="text-sm text-muted-foreground">The board and the task drawer follow these rules and say why a move is blocked.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2" aria-label="Allowed moves">
          <h3 className="text-sm font-semibold">Allowed moves</h3>
          <MovesMatrix rules={rules} statuses={statuses} editable={editable} onChange={setRules} />
        </section>
        <section className="space-y-2" aria-label="Required fields">
          <h3 className="text-sm font-semibold">Required before a move</h3>
          <RequiredFields rules={rules} statuses={statuses} editable={editable} onChange={setRules} />
        </section>
        {(tried || dirty) && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {editable && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-11 sm:h-9" disabled={!dirty || save.isPending} onClick={() => setRules(saved)}>
              Undo changes
            </Button>
            <Button
              className="h-11 sm:h-9"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setTried(true);
                if (!error) save.mutate(rules);
              }}
            >
              {save.isPending ? 'Saving...' : 'Save status rules'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
