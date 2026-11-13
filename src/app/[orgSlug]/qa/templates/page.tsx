'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FileCheck2, Plus } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoading } from '@/components/ui/loading';
import { Field, inputClass } from '@/components/qa/fields';
import { QADialog } from '@/components/qa/qa-dialog';
import { QANav, QANoAccess } from '@/components/qa/qa-nav';
import { useCreateQATemplate, useQAPermissions, useQATemplates } from '@/hooks/useQA';
import { QA_PERMISSIONS } from '@/lib/qa/logic';
import { formatDate } from '@/lib/utils';
import type { CreateTemplateInput } from '@/lib/api/qa';
import type { QATemplate, QATemplateKind } from '@/types/qa';

const PAGE_SIZE = 20;

function CreateTemplateDialog({
  orgSlug,
  open,
  onOpenChange,
  isPlatformOwner,
}: {
  orgSlug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPlatformOwner: boolean;
}) {
  const router = useRouter();
  const create = useCreateQATemplate(orgSlug);
  const [form, setForm] = useState<CreateTemplateInput>({ name: '', kind: 'software', service_tag: '', status: 'draft', platform: false });
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Give the template a name.');
    const tag = (form.service_tag ?? '').trim().toLowerCase();
    if (tag && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(tag)) return setError('The service tag uses lower case letters, digits, dashes and underscores.');
    create.mutate(
      { ...form, name: form.name.trim(), service_tag: tag, platform: isPlatformOwner ? form.platform : false },
      {
        onSuccess: (t) => {
          onOpenChange(false);
          router.push(`/${orgSlug}/qa/templates/${t.id}`);
        },
      },
    );
  }

  return (
    <QADialog open={open} onOpenChange={onOpenChange} title="New template" description="A template holds the criteria and the pass rule. Add the criteria next.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required>
          {({ id }) => <input id={id} className={inputClass} maxLength={200} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            {({ id }) => (
              <select id={id} className={inputClass} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as QATemplateKind }))}>
                <option value="software">Software</option>
                <option value="project">Project</option>
                <option value="general">General work</option>
              </select>
            )}
          </Field>
          <Field label="Service tag" hint="Optional, for example hadia">
            {({ id, describedBy }) => (
              <input
                id={id}
                className={inputClass}
                maxLength={64}
                aria-describedby={describedBy}
                value={form.service_tag}
                onChange={(e) => setForm((f) => ({ ...f, service_tag: e.target.value }))}
              />
            )}
          </Field>
        </div>
        {isPlatformOwner && (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={!!form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.checked }))} />
            Platform template, readable by every tenant once active
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create template'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

export default function QATemplatesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const router = useRouter();
  const perms = useQAPermissions();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const templates = useQATemplates(orgSlug, { page, limit: PAGE_SIZE, status: status || undefined }, perms.canView);

  const columns = useMemo<DataTableColumn<QATemplate>[]>(
    () => [
      {
        key: 'name',
        header: 'Template',
        render: (t) => (
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/${orgSlug}/qa/templates/${t.id}`} className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t.name}
            </Link>
            {!t.tenant_id && <Badge className="bg-indigo-50 text-indigo-800">Platform</Badge>}
            {t.needs_review && <Badge className="bg-amber-100 text-amber-900">Needs review</Badge>}
          </span>
        ),
      },
      { key: 'status', header: 'Status', accessor: (t) => t.status ?? 'draft', render: (t) => <Badge status={t.status ?? 'draft'} className="capitalize" /> },
      { key: 'kind', header: 'Kind', accessor: (t) => t.kind ?? 'software', hideBelow: 'sm', cellClassName: 'capitalize' },
      { key: 'service_tag', header: 'Service', accessor: (t) => t.service_tag ?? '', hideBelow: 'md' },
      { key: 'version', header: 'Version', accessor: (t) => t.version ?? 1, align: 'right', hideBelow: 'md' },
      { key: 'updated_at', header: 'Updated', accessor: (t) => t.updated_at, render: (t) => formatDate(t.updated_at), hideBelow: 'lg' },
    ],
    [orgSlug],
  );

  if (perms.isLoading) return <PageLoading />;
  if (!perms.canView) return <QANoAccess permission={QA_PERMISSIONS.view} />;

  const total = templates.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acceptance templates</h1>
          <p className="text-sm text-muted-foreground">Criteria and pass rules that sessions are created from.</p>
        </div>
        {perms.canManage && (
          <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New template
          </Button>
        )}
      </div>

      <QANav orgSlug={orgSlug} />

      <DataTable
        columns={columns}
        rows={templates.data?.data ?? []}
        rowKey={(t) => t.id}
        loading={templates.isLoading}
        loadingRows={5}
        error={templates.isError}
        onRetry={() => void templates.refetch()}
        gridLines="rows"
        onRowClick={(t) => router.push(`/${orgSlug}/qa/templates/${t.id}`)}
        toolbar={
          <label className="flex items-center gap-2 text-sm">
            <span>Status</span>
            <select
              className={`${inputClass} w-auto`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        }
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        onPageChange={setPage}
        total={total}
        emptyState={
          <EmptyState
            icon={FileCheck2}
            title="No templates yet"
            description="A template lists what is checked and how the outcome is decided."
            action={
              perms.canManage ? (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New template
                </Button>
              ) : undefined
            }
          />
        }
      />

      {perms.canManage && (
        <CreateTemplateDialog orgSlug={orgSlug} open={showCreate} onOpenChange={setShowCreate} isPlatformOwner={perms.isPlatformOwner} />
      )}
    </div>
  );
}
