'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, ShieldAlert, ShieldPlus, Trash2, X } from 'lucide-react';
import { RiskSuggestionsSheet } from '@/components/ai/risk-suggestions-sheet';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ListFilters } from '@/components/common/list-parts';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { RiskHeatMap } from '@/components/planning/risk-heat-map';
import { useDeleteRisk, useRiskHeatMap, useRisks } from '@/hooks/useRisks';
import { useProjectPeople } from '@/hooks/usePeople';
import { useServicePermissions } from '@/hooks/usePermissions';
import { isNotFound } from '@/lib/api/errors';
import type { Risk } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import {
  RISK_STATUSES,
  RISK_STATUS_LABEL,
  SCORE_CLASS,
  inCell,
  scoreBand,
  toggleCell,
  type CellFilter,
  type RiskStatusCode,
} from '@/lib/planning/risks';
import { cn } from '@/lib/utils';
import { RiskDialog } from './risk-dialog';

/** One page large enough for a normal register; the heat map filters it in the browser. */
const LIMIT = 500;
const STATUS_OPTIONS: ComboboxOption[] = RISK_STATUSES.map((s) => ({ value: s, label: RISK_STATUS_LABEL[s] }));

/**
 * The project's risk register (US-16.3): every risk with its likelihood, impact, owner and
 * mitigation, highest score first, and the 5x5 heat map whose cells filter the list.
 */
export default function RisksPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const { can } = useServicePermissions();
  const canAdd = can(PERMS.risksAdd);
  const canChange = can(PERMS.risksChange);
  const canDelete = can(PERMS.risksDelete);
  // AI risk suggestions (sprint 10): drafts only, added through the ordinary risk create.
  const canSuggest = canAdd && can(PERMS.aiAdd);
  const [suggesting, setSuggesting] = useState(false);
  const { people, nameOf } = useProjectPeople(orgSlug, projectId);

  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [cell, setCell] = useState<CellFilter | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Risk | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Risk | null>(null);

  const list = useRisks(orgSlug, projectId, { limit: LIMIT, ...(status ? { status } : {}), ...(owner ? { owner_id: owner } : {}) });
  const heat = useRiskHeatMap(orgSlug, projectId, showClosed);
  const del = useDeleteRisk(orgSlug, projectId);

  const rows = useMemo(() => {
    const all = list.data?.data ?? [];
    // The heat map leaves closed and occurred risks out unless asked, so the list does the same
    // while a cell is picked and no status filter says otherwise.
    const hidden = (r: Risk) => !showClosed && !status && (r.status === 'closed' || r.status === 'occurred');
    return all.filter((r) => inCell(r, cell) && !(cell && hidden(r)));
  }, [list.data, cell, showClosed, status]);

  const columns = useMemo<DataTableColumn<Risk>[]>(() => {
    const cols: DataTableColumn<Risk>[] = [
      {
        key: 'title',
        header: 'Risk',
        primary: true,
        render: (r) => (
          <span className="min-w-0">
            <span className="font-medium">{r.title}</span>
            {r.category && <span className="block text-xs text-muted-foreground">{r.category}</span>}
          </span>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        mobileAction: true,
        accessor: (r) => r.score,
        render: (r) => (
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', SCORE_CLASS[scoreBand(r.score)])} title={`Likelihood ${r.likelihood} x impact ${r.impact}`}>
            {r.score}
          </span>
        ),
      },
      { key: 'li', header: 'L x I', hideBelow: 'md', accessor: (r) => r.score, render: (r) => <span className="tabular-nums">{r.likelihood} x {r.impact}</span> },
      { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => RISK_STATUS_LABEL[r.status as RiskStatusCode] ?? r.status },
      { key: 'owner', header: 'Owner', accessor: (r) => r.owner_name, render: (r) => (r.owner_id ? nameOf(r.owner_id, r.owner_name) : <span className="text-muted-foreground">No owner</span>) },
      { key: 'due', header: 'Review by', hideBelow: 'md', accessor: (r) => r.due_date ?? '', render: (r) => formatDate(r.due_date, null, { fallback: '-' }) },
      { key: 'mitigation', header: 'Mitigation', hideBelow: 'lg', render: (r) => <span className="line-clamp-2 text-muted-foreground">{r.mitigation || '-'}</span> },
    ];
    if (canDelete) {
      cols.push({
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (r) => (
          <Button
            variant="ghost"
            className="h-10 w-10 p-0 text-destructive sm:h-8 sm:w-8"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(r);
            }}
            aria-label={`Delete risk ${r.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ),
      });
    }
    return cols;
  }, [canDelete, nameOf]);

  const header = (
    <PageHeader
      title="Risks"
      subtitle="What could go wrong, how likely it is, how much it would hurt and who watches it"
      back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
      className="mb-0"
      actions={
        canAdd ? (
          <>
            {canSuggest && (
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setSuggesting(true)}>
                <ShieldPlus className="h-4 w-4" aria-hidden />
                <span className="max-sm:sr-only">Suggest risks</span>
              </Button>
            )}
            <Button className="h-11 sm:h-9" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" aria-hidden />
              Add risk
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (list.isLoading) return <PageLoading />;
  if (isNotFound(list.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (list.isError) return <ErrorBanner message="The risk register could not be loaded." />;

  const total = list.data?.total ?? 0;
  const filters = (status ? 1 : 0) + (owner ? 1 : 0);
  const ownerOptions: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.name }));

  return (
    <div className="space-y-5">
      {header}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Heat map</CardTitle>
            <p className="text-xs text-muted-foreground">Press a cell to list only its risks.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {heat.isError ? (
              <p className="text-sm text-destructive">The heat map could not be loaded.</p>
            ) : (
              <RiskHeatMap grid={heat.data?.grid} selected={cell} onSelect={(c) => setCell((cur) => toggleCell(cur, c))} />
            )}
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Count closed and occurred risks
            </label>
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-3" aria-label="Risk register">
          <ListFilters active={filters} className="grid gap-3 sm:flex sm:items-end">
            <div className="sm:w-48">
              <SearchableCombobox options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v ?? '')} placeholder="All statuses" searchPlaceholder="Status" />
            </div>
            <div className="sm:w-56">
              <SearchableCombobox options={ownerOptions} value={owner} onChange={(v) => setOwner(v ?? '')} placeholder="Any owner" searchPlaceholder="Find a person" />
            </div>
          </ListFilters>
          {cell && (
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="risk-cell-filter">
              <span>
                Likelihood {cell.likelihood}, impact {cell.impact}: {rows.length} {rows.length === 1 ? 'risk' : 'risks'}
              </span>
              <Button variant="ghost" className="h-10 sm:h-8" onClick={() => setCell(null)}>
                <X className="h-4 w-4" aria-hidden />
                Show all
              </Button>
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={total === 0 && !filters ? 'No risks yet' : 'No risks match'}
              description={total === 0 && !filters ? (canAdd ? 'Add the first risk to start the register.' : 'Nobody has raised a risk on this project.') : 'Change the filters or pick another cell.'}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => setEditing(r)}
              gridLines="rows"
              storageKey="projects-risks-columns"
              showExportCsv
              exportFileName="risks"
            />
          )}
          {total > (list.data?.data.length ?? 0) && (
            <p className="text-xs text-muted-foreground">
              Showing the first {list.data?.data.length} of {total} risks, highest score first.
            </p>
          )}
        </section>
      </div>

      {editing && (
        <RiskDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgSlug={orgSlug}
          projectId={projectId}
          risk={editing === 'new' ? null : editing}
          people={people}
          readOnly={editing !== 'new' && !canChange}
          onClose={() => setEditing(null)}
        />
      )}
      {canSuggest && <RiskSuggestionsSheet orgSlug={orgSlug} projectId={projectId} open={suggesting} onOpenChange={setSuggesting} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.title ?? 'risk'}"?`}
        description="It leaves the register for good. To keep it on record, set its status to closed instead."
        confirmLabel="Delete risk"
        variant="danger"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
