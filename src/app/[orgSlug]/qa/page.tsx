'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardCheck, Plus } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoading } from '@/components/ui/loading';
import { Field, inputClass } from '@/components/qa/fields';
import { QADialog } from '@/components/qa/qa-dialog';
import { QANav, QANoAccess } from '@/components/qa/qa-nav';
import { SessionStatusBadge } from '@/components/qa/qa-badges';
import { useCreateQASession, useQAPermissions, useQASessions, useQATemplates } from '@/hooks/useQA';
import { useProjects } from '@/hooks/useProjects';
import { QA_PERMISSIONS } from '@/lib/qa/logic';
import { formatDate } from '@/lib/utils';
import type { CreateSessionInput } from '@/lib/api/qa';
import type { QASession, QASessionStatus, QASessionSubject } from '@/types/qa';

const STATUS_TABS = ['all', 'draft', 'open', 'closed', 'accepted', 'rejected'] as const;
const PAGE_SIZE = 20;

function subjectText(s: QASession): string {
  if (s.subject_kind === 'service') return `Service: ${s.subject_ref}`;
  if (s.subject_kind === 'project') return 'Project';
  return 'General';
}

function CreateSessionDialog({ orgSlug, open, onOpenChange }: { orgSlug: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { user } = useQAPermissions();
  const templates = useQATemplates(orgSlug, { limit: 100 }, open);
  const projects = useProjects(orgSlug, { limit: 100 });
  const create = useCreateQASession(orgSlug);
  const [form, setForm] = useState<CreateSessionInput>({ template_id: '', title: '', subject_kind: 'general', subject_ref: '' });
  const [minScore, setMinScore] = useState('');
  const [error, setError] = useState<string | null>(null);

  const usable = (templates.data?.data ?? []).filter((t) => t.status !== 'archived');
  const template = usable.find((t) => t.id === form.template_id);
  const baseMin = template?.pass_rule?.min_score ?? 0;

  function pickTemplate(id: string) {
    const t = usable.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      template_id: id,
      title: f.title || (t ? t.name : ''),
      subject_kind: t?.service_tag ? 'service' : f.subject_kind,
      subject_ref: t?.service_tag ? t.service_tag : f.subject_ref,
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.template_id) return setError('Choose a template.');
    if (!form.title.trim()) return setError('Give the session a title.');
    if (form.subject_kind !== 'general' && !form.subject_ref?.trim()) return setError('Choose what the session accepts.');
    const body: CreateSessionInput = { ...form, title: form.title.trim(), tenant_name: (user?.tenant?.name as string | undefined) ?? undefined };
    if (minScore !== '' && template?.pass_rule) {
      const n = Number(minScore);
      if (Number.isNaN(n) || n < baseMin || n > 100) return setError(`The minimum score must be between ${baseMin} and 100.`);
      // A session may only tighten the template's rule; everything else is kept as is.
      body.pass_rule = { ...template.pass_rule, min_score: n };
    }
    create.mutate(body, {
      onSuccess: (s) => {
        onOpenChange(false);
        router.push(`/${orgSlug}/qa/sessions/${s.id}`);
      },
    });
  }

  return (
    <QADialog open={open} onOpenChange={onOpenChange} title="New acceptance session" description="The template's criteria and pass rule are frozen into the session.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Template" required>
          {({ id }) => (
            <select id={id} className={inputClass} value={form.template_id} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">{templates.isLoading ? 'Loading templates...' : usable.length ? 'Choose a template' : 'No templates yet'}</option>
              {usable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.tenant_id ? '' : ' (platform)'}
                  {t.status === 'draft' ? ' (draft)' : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Title" required>
          {({ id }) => (
            <input id={id} className={inputClass} maxLength={200} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          )}
        </Field>
        <Field label="What is accepted">
          {({ id }) => (
            <select
              id={id}
              className={inputClass}
              value={form.subject_kind}
              onChange={(e) => setForm((f) => ({ ...f, subject_kind: e.target.value as QASessionSubject, subject_ref: '' }))}
            >
              <option value="general">General work</option>
              <option value="project">A project</option>
              <option value="service">A Codevertex service</option>
            </select>
          )}
        </Field>
        {form.subject_kind === 'project' && (
          <Field label="Project" required>
            {({ id }) => (
              <select id={id} className={inputClass} value={form.subject_ref} onChange={(e) => setForm((f) => ({ ...f, subject_ref: e.target.value }))}>
                <option value="">{projects.isLoading ? 'Loading projects...' : 'Choose a project'}</option>
                {(projects.data?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {form.subject_kind === 'service' && (
          <Field label="Service tag" required hint="The catalogue tag, for example hadia or pos. Its failures alert Codevertex operations.">
            {({ id, describedBy }) => (
              <input
                id={id}
                className={inputClass}
                value={form.subject_ref}
                maxLength={64}
                aria-describedby={describedBy}
                onChange={(e) => setForm((f) => ({ ...f, subject_ref: e.target.value.toLowerCase() }))}
              />
            )}
          </Field>
        )}
        {template && (
          <Field label="Minimum score (optional)" hint={`Raise the template's threshold of ${baseMin}% for this session; it cannot go lower.`}>
            {({ id, describedBy }) => (
              <input
                id={id}
                type="number"
                inputMode="decimal"
                min={baseMin}
                max={100}
                className={inputClass}
                value={minScore}
                aria-describedby={describedBy}
                onChange={(e) => setMinScore(e.target.value)}
              />
            )}
          </Field>
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
            {create.isPending ? 'Creating...' : 'Create session'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

export default function QASessionsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const router = useRouter();
  const perms = useQAPermissions();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const sessions = useQASessions(orgSlug, { status: tab === 'all' ? undefined : tab, page, limit: PAGE_SIZE }, perms.canView);

  const columns = useMemo<DataTableColumn<QASession>[]>(
    () => [
      {
        key: 'title',
        header: 'Session',
        render: (s) => (
          <Link href={`/${orgSlug}/qa/sessions/${s.id}`} className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {s.title}
          </Link>
        ),
      },
      { key: 'status', header: 'Status', accessor: (s) => s.status, render: (s) => <SessionStatusBadge status={s.status as QASessionStatus} /> },
      { key: 'subject', header: 'Accepts', accessor: subjectText, hideBelow: 'sm' },
      { key: 'criteria', header: 'Criteria', accessor: (s) => s.criteria_snapshot?.length ?? 0, align: 'right', hideBelow: 'md' },
      { key: 'created_at', header: 'Created', accessor: (s) => s.created_at, render: (s) => formatDate(s.created_at), hideBelow: 'md' },
      { key: 'closed_at', header: 'Closed', accessor: (s) => s.closed_at, render: (s) => formatDate(s.closed_at), hideBelow: 'lg' },
    ],
    [orgSlug],
  );

  if (perms.isLoading) return <PageLoading />;
  if (!perms.canView) return <QANoAccess permission={QA_PERMISSIONS.view} />;

  const total = sessions.data?.total ?? 0;
  const rows = sessions.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acceptance</h1>
          <p className="text-sm text-muted-foreground">Run acceptance with invited testers and signers, and keep the signed report.</p>
        </div>
        {perms.canManage && (
          <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New session
          </Button>
        )}
      </div>

      <QANav orgSlug={orgSlug} />

      <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by status">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`min-h-10 whitespace-nowrap rounded-full px-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        loading={sessions.isLoading}
        loadingRows={5}
        error={sessions.isError}
        onRetry={() => void sessions.refetch()}
        gridLines="rows"
        onRowClick={(s) => router.push(`/${orgSlug}/qa/sessions/${s.id}`)}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        onPageChange={setPage}
        total={total}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title={tab === 'all' ? 'No acceptance sessions yet' : `No ${tab} sessions`}
            description={tab === 'all' ? 'Create a template, then start a session from it.' : undefined}
            action={
              tab === 'all' && perms.canManage ? (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New session
                </Button>
              ) : undefined
            }
          />
        }
      />

      {perms.canManage && <CreateSessionDialog orgSlug={orgSlug} open={showCreate} onOpenChange={setShowCreate} />}
    </div>
  );
}
