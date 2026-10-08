'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { addDays, format, isAfter, isBefore, subDays } from 'date-fns';
import { ArrowLeft, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useProject, useProjectSummary } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useMilestones } from '@/hooks/useMilestones';
import { useProjectActivities } from '@/hooks/useActivities';
import { useProjectFinancials } from '@/hooks/useFinancials';
import { useMe } from '@/hooks/useMe';
import { numOf, type ProjectFinancials } from '@/lib/api/financials';
import { describe, who } from '@/components/collab/activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { formatCompact } from '@/lib/utils';
import type { Activity, Milestone, Task } from '@/types';

const PERIODS = [7, 14, 30] as const;
/** How far ahead "coming up" looks. */
const LOOKAHEAD_DAYS = 14;

const d = (v?: string) => (v ? new Date(v) : undefined);
const fmt = (v?: string) => (v ? format(new Date(v), 'MMM d, yyyy') : '—');

type Health = 'green' | 'amber' | 'red';
const HEALTH_LABEL: Record<Health, string> = { green: 'On track', amber: 'Needs attention', red: 'At risk' };
const HEALTH_STYLE: Record<Health, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200',
};

/**
 * overallHealth uses the earned-value health when there is a budget; otherwise it reads the
 * schedule: missed milestones or a large share of overdue tasks mark the project at risk.
 */
function overallHealth(
  fin: ProjectFinancials | undefined,
  overdueTasks: number,
  openTasks: number,
  missedMilestones: number
): { health: Health; reason: string } {
  if (fin && fin.evm.health !== 'none') {
    return { health: fin.evm.health, reason: fin.evm.health_reason ?? 'From earned value (cost and schedule indices).' };
  }
  const share = openTasks > 0 ? overdueTasks / openTasks : 0;
  if (missedMilestones > 0 || share >= 0.25) {
    return { health: 'red', reason: `${missedMilestones} missed milestone(s), ${overdueTasks} overdue task(s).` };
  }
  if (overdueTasks > 0) return { health: 'amber', reason: `${overdueTasks} overdue task(s).` };
  return { health: 'green', reason: 'No overdue tasks or missed milestones.' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TaskList({ tasks, empty, dateOf }: { tasks: Task[]; empty: string; dateOf: (t: Task) => string | undefined }) {
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3">
          <span className="truncate">{t.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{fmt(dateOf(t))}</span>
        </li>
      ))}
    </ul>
  );
}

function MilestoneList({ items, empty }: { items: Milestone[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3">
          <span className="truncate">{m.name}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {fmt(m.completed_at ?? m.target_date)}
            <Badge status={m.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function StatusReportPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);

  const hasBudgetTracking = useFeature('budget_tracking');
  const { user } = useMe();
  const project = useProject(orgSlug, projectId);
  const summary = useProjectSummary(orgSlug, projectId);
  const tasksQ = useTasks(orgSlug, projectId, { limit: 100 });
  const milestonesQ = useMilestones(orgSlug, projectId);
  const activitiesQ = useProjectActivities(orgSlug, projectId);
  const finQ = useProjectFinancials(orgSlug, projectId, hasBudgetTracking);

  const report = useMemo(() => {
    const now = new Date();
    const since = subDays(now, period);
    const until = addDays(now, LOOKAHEAD_DAYS);
    const tasks = tasksQ.data?.data ?? [];
    const milestones = milestonesQ.data?.data ?? [];
    const activities: Activity[] = activitiesQ.data?.data ?? [];

    const open = tasks.filter((t) => t.status !== 'done');
    const completed = tasks
      .filter((t) => t.status === 'done' && d(t.completed_at) && isAfter(d(t.completed_at)!, since))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    const overdue = open
      .filter((t) => d(t.due_date) && isBefore(d(t.due_date)!, now))
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const upcoming = open
      .filter((t) => d(t.due_date) && !isBefore(d(t.due_date)!, now) && isBefore(d(t.due_date)!, until))
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const inProgress = open.filter((t) => t.status === 'in_progress' || t.status === 'review');

    const msDone = milestones.filter(
      (m) => m.status === 'completed' && d(m.completed_at) && isAfter(d(m.completed_at)!, since)
    );
    const msMissed = milestones.filter(
      (m) => m.status === 'missed' || (m.status !== 'completed' && d(m.target_date) && isBefore(d(m.target_date)!, now))
    );
    const msNext = milestones
      .filter(
        (m) =>
          m.status !== 'completed' &&
          d(m.target_date) &&
          !isBefore(d(m.target_date)!, now) &&
          isBefore(d(m.target_date)!, addDays(now, 30))
      )
      .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));

    const recent = activities.filter((a) => isAfter(new Date(a.occurred_at), since));
    return { since, tasks, open, completed, overdue, upcoming, inProgress, msDone, msMissed, msNext, recent };
  }, [period, tasksQ.data, milestonesQ.data, activitiesQ.data]);

  if (project.isLoading || tasksQ.isLoading || milestonesQ.isLoading) return <PageLoading />;
  if (project.isError || !project.data) return <ErrorBanner message="Failed to load project." />;

  const p = project.data;
  const fin = hasBudgetTracking ? finQ.data : undefined;
  const total = summary.data?.total_tasks ?? report.tasks.length;
  const done = summary.data?.completed_tasks ?? report.tasks.filter((t) => t.status === 'done').length;
  const progress = summary.data?.progress ?? (total > 0 ? Math.round((done / total) * 100) : 0);
  const { health, reason } = overallHealth(fin, report.overdue.length, report.open.length, report.msMissed.length);
  const truncated = (tasksQ.data?.total ?? 0) > report.tasks.length;
  const cur = fin?.currency || p.currency || 'KES';

  function asText(): string {
    const lines = [
      `Status report: ${p.name}`,
      `Period: ${format(report.since, 'MMM d')} to ${format(new Date(), 'MMM d, yyyy')}`,
      `Overall: ${HEALTH_LABEL[health]} (${reason})`,
      `Progress: ${progress}% (${done}/${total} tasks done)`,
      '',
      `Completed this period (${report.completed.length}):`,
      ...report.completed.map((t) => `- ${t.title}`),
      '',
      `Overdue (${report.overdue.length}):`,
      ...report.overdue.map((t) => `- ${t.title} (due ${fmt(t.due_date)})`),
      '',
      `Due in the next ${LOOKAHEAD_DAYS} days (${report.upcoming.length}):`,
      ...report.upcoming.map((t) => `- ${t.title} (due ${fmt(t.due_date)})`),
      '',
      `Milestones reached: ${report.msDone.map((m) => m.name).join(', ') || 'none'}`,
      `Milestones missed: ${report.msMissed.map((m) => m.name).join(', ') || 'none'}`,
      `Next milestones: ${report.msNext.map((m) => `${m.name} (${fmt(m.target_date)})`).join(', ') || 'none'}`,
    ];
    if (fin?.money) {
      lines.push(
        '',
        `Budget: ${formatCompact(numOf(fin.money.budget_cost), cur)}, spent ${formatCompact(numOf(fin.money.actual_cost), cur)}, committed ${formatCompact(numOf(fin.money.committed), cur)}`,
        `CPI ${fin.evm.cpi ? fin.evm.cpi.toFixed(2) : '—'}, SPI ${fin.evm.spi ? fin.evm.spi.toFixed(2) : '—'}`
      );
    }
    if (fin?.hours) lines.push(`Hours: ${fin.hours.logged.toFixed(1)} logged of ${fin.hours.estimated.toFixed(0)} estimated`);
    return lines.join('\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText());
      toast.success('Report copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/${orgSlug}/projects/${projectId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {p.name}
        </Link>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value) as (typeof PERIODS)[number])}
            className="border border-border rounded-md px-2 py-1.5 text-sm"
            aria-label="Report period"
          >
            {PERIODS.map((n) => (
              <option key={n} value={n}>Last {n} days</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="h-4 w-4" />
            Copy text
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status report</p>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-muted-foreground">
            {format(report.since, 'MMM d')} to {format(new Date(), 'MMM d, yyyy')}
            {user?.fullName ? ` · prepared by ${user.fullName}` : ''}
          </p>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-sm ${HEALTH_STYLE[health]}`}>
          <p className="font-semibold">{HEALTH_LABEL[health]}</p>
          <p className="text-xs">{reason}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Progress', value: `${progress}%`, hint: `${done}/${total} tasks done` },
          { label: 'Completed this period', value: String(report.completed.length) },
          { label: 'Overdue tasks', value: String(report.overdue.length), tone: report.overdue.length ? 'text-red-600' : '' },
          { label: 'In progress', value: String(report.inProgress.length) },
        ].map((s) => (
          <Card key={s.label} className="print:shadow-none">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg font-bold ${s.tone ?? ''}`}>{s.value}</p>
              {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Task lists cover the first {report.tasks.length} of {tasksQ.data?.total} tasks.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
        <Section title={`Completed in the last ${period} days`}>
          <TaskList tasks={report.completed} empty="No tasks completed in this period." dateOf={(t) => t.completed_at} />
        </Section>
        <Section title="Overdue">
          <TaskList tasks={report.overdue} empty="Nothing overdue." dateOf={(t) => t.due_date} />
        </Section>
        <Section title={`Due in the next ${LOOKAHEAD_DAYS} days`}>
          <TaskList tasks={report.upcoming} empty="Nothing due soon." dateOf={(t) => t.due_date} />
        </Section>
        <Section title="Milestones">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Reached this period</p>
              <MilestoneList items={report.msDone} empty="None." />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Missed or past target</p>
              <MilestoneList items={report.msMissed} empty="None." />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Next 30 days</p>
              <MilestoneList items={report.msNext} empty="None scheduled." />
            </div>
          </div>
        </Section>
      </div>

      {fin && (
        <Section title="Budget and effort">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            {fin.money ? (
              <>
                <div>
                  <dt className="text-xs text-muted-foreground">Budget</dt>
                  <dd className="font-medium">{formatCompact(numOf(fin.money.budget_cost), cur)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Spent</dt>
                  <dd className="font-medium">{formatCompact(numOf(fin.money.actual_cost), cur)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Committed</dt>
                  <dd className="font-medium">{formatCompact(numOf(fin.money.committed), cur)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CPI / SPI</dt>
                  <dd className="font-medium">
                    {fin.evm.cpi ? fin.evm.cpi.toFixed(2) : '—'} / {fin.evm.spi ? fin.evm.spi.toFixed(2) : '—'}
                  </dd>
                </div>
              </>
            ) : (
              <p className="col-span-full text-sm text-muted-foreground">
                {fin.money_error ? 'Budget figures are unavailable right now.' : 'No budget has been set for this project.'}
              </p>
            )}
            {fin.hours && (
              <div>
                <dt className="text-xs text-muted-foreground">Hours logged</dt>
                <dd className="font-medium">
                  {fin.hours.logged.toFixed(1)} of {fin.hours.estimated.toFixed(0)} h
                </dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      <Section title={`Activity in the last ${period} days`}>
        {report.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded activity in this period.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {report.recent.slice(0, 25).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="truncate">
                  <span className="font-medium">{who(a.user_id, user?.id)}</span> {describe(a).text}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(a.occurred_at), 'MMM d')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
