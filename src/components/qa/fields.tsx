'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Inputs use 16 px text on phones (no zoom on focus) and the repo's border and ring tokens. */
export const inputClass =
  'w-full min-h-10 rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** A labelled control with its hint and error wired to aria-describedby. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
