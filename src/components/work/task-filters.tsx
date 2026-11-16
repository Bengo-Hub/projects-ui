'use client';

import { useState } from 'react';
import { BookmarkPlus, X } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { ListFilters } from '@/components/common/list-parts';
import { PRIORITY_OPTIONS } from '@/components/work/status-pill';
import { activeCount, removeNamed, saveNamed, type FilterState, type TaskFilters } from '@/lib/work/saved-filters';
import type { Person } from '@/hooks/usePeople';
import type { ProjectStatus } from '@/types';

/**
 * Filters for the board and list, plus named saved filters kept per project in this browser. The
 * status filter applies to the list only (the board shows every column).
 */
export function TaskFilterBar({
  state,
  onChange,
  statuses,
  people,
  showStatus,
}: {
  state: FilterState;
  onChange: (s: FilterState) => void;
  statuses: ProjectStatus[];
  people: Person[];
  showStatus: boolean;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const f = state.current;
  const set = (patch: Partial<TaskFilters>) => onChange({ ...state, current: { ...f, ...patch } });
  const assigneeOptions: ComboboxOption[] = [{ value: 'me', label: 'Assigned to me' }, ...people.filter((p) => !p.isMe).map((p) => ({ value: p.userId, label: p.name }))];
  const savedOptions: ComboboxOption[] = state.saved.map((s) => ({ value: s.name, label: s.name }));
  const active = activeCount(f);

  return (
    <ListFilters active={active} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {showStatus && (
        <SearchableCombobox
          className="sm:w-44"
          options={statuses.map((s) => ({ value: s.key, label: s.label }))}
          value={f.status ?? ''}
          onChange={(v) => set({ status: v || undefined })}
          placeholder="Any status"
          searchPlaceholder="Status"
        />
      )}
      <SearchableCombobox className="sm:w-40" options={PRIORITY_OPTIONS} value={f.priority ?? ''} onChange={(v) => set({ priority: v || undefined })} placeholder="Any priority" searchPlaceholder="Priority" />
      <SearchableCombobox className="sm:w-52" options={assigneeOptions} value={f.assignee ?? ''} onChange={(v) => set({ assignee: v || undefined })} placeholder="Anyone" searchPlaceholder="Assignee" />
      {active > 0 && (
        <Button variant="ghost" className="h-11 sm:h-9" onClick={() => onChange({ ...state, current: {} })}>
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        {savedOptions.length > 0 && (
          <SearchableCombobox
            className="min-w-0 flex-1 sm:w-48"
            options={savedOptions}
            value=""
            onChange={(v) => {
              const s = state.saved.find((x) => x.name === v);
              if (s) onChange({ ...state, current: { ...s.filters } });
            }}
            placeholder="Saved filters"
            searchPlaceholder="Find a saved filter"
          />
        )}
        {naming ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              onChange(saveNamed(state, name));
              setName('');
              setNaming(false);
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Filter name" className="h-11 w-36 rounded-md border border-border bg-background px-2 text-base sm:h-9 sm:text-sm" aria-label="Filter name" />
            <Button type="submit" size="sm" className="h-11 sm:h-9" disabled={!name.trim()}>
              Save
            </Button>
          </form>
        ) : (
          active > 0 && (
            <Button variant="outline" className="h-11 sm:h-9" onClick={() => setNaming(true)}>
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Save filter
            </Button>
          )
        )}
        {state.saved.some((s) => JSON.stringify(s.filters) === JSON.stringify(f)) && (
          <Button
            variant="ghost"
            className="h-11 sm:h-9"
            onClick={() => {
              const s = state.saved.find((x) => JSON.stringify(x.filters) === JSON.stringify(f));
              if (s) onChange(removeNamed(state, s.name));
            }}
          >
            Forget
          </Button>
        )}
      </div>
    </ListFilters>
  );
}
