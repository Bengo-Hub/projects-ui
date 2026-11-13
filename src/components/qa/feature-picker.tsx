'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useQAFeatures } from '@/hooks/useQA';
import { Field, inputClass } from './fields';
import type { QAFeature } from '@/types/qa';

interface FeaturePickerProps {
  orgSlug: string;
  /** The template's service tag narrows the list ("hadia", "pos"). */
  serviceTag?: string;
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
}

/**
 * Picks a catalogue feature (GET catalog/features). Until projects-api reads the catalogue
 * (available false) or when the read fails, the feature code is typed by hand.
 */
export function FeaturePicker({ orgSlug, serviceTag, value, onChange, error }: FeaturePickerProps) {
  const { data, isLoading, isError } = useQAFeatures(orgSlug, serviceTag || undefined);
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = (data?.data ?? []).filter(
      (f) => !q || f.label.toLowerCase().includes(q) || f.featureCode.toLowerCase().includes(q) || (f.module ?? '').toLowerCase().includes(q),
    );
    const m = new Map<string, QAFeature[]>();
    for (const f of list) {
      const k = f.category || f.module || 'Other';
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, filter]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" aria-busy="true">Loading the feature catalogue...</p>;
  }

  const manual = isError || !data?.available || (data?.data ?? []).length === 0;
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

  const known = (data?.data ?? []).some((f) => f.featureCode === value);
  return (
    <div className="space-y-2">
      <Field label="Search features" hint="Filter by name, code or module">
        {({ id, describedBy }) => (
          <input id={id} type="search" className={inputClass} value={filter} aria-describedby={describedBy} onChange={(e) => setFilter(e.target.value)} />
        )}
      </Field>
      <Field label="Feature" required error={error}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            className={inputClass}
            value={value}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{groups.length ? 'Choose a feature' : 'No feature matches the search'}</option>
            {!known && value && <option value={value}>{value} (not in the catalogue)</option>}
            {groups.map(([cat, feats]) => (
              <optgroup key={cat} label={cat}>
                {feats.map((f) => (
                  <option key={f.featureCode} value={f.featureCode}>
                    {f.label} ({f.featureCode})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
