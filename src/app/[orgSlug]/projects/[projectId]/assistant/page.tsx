'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, ClipboardCopy, FileText, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { AIErrorBlock, AIWorking, DraftNotice } from '@/components/ai/ai-parts';
import { aiError, useApplyEstimate, useEstimates, useStatusSummary } from '@/hooks/useAI';
import { useTasks } from '@/hooks/useTasks';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { HEALTH_CLASS, HEALTH_LABEL, hoursLabel, newRequestKey, summaryText, tasksNeedingEstimates } from '@/lib/ai/drafts';
import { cn } from '@/lib/utils';

const PERIODS = [7, 14, 30];

/**
 * The project's AI assistant (sprint 10): a status summary draft and effort estimates for tasks
 * without one. Both are drafts: the summary is copied by the person, an estimate is saved only when
 * they press Use. Task drafts and risk suggestions sit on the Tasks and Risks pages.
 */
export default function AssistantPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const { can } = useServicePermissions();
  const canAsk = can(PERMS.aiAdd);
  const canEstimate = canAsk && can(PERMS.tasksView);
  const canSaveEstimate = can(PERMS.tasksChange);

  const [period, setPeriod] = useState(14);
  const summary = useStatusSummary(orgSlug, projectId);
  const summaryErr = aiError(summary.error);
  const [copied, setCopied] = useState(false);

  const tasks = useTasks(orgSlug, projectId);
  const missing = useMemo(() => tasksNeedingEstimates(tasks.tasks), [tasks.tasks]);
  const estimates = useEstimates(orgSlug, projectId);
  const estimatesErr = aiError(estimates.error);
  const apply = useApplyEstimate(orgSlug, projectId);
  const [applied, setApplied] = useState<string[]>([]);

  const copy = async () => {
    if (!summary.data) return;
    const text = `${HEALTH_LABEL[summary.data.health]}\n\n${summaryText(summary.data)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Summary copied');
    } catch {
      toast.error('Copy is not available here; select the text instead.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assistant"
        subtitle="Drafts from this project's own data, paid from your AI credits"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
      />
      {!canAsk && <p className="text-sm text-muted-foreground">Your role does not include the AI assistant. Ask a projects administrator.</p>}

      {canAsk && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" aria-hidden />
              Status summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">A narrative for a status report, from the tasks, milestones and risks of the period.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border p-0.5" role="radiogroup" aria-label="Period">
                {PERIODS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={period === d}
                    onClick={() => setPeriod(d)}
                    className={cn('h-10 rounded px-3 text-sm sm:h-8', period === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
                  >
                    {d} days
                  </button>
                ))}
              </div>
              <Button
                className="h-11 sm:h-9"
                disabled={summary.isPending}
                onClick={() => {
                  setCopied(false);
                  summary.mutate({ periodDays: period, key: newRequestKey() });
                }}
              >
                {summary.data ? 'Draft again' : 'Draft summary'}
              </Button>
            </div>
            {summary.isPending && <AIWorking text="Reading the project..." />}
            {summaryErr && !summary.isPending && (
              <AIErrorBlock info={summaryErr} onRetry={() => summary.variables && summary.mutate(summary.variables)} />
            )}
            {summary.data && !summary.isPending && (
              <section className="space-y-3" aria-label="Summary draft" data-testid="summary-draft">
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', HEALTH_CLASS[summary.data.health])}>
                  {HEALTH_LABEL[summary.data.health]}
                </span>
                <p className="whitespace-pre-line text-sm">{summary.data.summary}</p>
                {(
                  [
                    ['Done in the period', summary.data.accomplishments],
                    ['Next steps', summary.data.next_steps],
                    ['Issues', summary.data.issues],
                  ] as const
                ).map(([title, items]) =>
                  items.length ? (
                    <div key={title}>
                      <h3 className="text-sm font-medium">{title}</h3>
                      <ul className="list-disc pl-5 text-sm">
                        {items.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
                {!summary.data.includes_financials && <p className="text-xs text-muted-foreground">Budget figures were left out.</p>}
                <DraftNotice credits={summary.data.credits} review={summary.data} />
                <Button variant="outline" className="h-11 sm:h-9" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <ClipboardCopy className="h-4 w-4" aria-hidden />}
                  Copy text
                </Button>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {canEstimate && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4" aria-hidden />
              Effort estimates
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Suggested hours for open tasks without an estimate, kept in line with the estimates this project already has.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {tasks.isLoading ? 'Counting tasks...' : missing.length === 0 ? 'Every open task has an estimate.' : `${missing.length} open ${missing.length === 1 ? 'task has' : 'tasks have'} no estimate${missing.length === 20 ? ' (the first 20 are used)' : ''}.`}
            </p>
            <Button
              className="h-11 sm:h-9"
              disabled={estimates.isPending || missing.length === 0}
              onClick={() => {
                setApplied([]);
                estimates.mutate({ taskIds: missing, key: newRequestKey() });
              }}
            >
              Suggest estimates
            </Button>
            {estimates.isPending && <AIWorking text="Estimating..." />}
            {estimatesErr && !estimates.isPending && (
              <AIErrorBlock info={estimatesErr} onRetry={() => estimates.variables && estimates.mutate(estimates.variables)} />
            )}
            {estimates.data && !estimates.isPending && (
              <section className="space-y-3" aria-label="Estimate drafts">
                <ul className="divide-y divide-border rounded-md border border-border">
                  {estimates.data.estimates.map((e) => (
                    <li key={e.task_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center" data-testid="draft-estimate">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {hoursLabel(e.estimated_hours)}, {e.confidence} confidence. {e.reasoning}
                        </p>
                      </div>
                      {canSaveEstimate &&
                        (applied.includes(e.task_id) ? (
                          <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                            <Check className="h-4 w-4" aria-hidden />
                            Saved
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            className="h-11 sm:h-8"
                            disabled={apply.isPending}
                            onClick={() =>
                              apply.mutate({ taskId: e.task_id, hours: e.estimated_hours }, { onSuccess: () => setApplied((cur) => [...cur, e.task_id]) })
                            }
                            aria-label={`Use ${hoursLabel(e.estimated_hours)} for ${e.title}`}
                          >
                            Use {hoursLabel(e.estimated_hours)}
                          </Button>
                        ))}
                    </li>
                  ))}
                </ul>
                <DraftNotice credits={estimates.data.credits} review={estimates.data} />
              </section>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
