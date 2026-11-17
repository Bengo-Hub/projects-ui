'use client';

import { cn } from '@/lib/utils';

/**
 * The "Visible to client" switch on a task or a file. Off by default: nothing reaches the client
 * portal until someone with projects.portal.manage turns it on.
 */
export function ShareSwitch({
  checked,
  onChange,
  disabled,
  label = 'Visible to client',
  describedBy,
  compact,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  describedBy?: string;
  /** Hides the state text on phones, for tight rows. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn('inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm disabled:opacity-50', className)}
    >
      <span
        aria-hidden
        className={cn(
          'relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className={cn('whitespace-nowrap text-muted-foreground', compact && 'hidden sm:inline')}>{checked ? 'Client can see' : 'Team only'}</span>
    </button>
  );
}
