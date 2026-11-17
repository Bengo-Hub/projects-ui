'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, Send, UserX } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { useOnlineStatus } from '@bengo-hub/shared-ui-lib/offline';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CountRow, ListError } from '@/components/common/list-parts';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { AddRow, DayList, WeekGrid, type SheetProps } from '@/components/time/timesheet';
import { useProjects } from '@/hooks/useProjects';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NO_EMPLOYEE_TEXT, useBrowserTimeZone, usePutEntry, useSubmitWeek, useTimeAccess, useTimePeople, useWeek, weekKey } from '@/hooks/useTime';
import {
  WEEK_STATUS_LABEL,
  addDays,
  canSubmitWeek,
  formatTotal,
  loggedDays,
  mondayOf,
  timeErrorCode,
  todayIn,
  weekLabel,
  withDraftRows,
  type TimeRow,
  type WeekStatus,
} from '@/lib/work/time';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<WeekStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  mixed: 'bg-yellow-100 text-yellow-800',
};

/** Projects per page of the list; the add row picker and the billable switch read them. */
const PROJECTS_LIMIT = 100;

/**
 * My week of time (US-13.2): hours per project, task and day from my ERP timesheet, edited in place
 * (offline too), with notes, the billable switch on time and materials projects and submit. People
 * with projects.time.view pick someone else's week; projects.time.manage edits it.
 */
export default function TimePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const access = useTimeAccess();
  const tz = useBrowserTimeZone();
  const today = useMemo(() => todayIn(tz), [tz]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [person, setPerson] = useState('');
  const self = !person || person === access.me;
  const userId = self ? undefined : person;

  const query = useWeek(orgSlug, weekStart, tz, userId, access.canView);
  const projectsQuery = useProjects(orgSlug, { limit: PROJECTS_LIMIT }, access.canView);
  const projectList = useMemo(() => projectsQuery.data?.data ?? [], [projectsQuery.data]);
  const projects = useMemo(() => new Map<string, Project>(projectList.map((p) => [p.id, p])), [projectList]);
  const { people, search: searchPeople } = useTimePeople(orgSlug, access.canViewOthers);
  const put = usePutEntry(orgSlug, weekKey(orgSlug, weekStart, tz, userId));
  const submit = useSubmitWeek(orgSlug, tz);
  const online = useOnlineStatus();
  const wide = useMediaQuery('(min-width: 768px)');
  const [drafts, setDrafts] = useState<TimeRow[]>([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  if (!access.isLoading && !access.plan) {
    return <FeatureLocked title="Time tracking is not on your plan" description="Logging time needs time tracking and ERP attendance on your plan, as the hours go to ERP timesheets." />;
  }

  const base = query.week;
  const week = base ? withDraftRows(base, drafts) : undefined;
  const editable = !!week?.editable && (self ? access.canLog : access.canLogForOthers);

  const goTo = (start: string) => {
    setWeekStart(start);
    setDrafts([]);
  };

  const onSet: SheetProps['onSet'] = (row, date, hours, note) => {
    if (!row.project_id) return;
    put.mutate({
      entry: {
        project_id: row.project_id,
        ...(row.task_id ? { task_id: row.task_id } : {}),
        date,
        hours,
        ...(note !== undefined ? { note } : row.notes?.[date] ? { note: row.notes[date] } : {}),
        billable: row.billable,
        ...(userId ? { user_id: userId } : {}),
      },
      names: { project_name: row.project_name, task_title: row.task_title },
    });
  };

  // The switch re-sends each logged day with the new flag; a row with no hours yet only changes here.
  const onBillable: SheetProps['onBillable'] = (row, billable) => {
    const days = week ? loggedDays(row, week.days) : [];
    if (days.length === 0) {
      setDrafts((all) => all.map((d) => (d.project_id === row.project_id && (d.task_id ?? null) === (row.task_id ?? null) ? { ...d, billable } : d)));
      return;
    }
    for (const d of days) onSet({ ...row, billable }, d, row.hours[d] ?? 0);
  };

  const err = query.error;
  const code = timeErrorCode(err);
  const personOptions: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.name }));
  const rejected = week?.timesheets.find((t) => t.status === 'rejected' && t.rejection_reason);
  const sheet: SheetProps | null = week ? { week, editable, projects, today, onSet, onBillable } : null;
  const isThisWeek = weekStart === mondayOf(today);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Time"
        subtitle={self ? 'Your hours by project and day. They go to your ERP timesheet, where the week is approved.' : 'Hours by project and day from their ERP timesheet.'}
        className="mb-0"
        actions={
          self && access.canLog && week && canSubmitWeek(week) ? (
            <Button className="h-11 sm:h-9" disabled={!online || submit.isPending} title={online ? undefined : 'Submitting needs a connection'} onClick={() => setConfirmSubmit(true)}>
              <Send className="h-4 w-4" aria-hidden />
              Submit week
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Previous week" onClick={() => goTo(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="min-w-44 px-2 text-center text-sm font-medium" data-testid="week-label">
            {weekLabel(weekStart)}
          </span>
          <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Next week" onClick={() => goTo(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {!isThisWeek && (
          <Button variant="ghost" className="h-11 sm:h-9" onClick={() => goTo(mondayOf(today))}>
            This week
          </Button>
        )}
        {week && (
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLASS[week.status] ?? STATUS_CLASS.none)} data-testid="week-status">
            {WEEK_STATUS_LABEL[week.status] ?? week.status}
          </span>
        )}
        {access.canViewOthers && (
          <div className="w-full sm:ml-auto sm:w-64">
            <SearchableCombobox
              options={personOptions}
              value={person || access.me}
              onChange={(v) => {
                setPerson(v === access.me ? '' : v);
                setDrafts([]);
              }}
              clearable={false}
              placeholder="Whose week"
              searchPlaceholder="Search people"
              emptyText="No one found"
              onRemoteSearch={async (q) => (await searchPeople(q)).map((p) => ({ value: p.userId, label: p.name }))}
            />
          </div>
        )}
      </div>

      {rejected && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          Sent back in ERP: {rejected.rejection_reason}
        </p>
      )}

      {code === 'no_employee_record' ? (
        <EmptyState
          icon={UserX}
          title="No employee record"
          description={self ? NO_EMPLOYEE_TEXT : 'This person has no employee record in ERP. Ask HR to link it.'}
          className="rounded-md border border-dashed border-border"
        />
      ) : err ? (
        <ListError error={err} title="This week could not be loaded" forbidden="Your role does not include this person's time." onRetry={() => void query.refetch()} />
      ) : !week || !sheet ? (
        <div className="h-64 animate-pulse rounded-md bg-muted" aria-busy="true" />
      ) : (
        <>
          <CountRow
            items={[
              { label: 'Hours this week', value: formatTotal(week.total) },
              { label: 'Billable hours', value: formatTotal(week.billable_total) },
            ]}
          />
          {!week.editable && week.status !== 'none' && (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              This week is {WEEK_STATUS_LABEL[week.status].toLowerCase()} in ERP, so its hours cannot be changed here.
            </p>
          )}
          {week.rows.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nothing logged this week"
              description={editable ? 'Add a row to type hours, or start a timer on a task.' : 'No hours on this week yet.'}
              className="rounded-md border border-dashed border-border py-10"
            />
          ) : wide === undefined ? (
            <>
              <div className="hidden md:block">
                <WeekGrid {...sheet} />
              </div>
              <div className="md:hidden">
                <DayList {...sheet} />
              </div>
            </>
          ) : wide ? (
            <WeekGrid {...sheet} />
          ) : (
            <DayList {...sheet} />
          )}
          {editable && <AddRow orgSlug={orgSlug} projects={projectList} rows={week.rows} onAdd={(row) => setDrafts((all) => [...all, row])} />}
        </>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        variant="info"
        title="Submit this week?"
        description={week ? `You logged ${formatTotal(week.total)} hours from ${weekLabel(weekStart)}. Once submitted the week is locked until it is approved or sent back in ERP.` : undefined}
        confirmLabel="Submit week"
        loading={submit.isPending}
        onConfirm={() => submit.mutate(weekStart, { onSettled: () => setConfirmSubmit(false) })}
      />
    </div>
  );
}
