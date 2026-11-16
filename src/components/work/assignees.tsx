'use client';

import { MultiSelectCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import type { Person } from '@/hooks/usePeople';
import { initials } from '@/lib/work/people';
import type { TaskAssignee } from '@/types';
import { cn } from '@/lib/utils';

/** Overlapping avatars for a task's assignees, primary first; the rest fold into "+n". */
export function AssigneeAvatars({
  assignees,
  nameOf,
  max = 3,
  className,
}: {
  assignees?: TaskAssignee[];
  nameOf: (userId: string) => string;
  max?: number;
  className?: string;
}) {
  const list = assignees ?? [];
  if (list.length === 0) return <span className={cn('text-xs text-muted-foreground', className)}>Unassigned</span>;
  const shown = list.slice(0, max);
  const names = list.map((a) => nameOf(a.user_id));
  return (
    <span className={cn('inline-flex items-center', className)} title={names.join(', ')} aria-label={`Assigned to ${names.join(', ')}`}>
      {shown.map((a, i) => (
        <span
          key={a.user_id}
          aria-hidden
          className={cn(
            'grid h-6 w-6 place-items-center rounded-full border-2 border-card text-[10px] font-semibold',
            a.is_primary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
            i > 0 && '-ml-1.5',
          )}
        >
          {initials(nameOf(a.user_id))}
        </span>
      ))}
      {list.length > max && (
        <span aria-hidden className="-ml-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-card bg-muted px-1 text-[10px] font-medium text-muted-foreground">
          +{list.length - max}
        </span>
      )}
    </span>
  );
}

/**
 * Picks assignees from the project's members only. The first picked is the primary assignee; the
 * API keeps that order.
 */
export function AssigneePicker({
  people,
  value,
  onChange,
  disabled,
  className,
}: {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const options: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name, hint: p.email }));
  return (
    <div className={className}>
      <MultiSelectCombobox
        options={options}
        values={value}
        // Keep the existing order (the primary stays first) and add new picks at the end.
        onChange={(next) => onChange([...value.filter((v) => next.includes(v)), ...next.filter((v) => !value.includes(v))])}
        placeholder="Assign people"
        searchPlaceholder="Find a project member"
        emptyText="Only project members can be assigned"
        disabled={disabled}
      />
      {value.length > 1 && <p className="mt-1 text-xs text-muted-foreground">The first person is the primary assignee.</p>}
    </div>
  );
}
