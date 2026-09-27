'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Lock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useProjectFinancials } from '@/hooks/useFinancials';
import { numOf, type EVM, type ProjectMoney } from '@/lib/api/financials';
import { SCurveChart, CostBarChart, type SCurvePoint } from '@/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { formatCurrency } from '@/lib/utils';

const TREASURY_UI = process.env.NEXT_PUBLIC_TREASURY_UI_URL ?? 'https://books.codevertexafrica.com';

const healthStyle: Record<EVM['health'], string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  none: 'bg-slate-100 text-slate-600 border-slate-200',
};
const healthLabel: Record<EVM['health'], string> = {
  green: 'On track',
  amber: 'Watch',
  red: 'At risk',
  none: 'No budget yet',
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${tone ?? ''}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Index figures: 1.00 is on plan; below 1 is over cost (CPI) or behind (SPI). */
function indexTone(v: number) {
  if (!v) return 'text-muted-foreground';
  if (v < 0.85) return 'text-red-600';
  if (v < 0.95) return 'text-amber-600';
  return 'text-green-600';
}

/** Cumulative planned vs actual spend over every month either series touches. */
function sCurve(money?: ProjectMoney): SCurvePoint[] {
  if (!money) return [];
  const planned = new Map((money.planned_by_month ?? []).map((m) => [m.month, numOf(m.amount)]));
  const actual = new Map((money.monthly_cost ?? []).map((m) => [m.month, numOf(m.amount)]));
  const months = Array.from(new Set([...planned.keys(), ...actual.keys()])).sort();
  let p = 0;
  let a = 0;
  return months.map((month) => {
    p += planned.get(month) ?? 0;
    a += actual.get(month) ?? 0;
    return { month, planned: p, actual: a };
  });
}

export default function ProjectFinancialsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasBudgetTracking = useFeature('budget_tracking');
  const { data, isLoading, isError } = useProjectFinancials(orgSlug, projectId, hasBudgetTracking);

  const curve = useMemo(() => sCurve(data?.money), [data?.money]);
  const categories = useMemo(
    () =>
      (data?.money?.cost_by_category ?? [])
        .slice(0, 8)
        .map((c) => ({ label: c.account_name || c.account_code, amount: numOf(c.amount) })),
    [data?.money],
  );

  const back = (
    <Link
      href={`/${orgSlug}/projects/${projectId}`}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to project
    </Link>
  );

  if (!hasBudgetTracking) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="mx-auto h-6 w-6 text-amber-600" />
            <p className="font-semibold">Project financials are part of Budget Tracking</p>
            <p className="text-sm text-muted-foreground">
              Budget against actual cost, earned value and project profitability come with the Budget Tracking feature.
            </p>
            <a href={UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              See plans
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isLoading) return <PageLoading />;
  if (isError || !data) return <ErrorBanner message="Failed to load project financials." />;

  const money = data.money;
  const evm = data.evm;
  const cur = data.currency || 'KES';
  const budgetCost = numOf(money?.budget_cost);
  const actualCost = numOf(money?.actual_cost);
  const committed = numOf(money?.committed);
  const remaining = budgetCost - actualCost - committed;
  const budgetsHref = `${TREASURY_UI}/${orgSlug}/budgets?project_id=${projectId}`;
  const newBudgetHref = `${TREASURY_UI}/${orgSlug}/budgets?new=1&budget_type=project&project_id=${projectId}`;

  return (
    <div className="space-y-6">
      <div>
        {back}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{data.name}: financials</h1>
            <p className="text-sm text-muted-foreground">
              Budget, cost and earned value. Costs come from the books in Finance, progress from this project's tasks.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${healthStyle[evm.health]}`} title={evm.health_reason}>
            {healthLabel[evm.health]}
            {evm.health_reason ? `: ${evm.health_reason}` : ''}
          </span>
        </div>
      </div>

      {data.money_error && <ErrorBanner message="Finance figures are unavailable right now; progress figures are shown without costs." />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Budget (cost)" value={formatCurrency(budgetCost, cur)} hint={money?.budget_status ? `Budget ${money.budget_status}` : 'No budget'} />
        <Stat label="Spent" value={formatCurrency(actualCost, cur)} hint={`${evm.percent_spent.toFixed(0)}% of budget`} />
        <Stat label="Committed" value={formatCurrency(committed, cur)} hint="Orders and bills not yet booked" />
        <Stat
          label="Remaining"
          value={formatCurrency(remaining, cur)}
          tone={remaining < 0 ? 'text-red-600' : undefined}
          hint={remaining < 0 ? 'Over budget' : 'Budget less spent and committed'}
        />
        <Stat label="Revenue" value={formatCurrency(numOf(money?.actual_revenue), cur)} hint={`Budget ${formatCurrency(numOf(money?.budget_revenue), cur)}`} />
        <Stat
          label="Margin"
          value={formatCurrency(numOf(money?.margin), cur)}
          tone={numOf(money?.margin) < 0 ? 'text-red-600' : 'text-green-700'}
          hint={money && numOf(money.actual_revenue) > 0 ? `${money.margin_pct.toFixed(1)}% of revenue` : undefined}
        />
        <Stat label="Work complete" value={`${evm.percent_complete.toFixed(0)}%`} hint={`Planned by now: ${evm.percent_planned.toFixed(0)}%`} />
        <Stat
          label="Tasks"
          value={`${data.tasks_done}/${data.tasks_total}`}
          tone={data.tasks_overdue > 0 ? 'text-amber-600' : undefined}
          hint={data.tasks_overdue > 0 ? `${data.tasks_overdue} overdue` : 'None overdue'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Earned value</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cost efficiency (CPI)</p>
            <p className={`text-xl font-bold ${indexTone(evm.cpi)}`}>{evm.cpi ? evm.cpi.toFixed(2) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Schedule efficiency (SPI)</p>
            <p className={`text-xl font-bold ${indexTone(evm.spi)}`}>{evm.spi ? evm.spi.toFixed(2) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Earned value</p>
            <p className="font-semibold">{formatCurrency(evm.ev, cur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Planned value</p>
            <p className="font-semibold">{formatCurrency(evm.pv, cur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Forecast at completion</p>
            <p className="font-semibold">{formatCurrency(evm.eac, cur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Variance at completion</p>
            <p className={`font-semibold ${evm.vac < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(evm.vac, cur)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend against plan</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {curve.length ? (
              <SCurveChart data={curve} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No budget or spend yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost by category</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {categories.length ? (
              <CostBarChart data={categories} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No costs booked to this project yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {money?.budget_id
              ? `This project's budget is ${money.budget_status}. Budgets are kept in Finance, where they are phased by month, approved and controlled against spending.`
              : 'This project has no budget yet. Create one in Finance to track spend, commitments and earned value.'}
          </p>
          <a
            href={money?.budget_id ? budgetsHref : newBudgetHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 font-medium hover:bg-muted"
          >
            {money?.budget_id ? 'Open budget in Finance' : 'Create budget in Finance'}
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
