'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { useDebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { formatCurrency, formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useTenderPages, useTenderMetrics, useCreateTender } from '@/hooks/useTenders';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { CountRow, ListError, ListSearch, ShowMore } from '@/components/common/list-parts';
import { RichTextField } from '@/components/common/rich-text';
import type { CreateTenderInput } from '@/lib/api/tenders';
import { projectsApi } from '@/lib/api/projects';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { SORT_OPTIONS, TENDER_STATUSES, displayStatus, tenderStatusLabel } from '@/lib/tenders/logic';

const STATUS_TABS = ['all', ...TENDER_STATUSES] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const PRIORITY_OPTIONS: ComboboxOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const SUBMISSION_OPTIONS: ComboboxOption[] = [
  { value: 'online', label: 'Online' },
  { value: 'email', label: 'Email' },
  { value: 'physical', label: 'Physical' },
];
const SORT_COMBO: ComboboxOption[] = SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring';

function CreateTenderModal({
  orgSlug,
  onClose,
  onSubmit,
  isPending,
}: {
  orgSlug: string;
  onClose: () => void;
  onSubmit: (data: CreateTenderInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateTenderInput>({
    title: '',
    client_name: '',
    priority: 'medium',
    currency: 'KES',
    submission_type: 'online',
  });
  const [contact, setContact] = useState<{ id: string; name: string }>({ id: '', name: '' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.client_name.trim()) return;
    const body: CreateTenderInput = { ...form, title: form.title.trim(), client_name: form.client_name.trim() };
    if (contact.id) body.metadata = { crm_contact_id: contact.id, crm_contact_name: contact.name };
    onSubmit(body);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="new-tender-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card p-4 shadow-lg sm:mx-4 sm:rounded-xl sm:p-6">
        <h2 id="new-tender-title" className="mb-4 text-lg font-semibold">New tender</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="tender-title" className="mb-1 block text-sm font-medium">Title *</label>
            <input
              id="tender-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
              placeholder="Tender title"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Client in the CRM</span>
            <SearchableCombobox
              options={contact.id ? [{ value: contact.id, label: contact.name }] : []}
              value={contact.id}
              valueLabel={contact.name}
              onChange={(id, opt) => {
                const name = opt?.label ?? '';
                setContact({ id: id ?? '', name });
                if (id && name) setForm((f) => ({ ...f, client_name: f.client_name.trim() ? f.client_name : name }));
              }}
              onRemoteSearch={async (q) => (await projectsApi.searchContacts(orgSlug, q)).map((c) => ({ value: c.id, label: c.name, description: c.detail }))}
              placeholder="Choose a client (optional)"
              searchPlaceholder="Search the CRM"
            />
          </div>
          <div>
            <label htmlFor="tender-client" className="mb-1 block text-sm font-medium">Client name *</label>
            <input
              id="tender-client"
              type="text"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              className={inputClass}
              placeholder="Client or organisation name"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Description</span>
            <RichTextField
              value={form.description ?? ''}
              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              ariaLabel="Description"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-medium">Priority</span>
              <SearchableCombobox
                options={PRIORITY_OPTIONS}
                value={form.priority ?? 'medium'}
                onChange={(v) => setForm((f) => ({ ...f, priority: v || 'medium' }))}
                clearable={false}
                searchPlaceholder="Find a priority"
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Submission type</span>
              <SearchableCombobox
                options={SUBMISSION_OPTIONS}
                value={form.submission_type ?? 'online'}
                onChange={(v) => setForm((f) => ({ ...f, submission_type: v || 'online' }))}
                clearable={false}
                searchPlaceholder="Find a type"
              />
            </div>
            <div>
              <label htmlFor="tender-value" className="mb-1 block text-sm font-medium">Estimated value</label>
              <input
                id="tender-value"
                type="number"
                min={0}
                value={form.estimated_value ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? Number(e.target.value) : undefined }))}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="tender-currency" className="mb-1 block text-sm font-medium">Currency</label>
              <input
                id="tender-currency"
                type="text"
                value={form.currency ?? 'KES'}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="tender-deadline" className="mb-1 block text-sm font-medium">Deadline</label>
            <input
              id="tender-deadline"
              type="date"
              value={form.deadline ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value || undefined }))}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending} className="h-11 sm:h-9">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.title.trim() || !form.client_name.trim()} className="h-11 sm:h-9">
              {isPending ? 'Creating...' : 'Create tender'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TendersPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [sort, setSort] = useState<string>('-created_at');
  const [showCreate, setShowCreate] = useState(false);
  const search = useDebouncedSearch();

  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const list = useTenderPages(orgSlug, { status: statusFilter, q: search.term || undefined, sort });
  const { data: metrics } = useTenderMetrics(orgSlug);
  const createTender = useCreateTender(orgSlug);
  const { can } = useServicePermissions();
  const canAdd = can(PERMS.tendersAdd);

  function handleCreate(input: CreateTenderInput) {
    createTender.mutate(input, { onSuccess: () => setShowCreate(false) });
  }

  const filtered = activeTab !== 'all' || !!search.term;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenders"
        subtitle={`${list.total} ${filtered ? 'matching' : 'total'} tenders`}
        className="mb-0"
        actions={
          canAdd ? (
            <Button onClick={() => setShowCreate(true)} size="sm" className="h-11 sm:h-9">
              <Plus className="h-4 w-4" />
              New tender
            </Button>
          ) : undefined
        }
      />

      {metrics && (
        <CountRow
          items={[
            { label: 'Total', value: metrics.total },
            { label: 'Won', value: metrics.by_status?.awarded?.count ?? 0, hint: `${Math.round(metrics.win_rate ?? 0)}% win rate` },
            { label: 'In the pipeline', value: formatCurrency(metrics.pipeline_value ?? 0, 'KES') },
            { label: 'Estimated value', value: formatCurrency(metrics.total_estimated_value ?? 0, 'KES') },
          ]}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <ListSearch search={search} label="Search tenders" busy={list.isFetching && !list.isFetchingNextPage} />
        <div className="w-full sm:w-56">
          <SearchableCombobox options={SORT_COMBO} value={sort} onChange={(v) => setSort(v || '-created_at')} clearable={false} searchPlaceholder="Sort by" />
        </div>
      </div>

      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:px-0" role="group" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-11 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 ${
              activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : tenderStatusLabel(tab)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <PageLoading />
      ) : list.isError ? (
        <ListError error={list.error} title="The tenders could not be loaded." onRetry={() => void list.refetch()} />
      ) : list.tenders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No tenders found"
          description={
            filtered ? 'No tender matches. Change the search or the status.' : canAdd ? 'Create your first tender.' : 'No tenders have been added yet.'
          }
          action={
            !filtered && canAdd ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New tender
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.tenders.map((tender) => (
              <Link key={tender.id} href={`/${orgSlug}/tenders/${tender.id}`} className="min-w-0" data-testid="tender-card">
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{tender.number}</p>
                        <h3 className="mt-0.5 line-clamp-2 break-words text-sm font-semibold">{tender.title}</h3>
                      </div>
                      <Badge status={displayStatus(tender.status)} className="shrink-0">
                        {tenderStatusLabel(tender.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{tender.client_name}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge status={tender.priority} />
                      {tender.deadline && <span className="text-xs text-muted-foreground">Due {formatDate(tender.deadline)}</span>}
                    </div>
                    {tender.estimated_value != null && (
                      <p className="mt-2 text-xs text-muted-foreground tabular">{formatCurrency(tender.estimated_value, tender.currency || 'KES')}</p>
                    )}
                    {tender.metadata?.conversion?.project_name && (
                      <p className="mt-2 truncate text-xs text-primary">Project: {tender.metadata.conversion.project_name}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <ShowMore show={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
        </div>
      )}

      {showCreate && (
        <CreateTenderModal orgSlug={orgSlug} onClose={() => setShowCreate(false)} onSubmit={handleCreate} isPending={createTender.isPending} />
      )}
    </div>
  );
}
