'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, DollarSign } from 'lucide-react';
import { useTenders, useTenderMetrics, useCreateTender } from '@/hooks/useTenders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import type { CreateTenderInput } from '@/lib/api/tenders';
import { formatCompact } from '@/lib/utils';
import { TenderPipeline } from '@/components/tenders/pipeline';

const STATUS_TABS = [
  'all',
  'draft',
  'evaluating',
  'preparing',
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'awarded',
  'lost',
  'no_go',
  'cancelled',
] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function CreateTenderModal({
  onClose,
  onSubmit,
  isPending,
}: {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.client_name.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">New Tender</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Tender title"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client Name *</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Client / organization name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={form.priority ?? 'medium'}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Submission Type</label>
              <select
                value={form.submission_type ?? 'online'}
                onChange={(e) => setForm((f) => ({ ...f, submission_type: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="online">Online</option>
                <option value="email">Email</option>
                <option value="physical">Physical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Value</label>
              <input
                type="number"
                value={form.estimated_value ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input
                type="text"
                value={form.currency ?? 'KES'}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deadline</label>
            <input
              type="date"
              value={form.deadline ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value || undefined }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.title.trim() || !form.client_name.trim()}>
              {isPending ? 'Creating...' : 'Create Tender'}
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
  const [showCreate, setShowCreate] = useState(false);

  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data, isLoading, isError } = useTenders(orgSlug, { status: statusFilter });
  const { data: metrics } = useTenderMetrics(orgSlug);
  const createTender = useCreateTender(orgSlug);

  const tenders = data?.data ?? [];

  function handleCreate(input: CreateTenderInput) {
    createTender.mutate(input, { onSuccess: () => setShowCreate(false) });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load tenders." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenders</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} total tenders</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4" />
          New Tender
        </Button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                  A
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.by_status?.awarded?.count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Awarded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                  E
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.by_status?.evaluating?.count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Evaluating</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold">
                    {formatCompact(metrics.total_estimated_value ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Est. Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && (
        <TenderPipeline
          metrics={metrics}
          activeStatus={statusFilter}
          onSelect={(s) => setActiveTab((cur) => (cur === s ? 'all' : (s as StatusTab)))}
        />
      )}

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'no_go' ? 'No-go' : tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {tenders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No tenders found"
          description={activeTab === 'all' ? 'Create your first tender.' : `No ${activeTab} tenders.`}
          action={
            activeTab === 'all' ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New Tender
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenders.map((tender) => (
            <Link key={tender.id} href={`/${orgSlug}/tenders/${tender.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-mono">{tender.number}</p>
                      <h3 className="font-semibold text-sm line-clamp-2 mt-0.5">{tender.title}</h3>
                    </div>
                    <Badge status={tender.status} className="shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tender.client_name}</p>
                  <div className="flex items-center justify-between mt-3">
                    <Badge status={tender.priority} />
                    {tender.deadline && (
                      <span className="text-xs text-muted-foreground">
                        Due {format(new Date(tender.deadline), 'MMM d')}
                      </span>
                    )}
                  </div>
                  {tender.estimated_value != null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {tender.currency} {tender.estimated_value.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTenderModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createTender.isPending}
        />
      )}
    </div>
  );
}
