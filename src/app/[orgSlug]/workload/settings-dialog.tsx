'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useSaveWorkloadSettings, useWorkloadSettings } from '@/hooks/useWorkload';
import type { PersonLoad, WorkloadSettings } from '@/lib/api/planning';
import { personLabel } from '@/lib/work/people';
import { validHours } from '@/lib/planning/workload';

const inputClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm';

interface Override {
  userId: string;
  hours: string;
}

function Form({ orgSlug, people, settings, onClose }: { orgSlug: string; people: PersonLoad[]; settings: WorkloadSettings; onClose: () => void }) {
  const [weekly, setWeekly] = useState(String(settings.weekly_hours ?? 40));
  const [rows, setRows] = useState<Override[]>(() => Object.entries(settings.person_hours ?? {}).map(([userId, h]) => ({ userId, hours: String(h) })));
  const save = useSaveWorkloadSettings(orgSlug);

  const nameOf = (id: string) => {
    const p = people.find((x) => x.user_id === id);
    return personLabel({ userId: id, name: p?.name, email: p?.email, former: !p });
  };
  const optionsFor = (current: string): ComboboxOption[] =>
    people.filter((p) => p.user_id === current || !rows.some((r) => r.userId === p.user_id)).map((p) => ({ value: p.user_id, label: nameOf(p.user_id) }));

  const weeklyOk = validHours(weekly);
  const rowsOk = rows.every((r) => r.userId && validHours(r.hours));
  const ok = weeklyOk && rowsOk && rows.length <= 2000;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const person_hours: Record<string, number> = {};
    for (const r of rows) person_hours[r.userId] = Number(r.hours);
    save.mutate({ weekly_hours: Number(weekly), person_hours }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Standard hours a week</span>
        <input type="text" inputMode="decimal" className={inputClass} value={weekly} onChange={(e) => setWeekly(e.target.value)} aria-label="Standard hours a week" />
        {!weeklyOk && <span className="block text-xs text-destructive">Enter 0 to 168 hours.</span>}
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Different hours for some people</legend>
        <p className="text-xs text-muted-foreground">For part time staff, or anyone who spends part of the week on other work.</p>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Everyone works the standard hours.</p>}
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-2" data-testid="capacity-override">
              <div className="min-w-0 flex-1">
                <SearchableCombobox
                  options={optionsFor(r.userId)}
                  value={r.userId}
                  valueLabel={r.userId ? nameOf(r.userId) : undefined}
                  onChange={(v) => setRows((list) => list.map((x, n) => (n === i ? { ...x, userId: v ?? '' } : x)))}
                  placeholder="Pick a person"
                  searchPlaceholder="Find a person"
                  clearable={false}
                />
              </div>
              <input
                type="text"
                inputMode="decimal"
                className={`${inputClass} w-24 shrink-0`}
                value={r.hours}
                onChange={(e) => setRows((list) => list.map((x, n) => (n === i ? { ...x, hours: e.target.value } : x)))}
                aria-label={`Hours a week for ${r.userId ? nameOf(r.userId) : 'this person'}`}
                aria-invalid={!validHours(r.hours)}
              />
              <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9" onClick={() => setRows((list) => list.filter((_, n) => n !== i))} aria-label="Remove this person's hours">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        {!rowsOk && <p className="text-xs text-destructive">Pick a person and 0 to 168 hours on every line.</p>}
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setRows((list) => [...list, { userId: '', hours: '20' }])} disabled={people.length === 0}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a person
        </Button>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 sm:h-9" disabled={!ok || save.isPending}>
          {save.isPending ? 'Saving...' : 'Save capacity'}
        </Button>
      </div>
    </form>
  );
}

/** Capacity (projects.workload.manage): standard weekly hours and per person overrides. */
export function SettingsDialog({ orgSlug, people, onClose }: { orgSlug: string; people: PersonLoad[]; onClose: () => void }) {
  const { data, isLoading, isError } = useWorkloadSettings(orgSlug);
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Team capacity" description="The hours each person can give a week. Workload compares estimated work against them.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading</p>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">The capacity settings could not be loaded.</p>
      ) : (
        <Form orgSlug={orgSlug} people={people} settings={data} onClose={onClose} />
      )}
    </QADialog>
  );
}
