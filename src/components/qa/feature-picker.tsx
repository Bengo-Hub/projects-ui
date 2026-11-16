'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { useQAFeatures } from '@/hooks/useQA';
import { Field, inputClass } from './fields';

interface FeaturePickerProps {
  orgSlug: string;
  /** The template's service tag narrows the list ("hadia", "pos"). */
  serviceTag?: string;
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
}

/**
 * Picks a catalogue feature (GET catalog/features) with the shared searchable combobox, which
 * searches label, code and group. Until projects-api reads the catalogue (available false) or
 * when the read fails, the feature code is typed by hand.
 */
export function FeaturePicker({ orgSlug, serviceTag, value, onChange, error }: FeaturePickerProps) {
  const { data, isLoading, isError } = useQAFeatures(orgSlug, serviceTag || undefined);

  const options = useMemo<ComboboxOption[]>(
    () =>
      [...(data?.data ?? [])]
        .sort((a, b) => (a.category || a.module || 'Other').localeCompare(b.category || b.module || 'Other') || a.label.localeCompare(b.label))
        .map((f) => ({
          value: f.featureCode,
          label: f.label,
          hint: f.featureCode,
          description: f.category || f.module || undefined,
        })),
    [data],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" aria-busy="true">Loading the feature catalogue...</p>;
  }

  const manual = isError || !data?.available || options.length === 0;
  if (manual) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm" role="note">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            {isError
              ? 'The feature catalogue could not be read just now.'
              : !data?.available
                ? 'The feature catalogue is not enabled yet.'
                : `The catalogue has no features${serviceTag ? ` for ${serviceTag}` : ''}.`}{' '}
            Type the feature code instead; it is checked once the catalogue is on.
          </p>
        </div>
        <Field label="Feature code" required error={error}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className={inputClass}
              value={value}
              maxLength={200}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="for example registry.create"
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </Field>
      </div>
    );
  }

  const known = options.some((o) => o.value === value);
  return (
    <Field label="Feature" required error={error} hint="Search by name, code or module">
      {() => (
        <SearchableCombobox
          options={options}
          value={value}
          valueLabel={!known && value ? `${value} (not in the catalogue)` : undefined}
          onChange={(v) => onChange(v)}
          placeholder="Choose a feature"
          searchPlaceholder="Search name, code or module"
          emptyText="No feature matches the search"
        />
      )}
    </Field>
  );
}
