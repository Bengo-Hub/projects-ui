'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IMPORT_COLUMNS, MAX_CRITERIA_PER_CALL, parseCriteriaImport } from '@/lib/qa/logic';
import { Field, inputClass } from './fields';
import { QADialog } from './qa-dialog';
import type { QACriterionInput } from '@/types/qa';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: boolean;
  pending: boolean;
  onImport: (criteria: QACriterionInput[]) => void;
}

/** Bulk import of criteria from CSV or JSON, checked on this device before anything is sent. */
export function ImportDialog({ open, onOpenChange, platform, pending, onImport }: ImportDialogProps) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setChecked(false);
    }
  }, [open]);

  const parsed = useMemo(() => (checked ? parseCriteriaImport(text, platform) : null), [checked, text, platform]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setChecked(true);
  }

  const calls = parsed ? Math.ceil(parsed.criteria.length / MAX_CRITERIA_PER_CALL) : 0;

  return (
    <QADialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import criteria"
      description="Paste CSV with a header row, or a JSON list. Every row is checked before it is sent."
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          CSV columns: <code className="break-words">{IMPORT_COLUMNS.join(', ')}</code>. Only title is required; subject kind
          defaults to none and weight to must.
        </p>
        <Field label="Choose a file" hint="A .csv or .json file">
          {({ id, describedBy }) => (
            <input
              id={id}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              aria-describedby={describedBy}
              className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-md file:border file:border-border file:bg-background file:px-3"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          )}
        </Field>
        <Field label="Or paste the criteria">
          {({ id }) => (
            <textarea
              id={id}
              rows={8}
              className={`${inputClass} font-mono text-xs sm:text-xs`}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setChecked(false);
              }}
            />
          )}
        </Field>

        {parsed && (
          <div role="status" className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p>
              {parsed.criteria.length} {parsed.criteria.length === 1 ? 'criterion is' : 'criteria are'} ready
              {parsed.errors.length ? `, ${parsed.errors.length} ${parsed.errors.length === 1 ? 'row needs' : 'rows need'} fixing` : ''}.
            </p>
            {calls > 1 && (
              <p className="text-xs text-muted-foreground">
                They go in {calls} parts of up to {MAX_CRITERIA_PER_CALL}. If a part fails, the parts before it stay added.
              </p>
            )}
            {parsed.errors.length > 0 && (
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-destructive">
                {parsed.errors.slice(0, 50).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {!parsed ? (
            <Button type="button" onClick={() => setChecked(true)} disabled={!text.trim()}>
              Check rows
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || !parsed.criteria.length || parsed.errors.length > 0}
              onClick={() => onImport(parsed.criteria)}
            >
              {pending ? 'Importing...' : `Import ${parsed.criteria.length}`}
            </Button>
          )}
        </div>
      </div>
    </QADialog>
  );
}
