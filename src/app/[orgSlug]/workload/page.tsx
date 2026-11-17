'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Info, Settings2, Users } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ListFilters } from '@/components/common/list-parts';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { useWorkload } from '@/hooks/useWorkload';
import { useProjects } from '@/hooks/useProjects';
import { useServicePermissions } from '@/hooks/usePermissions';
import { forbiddenKind } from '@/lib/api/errors';
import type { PersonLoad, Workload } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import { HEAT_CLASS, HEAT_LABEL, addWeeks, capacityNote, capacitySourceText, cellText, clampWeeks, heatBand, hoursText, mondayOf, thisMonday, weekLabel, type HeatBand } from '@/lib/planning/workload';
import { cn } from '@/lib/utils';
import { CellSheet, type CellRef } from './cell-sheet';
import { SettingsDialog } from './settings-dialog';

const WEEK_OPTIONS: ComboboxOption[] = [4, 8, 12, 26].map((n) => ({ value: String(n), label: `${n} weeks` }));
const inputClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm';

interface CellData {
  week: string;
  demand: number;
  capacity: number;
  pct: number;
  overloaded: boolean;
  tasks: number;
}

function cellsOf(p: PersonLoad, weeks: string[]): CellData[] {
  return weeks.map((w) => {
    const c = p.weeks.find((x) => x.week_start === w);
    return { week: w, demand: c?.demand_hours ?? 0, capacity: c?.capacity_hours ?? p.weekly_capacity, pct: c?.load_pct ?? 0, overloaded: !!c?.overloaded, tasks: c?.task_count ?? 0 };
  });
}

function unassignedCells(data: Workload): CellData[] {
  return data.weeks.map((w) => {
    const u = data.unassigned.find((x) => x.week_start === w);
    return { week: w, demand: u?.demand_hours ?? 0, capacity: 0, pct: 0, overloaded: false, tasks: u?.task_count ?? 0 };
  });
}

function cellLabel(who: string, c: CellData, unassigned: boolean): string {
  const base = `${who}, ${weekLabel(c.week)}: ${hoursText(c.demand)}`;
  if (unassigned) return `${base} not assigned, ${c.tasks} ${c.tasks === 1 ? 'task' : 'tasks'}`;
  return `${base} of ${hoursText(c.capacity)}${c.overloaded ? ', overloaded' : ''}`;
}

function bandOf(c: CellData, unassigned: boolean): HeatBand {
  if (unassigned) return c.demand > 0 ? 'high' : 'none';
  return heatBand(c.pct, c.overloaded, c.demand);
}

function Legend() {
  const bands: HeatBand[] = ['light', 'medium', 'high', 'full', 'over'];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Colour key">
      {bands.map((b) => (
        <li key={b} className="inline-flex items-center gap-1.5">
          <span className={cn('h-3 w-5 rounded-sm', HEAT_CLASS[b])} aria-hidden />
          {HEAT_LABEL[b]}
        </li>
      ))}
    </ul>
  );
}

/** Desktop and tablet: people down the side, weeks across, each cell opening its tasks. */
function Grid({ data, onOpen }: { data: Workload; onOpen: (c: CellRef) => void }) {
  const unassigned = unassignedCells(data);
  const anyUnassigned = unassigned.some((c) => c.demand > 0);
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card" data-testid="workload-grid">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-10 min-w-48 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Person
            </th>
            {data.weeks.map((w) => (
              <th key={w} scope="col" className="min-w-20 px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                {weekLabel(w)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.people.map((p) => (
            <tr key={p.user_id} className="border-b border-border/60" data-testid={`workload-row-${p.user_id}`}>
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal">
                <span className="block truncate font-medium">{p.name || p.email || 'Unnamed'}</span>
                <span className="block text-xs text-muted-foreground">
                  {hoursText(p.weekly_capacity)} a week
                  {p.overloaded_weeks > 0 && <span className="ml-1 font-medium text-destructive">, {p.overloaded_weeks} over</span>}
                </span>
                <span className="block text-xs text-muted-foreground" data-testid="capacity-source">
                  {capacitySourceText(p)}
                </span>
              </th>
              {cellsOf(p, data.weeks).map((c) => (
                <td key={c.week} className="p-1">
                  <button
                    type="button"
                    onClick={() => onOpen({ userId: p.user_id, who: p.name || p.email, week: c.week })}
                    aria-label={cellLabel(p.name || p.email, c, false)}
                    className={cn('h-11 w-full rounded text-xs tabular-nums transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', HEAT_CLASS[bandOf(c, false)])}
                    data-overloaded={c.overloaded ? 'true' : 'false'}
                  >
                    {cellText({ demand_hours: c.demand, capacity_hours: c.capacity, load_pct: c.pct })}
                    {c.overloaded && <span aria-hidden> !</span>}
                  </button>
                </td>
              ))}
            </tr>
          ))}
          {anyUnassigned && (
            <tr data-testid="workload-unassigned">
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal">
                <span className="block font-medium">Not assigned</span>
                <span className="block text-xs text-muted-foreground">Estimated work nobody has yet</span>
              </th>
              {unassigned.map((c) => (
                <td key={c.week} className="p-1">
                  <button
                    type="button"
                    disabled={c.demand <= 0}
                    onClick={() => onOpen({ userId: 'unassigned', who: 'Not assigned', week: c.week })}
                    aria-label={cellLabel('Not assigned', c, true)}
                    className={cn('h-11 w-full rounded text-xs tabular-nums hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100', HEAT_CLASS[bandOf(c, true)])}
                  >
                    {c.demand > 0 ? hoursText(c.demand) : '-'}
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Phone: one person at a time, the weeks as a list. */
function PersonCards({ data, onOpen }: { data: Workload; onOpen: (c: CellRef) => void }) {
  const rows = useMemo(() => {
    const list: { id: string; name: string; cells: CellData[]; unassigned: boolean; sub: string }[] = data.people.map((p) => ({
      id: p.user_id,
      name: p.name || p.email || 'Unnamed',
      cells: cellsOf(p, data.weeks),
      unassigned: false,
      sub: `${hoursText(p.weekly_capacity)} a week (${capacitySourceText(p)})${p.overloaded_weeks > 0 ? `, ${p.overloaded_weeks} ${p.overloaded_weeks === 1 ? 'week' : 'weeks'} over` : ''}`,
    }));
    const un = unassignedCells(data);
    if (un.some((c) => c.demand > 0)) list.push({ id: 'unassigned', name: 'Not assigned', cells: un, unassigned: true, sub: 'Estimated work nobody has yet' });
    return list;
  }, [data]);
  const [picked, setPicked] = useState('');
  const index = Math.max(0, rows.findIndex((r) => r.id === picked));
  const row = rows[index];
  if (!row) return null;
  const options: ComboboxOption[] = rows.map((r) => ({ value: r.id, label: r.name }));
  return (
    <section className="space-y-3" aria-label="Workload by person" data-testid="workload-cards">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-11 w-11 shrink-0 p-0" disabled={index === 0} onClick={() => setPicked(rows[index - 1].id)} aria-label="Previous person">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <SearchableCombobox options={options} value={row.id} onChange={(v) => v && setPicked(v)} clearable={false} searchPlaceholder="Find a person" />
        </div>
        <Button variant="outline" className="h-11 w-11 shrink-0 p-0" disabled={index >= rows.length - 1} onClick={() => setPicked(rows[index + 1].id)} aria-label="Next person">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {index + 1} of {rows.length}. {row.sub}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {row.cells.map((c) => {
          const band = bandOf(c, row.unassigned);
          const width = row.unassigned ? (c.demand > 0 ? 100 : 0) : Math.min(100, c.pct);
          return (
            <li key={c.week}>
              <button
                type="button"
                disabled={row.unassigned && c.demand <= 0}
                onClick={() => onOpen({ userId: row.id, who: row.name, week: c.week })}
                aria-label={cellLabel(row.name, c, row.unassigned)}
                className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
              >
                <span className="w-24 shrink-0 text-sm">{weekLabel(c.week)}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn('block h-2 rounded-full', HEAT_CLASS[band])} style={{ width: `${width}%` }} />
                </span>
                <span className={cn('w-20 shrink-0 text-right text-sm tabular-nums', c.overloaded && 'font-semibold text-destructive')}>
                  {row.unassigned ? (c.demand > 0 ? hoursText(c.demand) : '-') : cellText({ demand_hours: c.demand, capacity_hours: c.capacity, load_pct: c.pct })}
                  {c.overloaded && <span className="block text-xs">Overloaded</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Team workload (US-16.1): each person's estimated work per ISO week against their capacity, worked
 * out by projects-api. A cell opens its tasks, where a task can be handed to someone else.
 */
export default function WorkloadPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const hasFeature = useFeature('workload_planning');
  const { can } = useServicePermissions();
  const canManage = can(PERMS.workloadManage);

  const [from, setFrom] = useState(() => thisMonday());
  const [weeks, setWeeks] = useState(8);
  const [projectId, setProjectId] = useState('');
  const [includeDone, setIncludeDone] = useState(false);
  const [cell, setCell] = useState<CellRef | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const query = { from, weeks, ...(projectId ? { project_id: projectId } : {}), ...(includeDone ? { include_done: true } : {}) };
  const { data, isLoading, isError, error } = useWorkload(orgSlug, query, hasFeature);
  const projects = useProjects(orgSlug, { limit: 100 }, hasFeature);
  const projectOptions: ComboboxOption[] = (projects.data?.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const header = (
    <PageHeader
      title="Workload"
      subtitle="Estimated hours per person and week against their capacity"
      className="mb-0"
      actions={
        hasFeature && canManage ? (
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Capacity
          </Button>
        ) : undefined
      }
    />
  );

  if (!hasFeature || forbiddenKind(error) === 'subscription') {
    return (
      <div className="space-y-4">
        {header}
        <FeatureLocked title="Workload planning is a premium feature" description="Upgrade your plan to see who is overloaded week by week and rebalance the work." />
      </div>
    );
  }

  const filters = (projectId ? 1 : 0) + (includeDone ? 1 : 0) + (weeks !== 8 ? 1 : 0);

  return (
    <div className="space-y-4">
      {header}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex items-end gap-2">
          <Button variant="outline" className="h-11 w-11 p-0 sm:h-9 sm:w-9" onClick={() => setFrom((f) => addWeeks(f, -1))} aria-label="Earlier week">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <label className="block flex-1 space-y-1 text-sm sm:w-44 sm:flex-none">
            <span className="text-xs text-muted-foreground">From the week of</span>
            <input type="date" className={inputClass} value={from} onChange={(e) => e.target.value && setFrom(mondayOf(e.target.value))} aria-label="From the week of" />
          </label>
          <Button variant="outline" className="h-11 w-11 p-0 sm:h-9 sm:w-9" onClick={() => setFrom((f) => addWeeks(f, 1))} aria-label="Later week">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" className="h-11 sm:h-9" onClick={() => setFrom(thisMonday())}>
            This week
          </Button>
        </div>
        <ListFilters active={filters} className="grid gap-3 sm:flex sm:items-end">
          <div className="sm:w-36">
            <span className="mb-1 block text-xs text-muted-foreground">Weeks</span>
            <SearchableCombobox options={WEEK_OPTIONS} value={String(weeks)} onChange={(v) => v && setWeeks(clampWeeks(Number(v)))} clearable={false} searchPlaceholder="Weeks" />
          </div>
          <div className="sm:w-60">
            <span className="mb-1 block text-xs text-muted-foreground">Project team</span>
            <SearchableCombobox options={projectOptions} value={projectId} onChange={(v) => setProjectId(v ?? '')} placeholder="Everyone" searchPlaceholder="Find a project" />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
            Count done tasks
          </label>
        </ListFilters>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError || !data ? (
        <ErrorBanner message="The workload could not be loaded." />
      ) : data.people.length === 0 && data.unassigned.every((u) => u.demand_hours <= 0) ? (
        <EmptyState icon={Users} title="No one to show" description="Add people to project teams and give tasks an estimate and dates to see the load." />
      ) : (
        <>
          {data.truncated && (
            <div role="status" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span>Only the first 500 people are shown. Pick a project team to narrow it down.</span>
            </div>
          )}
          <div className="hidden sm:block">
            <Grid data={data} onOpen={setCell} />
          </div>
          <div className="sm:hidden">
            <PersonCards key={`${data.from}-${projectId}`} data={data} onOpen={setCell} />
          </div>
          <Legend />
          <p className="text-xs text-muted-foreground">
            Each open task&apos;s estimate is spread over its working days from start to due date and shared by its assignees.{' '}
            {capacityNote(data.capacity_source, hoursText(data.default_weekly_hours), data.erp_unavailable)}
          </p>
        </>
      )}

      <CellSheet orgSlug={orgSlug} cell={cell} includeDone={includeDone} onClose={() => setCell(null)} />
      {settingsOpen && <SettingsDialog orgSlug={orgSlug} people={data?.people ?? []} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
