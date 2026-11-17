'use client';

import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDeleteBaseline, useSaveBaseline } from '@/hooks/useBaselines';
import type { BaselineSummary } from '@/lib/api/planning';
import { defaultBaselineName } from '@/lib/planning/baselines';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

function SaveDialog({ orgSlug, projectId, onClose, onSaved }: { orgSlug: string; projectId: string; onClose: () => void; onSaved: (b: BaselineSummary) => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [placeholder] = useState(() => defaultBaselineName());
  const save = useSaveBaseline(orgSlug, projectId);
  const tooLong = name.trim().length > 120 || note.trim().length > 1000;
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Save a baseline" description="A snapshot of every task's dates and estimate and every milestone's date, to compare the plan against later.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (tooLong) return;
          save.mutate(
            { ...(name.trim() ? { name: name.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) },
            {
              onSuccess: (b) => {
                onSaved(b);
                onClose();
              },
            },
          );
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Name</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} aria-label="Baseline name" maxLength={120} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Note</span>
          <textarea className={`${inputClass} min-h-20`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: as signed off with the client" aria-label="Baseline note" maxLength={1000} />
        </label>
        {tooLong && <p className="text-xs text-destructive">The name is at most 120 characters and the note at most 1000.</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={save.isPending || tooLong}>
            {save.isPending ? 'Saving...' : 'Save baseline'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

/**
 * The baseline controls on the timeline (US-16.2): which baseline to compare against (the latest by
 * default), save a new one, delete the one shown.
 */
export function BaselineBar({
  orgSlug,
  projectId,
  baselines,
  selected,
  onSelect,
  canAdd,
  canDelete,
}: {
  orgSlug: string;
  projectId: string;
  baselines: BaselineSummary[];
  selected: string;
  onSelect: (id: string) => void;
  canAdd: boolean;
  canDelete: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const del = useDeleteBaseline(orgSlug, projectId);
  const shown = baselines.find((b) => b.id === selected) ?? baselines[0];
  const options: ComboboxOption[] = baselines.map((b, i) => ({
    value: b.id,
    label: i === 0 ? `${b.name} (latest)` : b.name,
    hint: formatDateTime(b.created_at),
    description: [b.created_by_name && `Saved by ${b.created_by_name}`, b.note].filter(Boolean).join('. ') || undefined,
  }));

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="baseline-bar">
      {baselines.length > 0 ? (
        <div className="min-w-0 sm:w-72">
          <SearchableCombobox
            options={options}
            value={shown?.id ?? ''}
            onChange={(v) => onSelect(v && v !== baselines[0]?.id ? v : '')}
            clearable={false}
            placeholder="Compare with a baseline"
            searchPlaceholder="Find a baseline"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No baseline yet.{canAdd ? ' Save one to track slips against the plan.' : ''}</p>
      )}
      <div className="flex gap-2">
        {canAdd && (
          <Button variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => setSaving(true)}>
            <Save className="h-4 w-4" aria-hidden />
            Save baseline
          </Button>
        )}
        {canDelete && shown && (
          <Button variant="outline" className="h-11 flex-1 text-destructive sm:h-9 sm:flex-none" onClick={() => setConfirm(true)} aria-label={`Delete baseline ${shown.name}`}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        )}
      </div>
      {saving && <SaveDialog orgSlug={orgSlug} projectId={projectId} onClose={() => setSaving(false)} onSaved={() => onSelect('')} />}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${shown?.name ?? 'baseline'}"?`}
        description="The snapshot goes for good. The tasks and the other baselines stay as they are."
        confirmLabel="Delete baseline"
        variant="danger"
        loading={del.isPending}
        onConfirm={() =>
          shown &&
          del.mutate(shown.id, {
            onSuccess: () => {
              setConfirm(false);
              onSelect('');
            },
          })
        }
      />
    </div>
  );
}
