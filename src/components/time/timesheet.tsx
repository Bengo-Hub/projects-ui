'use client';

import { useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useTasks } from '@/hooks/useTasks';
import {
  billsHours,
  dayName,
  draftRow,
  formatHours,
  formatTotal,
  parseHours,
  rowKey,
  type TimeRow,
  type TimeWeek,
} from '@/lib/work/time';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

// The week timesheet (US-13.2): a grid of projects and tasks by day from 768 px, a day by day list
// below. Each cell sets that day's hours in ERP; notes and the billable switch go with them.

export interface SheetProps {
  week: TimeWeek;
  /** The week is open and the user may log here (their own week, or someone else's with manage). */
  editable: boolean;
  projects: Map<string, Project>;
  today: string;
  onSet: (row: TimeRow, date: string, hours: number, note?: string) => void;
  onBillable: (row: TimeRow, billable: boolean) => void;
}

export function rowName(r: TimeRow): string {
  return r.project_name || (r.project_id ? 'Project' : 'No project');
}

/** A row can be written when it names a project (ERP time without one is read only here). */
const rowWritable = (r: TimeRow, editable: boolean) => editable && !!r.project_id;

/** Hours typed in a cell, saved on Enter or when focus leaves. Typed text, never a lookup. */
function HourInput({ value, label, onCommit, className }: { value: number | undefined; label: string; onCommit: (hours: number) => void; className?: string }) {
  const [text, setText] = useState(formatHours(value));
  const [seen, setSeen] = useState(value);
  // A save or a live refetch replaces the value: the field follows it while rendering.
  if (seen !== value) {
    setSeen(value);
    setText(formatHours(value));
  }
  const commit = () => {
    const parsed = parseHours(text);
    if (!parsed.ok) {
      toast.error(parsed.message);
      setText(formatHours(value));
      return;
    }
    setText(formatHours(parsed.hours));
    if (parsed.hours !== (value ?? 0)) onCommit(parsed.hours);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setText(formatHours(value));
      }}
      className={cn(
        'h-11 w-full rounded-md border border-border bg-background px-2 text-center text-base tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring sm:h-9 sm:text-sm',
        className,
      )}
    />
  );
}

/** The billable switch, on time and materials projects only; elsewhere a read-only mark. */
function Billable({ row, project, editable, onBillable }: { row: TimeRow; project?: Project; editable: boolean; onBillable: SheetProps['onBillable'] }) {
  if (rowWritable(row, editable) && project && billsHours(project.metadata)) {
    return (
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:min-h-0">
        <input type="checkbox" role="switch" aria-checked={row.billable} checked={row.billable} onChange={(e) => onBillable(row, e.target.checked)} className="h-4 w-4 accent-primary" />
        Billable
      </label>
    );
  }
  return row.billable ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Billable</span> : null;
}

/** A cell's hours and note together (the note is plain text on the ERP entry, 500 characters). */
function NoteDialog({ target, onClose, onSave }: { target: { row: TimeRow; date: string } | null; onClose: () => void; onSave: (hours: number, note: string) => void }) {
  return (
    <QADialog open={!!target} onOpenChange={(o) => !o && onClose()} title={target ? `${rowName(target.row)}, ${dayName(target.date, true)}` : ''} description={target?.row.task_title} className="sm:max-w-md">
      {target && <NoteForm key={`${rowKey(target.row.project_id, target.row.task_id)}-${target.date}`} target={target} onClose={onClose} onSave={onSave} />}
    </QADialog>
  );
}

function NoteForm({ target, onClose, onSave }: { target: { row: TimeRow; date: string }; onClose: () => void; onSave: (hours: number, note: string) => void }) {
  const [hours, setHours] = useState(formatHours(target.row.hours[target.date]));
  const [note, setNote] = useState(target.row.notes?.[target.date] ?? '');
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseHours(hours);
        if (!parsed.ok) {
          toast.error(parsed.message);
          return;
        }
        onSave(parsed.hours, note.trim());
        onClose();
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Hours</span>
        <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="0" className="h-11 w-full rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What the time went on" className="h-11 w-full rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm" />
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 sm:h-9">
          Save
        </Button>
      </div>
    </form>
  );
}

function NoteButton({ row, date, onOpen }: { row: TimeRow; date: string; onOpen: () => void }) {
  const has = !!row.notes?.[date];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${has ? 'Edit the note' : 'Add a note'} for ${rowName(row)} on ${dayName(date, true)}`}
      title={has ? row.notes?.[date] : 'Add a note'}
      className={cn('grid h-11 w-9 shrink-0 place-items-center rounded-md hover:bg-accent sm:h-7 sm:w-7', has ? 'text-primary' : 'text-muted-foreground/60')}
    >
      <MessageSquare className={cn('h-3.5 w-3.5', has && 'fill-current')} aria-hidden />
    </button>
  );
}

function RowLabel({ row, project, editable, onBillable }: { row: TimeRow; project?: Project; editable: boolean; onBillable: SheetProps['onBillable'] }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{rowName(row)}</p>
      {row.task_title && <p className="truncate text-xs text-muted-foreground">{row.task_title}</p>}
      <Billable row={row} project={project} editable={editable} onBillable={onBillable} />
    </div>
  );
}

/** The desktop grid: rows by project and task, a column per day, totals by row and by day. */
export function WeekGrid({ week, editable, projects, today, onSet, onBillable }: SheetProps) {
  const [noteFor, setNoteFor] = useState<{ row: TimeRow; date: string } | null>(null);
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card" data-testid="week-grid">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="w-56 px-3 py-2 text-left font-medium">
              Project and task
            </th>
            {week.days.map((d) => (
              <th key={d} scope="col" className={cn('px-1 py-2 text-center font-medium', d === today && 'text-primary')}>
                {dayName(d)}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {week.rows.map((r) => {
            const key = rowKey(r.project_id, r.task_id);
            const writable = rowWritable(r, editable);
            return (
              <tr key={key} className="border-b border-border last:border-0" data-testid={`row-${key}`}>
                <th scope="row" className="px-3 py-2 text-left align-top font-normal">
                  <RowLabel row={r} project={r.project_id ? projects.get(r.project_id) : undefined} editable={editable} onBillable={onBillable} />
                </th>
                {week.days.map((d) => (
                  <td key={d} className={cn('px-1 py-2 align-top', d === today && 'bg-primary/5')}>
                    {writable ? (
                      <div className="flex items-center gap-0.5">
                        <HourInput value={r.hours[d]} label={`${rowName(r)}${r.task_title ? `, ${r.task_title}` : ''} on ${dayName(d, true)}`} onCommit={(h) => onSet(r, d, h)} />
                        <NoteButton row={r} date={d} onOpen={() => setNoteFor({ row: r, date: d })} />
                      </div>
                    ) : (
                      <p className="py-2 text-center tabular-nums" title={r.notes?.[d]}>
                        {formatHours(r.hours[d]) || <span className="text-muted-foreground/50">0</span>}
                      </p>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right align-top font-medium tabular-nums">{formatTotal(r.total)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/40 font-medium">
            <th scope="row" className="px-3 py-2 text-left">
              Day total
            </th>
            {week.days.map((d) => (
              <td key={d} className="px-1 py-2 text-center tabular-nums" data-testid={`day-total-${d}`}>
                {formatTotal(week.day_totals[d])}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums" data-testid="week-total">
              {formatTotal(week.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <NoteDialog target={noteFor} onClose={() => setNoteFor(null)} onSave={(h, note) => noteFor && onSet(noteFor.row, noteFor.date, h, note)} />
    </div>
  );
}

/** The phone list: pick a day from the strip, then that day's hours on every row. */
export function DayList({ week, editable, projects, today, onSet, onBillable }: SheetProps) {
  const [day, setDay] = useState(() => (week.days.includes(today) ? today : week.days[0]));
  const shown = week.days.includes(day) ? day : week.days[0];
  const [noteFor, setNoteFor] = useState<{ row: TimeRow; date: string } | null>(null);
  return (
    <div className="space-y-3" data-testid="day-list">
      <div role="tablist" aria-label="Day" className="grid grid-cols-7 gap-1">
        {week.days.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === shown}
            aria-label={`${dayName(d, true)}, ${formatTotal(week.day_totals[d])} hours`}
            onClick={() => setDay(d)}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center rounded-md border text-xs',
              d === shown ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card',
              d === today && d !== shown && 'border-primary/40',
            )}
          >
            <span>{dayName(d).split(' ')[0]}</span>
            <span className="font-semibold tabular-nums">{formatTotal(week.day_totals[d])}</span>
          </button>
        ))}
      </div>
      <h2 className="flex items-center justify-between text-sm font-semibold">
        {dayName(shown, true)}
        <span className="tabular-nums text-muted-foreground">{formatTotal(week.day_totals[shown])} h</span>
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {week.rows.map((r) => {
          const key = rowKey(r.project_id, r.task_id);
          const writable = rowWritable(r, editable);
          return (
            <li key={key} className="flex items-center gap-2 px-3 py-2" data-testid={`row-${key}`}>
              <div className="min-w-0 flex-1">
                <RowLabel row={r} project={r.project_id ? projects.get(r.project_id) : undefined} editable={editable} onBillable={onBillable} />
                {r.notes?.[shown] && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.notes[shown]}</p>}
              </div>
              {writable ? (
                <>
                  <HourInput className="w-16 shrink-0" value={r.hours[shown]} label={`${rowName(r)}${r.task_title ? `, ${r.task_title}` : ''} on ${dayName(shown, true)}`} onCommit={(h) => onSet(r, shown, h)} />
                  <NoteButton row={r} date={shown} onOpen={() => setNoteFor({ row: r, date: shown })} />
                </>
              ) : (
                <span className="shrink-0 tabular-nums">{formatTotal(r.hours[shown])}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="flex justify-between rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
        Week total <span className="tabular-nums" data-testid="week-total-phone">{formatTotal(week.total)} h</span>
      </p>
      <NoteDialog target={noteFor} onClose={() => setNoteFor(null)} onSave={(h, note) => noteFor && onSet(noteFor.row, noteFor.date, h, note)} />
    </div>
  );
}

/**
 * Adds a row: a project I can see, then optionally one of its tasks. The row stays on the page
 * until a cell gets hours, which writes it to ERP.
 */
export function AddRow({ orgSlug, projects, rows, onAdd }: { orgSlug: string; projects: Project[]; rows: TimeRow[]; onAdd: (row: TimeRow) => void }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const tasks = useTasks(orgSlug, open ? projectId : '');
  const project = projects.find((p) => p.id === projectId);
  const task = tasks.tasks.find((t) => t.id === taskId);
  const projectOptions: ComboboxOption[] = projects.map((p) => ({ value: p.id, label: p.name }));
  const taskOptions: ComboboxOption[] = tasks.tasks.map((t) => ({ value: t.id, label: t.title }));
  const exists = !!projectId && rows.some((r) => rowKey(r.project_id, r.task_id) === rowKey(projectId, taskId || null));

  if (!open) {
    return (
      <Button variant="outline" className="h-11 sm:h-9" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add a row
      </Button>
    );
  }
  const reset = () => {
    setOpen(false);
    setProjectId('');
    setTaskId('');
  };
  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="add-row">
      <div className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Project</span>
        <SearchableCombobox
          options={projectOptions}
          value={projectId}
          onChange={(v) => {
            setProjectId(v);
            setTaskId('');
          }}
          placeholder="Pick a project"
          searchPlaceholder="Search projects"
          emptyText="No projects you can log time on"
        />
      </div>
      <div className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Task (optional)</span>
        <SearchableCombobox
          options={taskOptions}
          value={taskId}
          onChange={setTaskId}
          disabled={!projectId}
          loading={tasks.isLoading && !!projectId}
          hasMore={!!tasks.hasNextPage}
          onLoadMore={() => void tasks.fetchNextPage()}
          placeholder={projectId ? 'The whole project' : 'Pick a project first'}
          searchPlaceholder="Search tasks"
          emptyText="No tasks on this project"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 sm:h-9" onClick={reset}>
          Cancel
        </Button>
        <Button
          className="h-11 flex-1 sm:h-9"
          disabled={!project || exists}
          title={exists ? 'That row is already on the week' : undefined}
          onClick={() => {
            if (!project) return;
            onAdd(draftRow(project.id, project.name, billsHours(project.metadata), task?.id, task?.title));
            reset();
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
