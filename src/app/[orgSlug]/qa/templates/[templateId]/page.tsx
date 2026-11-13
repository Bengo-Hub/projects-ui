'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { CriterionDialog } from '@/components/qa/criterion-dialog';
import { Field, inputClass } from '@/components/qa/fields';
import { ImportDialog } from '@/components/qa/import-dialog';
import { QADialog } from '@/components/qa/qa-dialog';
import { QANoAccess } from '@/components/qa/qa-nav';
import { WeightBadge } from '@/components/qa/qa-badges';
import {
  useAddQACriteria,
  useDeleteQACriterion,
  useQAPermissions,
  useQATemplate,
  useUpdateQACriterion,
  useUpdateQATemplate,
} from '@/hooks/useQA';
import { QA_PERMISSIONS, SEVERITY_LABELS, SUBJECT_LABELS, WEIGHT_LABELS } from '@/lib/qa/logic';
import type { QACriterion, QACriterionInput, QAPassRule, QATemplate, QATemplateStatus, QAWeight } from '@/types/qa';

const DEFAULT_RULE: Required<QAPassRule> = {
  require_all_must: true,
  blocking_severities: [1, 2],
  min_score: 0,
  weights: { must: 3, should: 2, could: 1 },
};

function ruleOf(t?: QATemplate): Required<QAPassRule> {
  const r = t?.pass_rule;
  if (!r || !r.weights || !Object.keys(r.weights).length) return DEFAULT_RULE;
  return {
    require_all_must: !!r.require_all_must,
    blocking_severities: r.blocking_severities ?? [],
    min_score: r.min_score ?? 0,
    weights: { ...DEFAULT_RULE.weights, ...r.weights },
  };
}

/** Name, service tag, status and the pass rule. */
function TemplateSettings({ orgSlug, template, editable }: { orgSlug: string; template: QATemplate; editable: boolean }) {
  const update = useUpdateQATemplate(orgSlug, template.id);
  const [name, setName] = useState(template.name);
  const [tag, setTag] = useState(template.service_tag ?? '');
  const [status, setStatus] = useState<QATemplateStatus>(template.status ?? 'draft');
  const [rule, setRule] = useState<Required<QAPassRule>>(ruleOf(template));

  useEffect(() => {
    setName(template.name);
    setTag(template.service_tag ?? '');
    setStatus(template.status ?? 'draft');
    setRule(ruleOf(template));
  }, [template]);

  function toggleSeverity(s: number) {
    setRule((r) => ({
      ...r,
      blocking_severities: r.blocking_severities.includes(s) ? r.blocking_severities.filter((x) => x !== s) : [...r.blocking_severities, s].sort(),
    }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ name: name.trim(), service_tag: tag.trim().toLowerCase(), status, pass_rule: rule });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Template and pass rule</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={!editable || update.isPending} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" required>
                {({ id }) => <input id={id} className={inputClass} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />}
              </Field>
              <Field label="Service tag" hint="Narrows the feature catalogue">
                {({ id, describedBy }) => (
                  <input id={id} className={inputClass} maxLength={64} value={tag} aria-describedby={describedBy} onChange={(e) => setTag(e.target.value)} />
                )}
              </Field>
              <Field label="Status" hint="Archived templates cannot start sessions">
                {({ id, describedBy }) => (
                  <select id={id} className={inputClass} value={status} aria-describedby={describedBy} onChange={(e) => setStatus(e.target.value as QATemplateStatus)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
              </Field>
            </div>

            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium">Pass rule</legend>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={rule.require_all_must}
                  onChange={(e) => setRule((r) => ({ ...r, require_all_must: e.target.checked }))}
                />
                Every must criterion has to pass
              </label>
              <fieldset>
                <legend className="text-sm">An open failure blocks acceptance at severity</legend>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  {[1, 2, 3, 4].map((s) => (
                    <label key={s} className="flex min-h-10 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={rule.blocking_severities.includes(s)} onChange={() => toggleSeverity(s)} />
                      {SEVERITY_LABELS[s]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Minimum score (%)" hint="0 means no threshold">
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      className={inputClass}
                      aria-describedby={describedBy}
                      value={rule.min_score}
                      onChange={(e) => setRule((r) => ({ ...r, min_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                    />
                  )}
                </Field>
                {(['must', 'should', 'could'] as QAWeight[]).map((w) => (
                  <Field key={w} label={`${WEIGHT_LABELS[w]} weight`}>
                    {({ id }) => (
                      <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        step={0.5}
                        className={inputClass}
                        value={rule.weights[w] ?? 1}
                        onChange={(e) => setRule((r) => ({ ...r, weights: { ...r.weights, [w]: Math.max(0.1, Number(e.target.value) || 0.1) } }))}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The score is the weight of passed criteria over the weight of all of them. Changing the rule raises the template version; sessions already created keep theirs.
              </p>
            </fieldset>
          </fieldset>
          {editable && (
            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
                {update.isPending ? 'Saving...' : 'Save template'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function QATemplateEditorPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const templateId = (params?.templateId as string) ?? '';
  const perms = useQAPermissions();
  const { data: template, isLoading, isError } = useQATemplate(orgSlug, templateId, perms.canView);
  const addCriteria = useAddQACriteria(orgSlug, templateId);
  const updateCriterion = useUpdateQACriterion(orgSlug, templateId);
  const deleteCriterion = useDeleteQACriterion(orgSlug, templateId);
  const clearReview = useUpdateQATemplate(orgSlug, templateId);

  const [editing, setEditing] = useState<QACriterion | null>(null);
  const [showCriterion, setShowCriterion] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleting, setDeleting] = useState<QACriterion | null>(null);

  const platform = !template?.tenant_id;
  // A platform template is changed by the platform owner only (projects-api answers 403 otherwise).
  const editable = perms.canManage && (!platform || perms.isPlatformOwner);
  const criteria = template?.edges?.criteria ?? [];

  const columns = useMemo<DataTableColumn<QACriterion>[]>(
    () => [
      { key: 'area_code', header: 'Area', accessor: (c) => c.area_code ?? '', hideBelow: 'sm' },
      {
        key: 'title',
        header: 'Criterion',
        render: (c) => (
          <div className="min-w-0">
            <p className="font-medium">{c.title}</p>
            {c.requirement_ref && <p className="text-xs text-muted-foreground">{c.requirement_ref}</p>}
          </div>
        ),
      },
      {
        key: 'subject',
        header: 'Checks',
        accessor: (c) => c.subject_kind ?? 'none',
        render: (c) => (
          <span className="text-sm">
            {SUBJECT_LABELS[c.subject_kind ?? 'none']}
            {c.subject_kind === 'feature' && c.subject_ref ? <span className="block font-mono text-xs text-muted-foreground">{c.subject_ref}</span> : null}
          </span>
        ),
        hideBelow: 'md',
      },
      { key: 'weight', header: 'Weight', accessor: (c) => c.weight ?? 'must', render: (c) => <WeightBadge weight={c.weight} /> },
      ...(editable
        ? [
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right' as const,
              render: (c: QACriterion) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${c.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(c);
                      setShowCriterion(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${c.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(c);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [editable],
  );

  if (perms.isLoading || (perms.canView && isLoading)) return <PageLoading />;
  if (!perms.canView) return <QANoAccess permission={QA_PERMISSIONS.view} />;
  if (isError || !template) return <ErrorBanner message="The template could not be loaded." />;

  function submitCriterion(input: QACriterionInput) {
    const done = { onSuccess: () => setShowCriterion(false) };
    if (editing) updateCriterion.mutate({ id: editing.id, input }, done);
    else addCriteria.mutate([input], done);
  }

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/qa/templates`} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Templates
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge status={template.status ?? 'draft'} className="capitalize" />
            {platform && <Badge className="bg-indigo-50 text-indigo-800">Platform</Badge>}
            <span>Version {template.version ?? 1}</span>
            <span>{criteria.length} criteria</span>
          </div>
        </div>
        {editable && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setShowCriterion(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add criterion
            </Button>
          </div>
        )}
      </div>

      {template.needs_review && (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A feature these criteria check has changed in the catalogue. Check the criteria, then mark the template as reviewed.
          </p>
          {editable && (
            <Button size="sm" variant="outline" disabled={clearReview.isPending} onClick={() => clearReview.mutate({ clear_review: true })}>
              Mark as reviewed
            </Button>
          )}
        </div>
      )}

      {platform && !perms.isPlatformOwner && (
        <p className="text-sm text-muted-foreground">This is a platform template. You can start sessions from it; only Codevertex changes it.</p>
      )}

      <TemplateSettings orgSlug={orgSlug} template={template} editable={editable} />

      <section aria-labelledby="criteria-heading" className="space-y-3">
        <h2 id="criteria-heading" className="text-lg font-semibold">
          Criteria
        </h2>
        <DataTable
          columns={columns}
          rows={criteria}
          rowKey={(c) => c.id}
          gridLines="rows"
          storageKey="qa-template-criteria"
          showExportCsv
          exportFileName={`${template.name}-criteria`}
          renderExpanded={(c) => (
            <dl className="grid gap-3 p-2 text-sm sm:grid-cols-3">
              {(
                [
                  ['Preconditions', c.preconditions],
                  ['Steps', c.steps],
                  ['Expected result', c.expected_result],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                  <dd className="whitespace-pre-wrap">{v || 'Not set'}</dd>
                </div>
              ))}
            </dl>
          )}
          emptyText={editable ? 'No criteria yet. Add them one by one or import a list.' : 'No criteria yet.'}
        />
      </section>

      {editable && (
        <>
          <CriterionDialog
            open={showCriterion}
            onOpenChange={setShowCriterion}
            orgSlug={orgSlug}
            serviceTag={template.service_tag}
            platform={platform}
            initial={editing}
            pending={addCriteria.isPending || updateCriterion.isPending}
            onSubmit={submitCriterion}
          />
          <ImportDialog
            open={showImport}
            onOpenChange={setShowImport}
            platform={platform}
            pending={addCriteria.isPending}
            onImport={(list) => addCriteria.mutate(list, { onSuccess: () => setShowImport(false) })}
          />
          <QADialog
            open={!!deleting}
            onOpenChange={(o) => !o && setDeleting(null)}
            title="Remove this criterion?"
            description="Sessions already created keep their own copy of it."
          >
            <p className="mb-4 text-sm font-medium">{deleting?.title}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                disabled={deleteCriterion.isPending}
                onClick={() => deleting && deleteCriterion.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
              >
                Remove
              </Button>
            </div>
          </QADialog>
        </>
      )}
    </div>
  );
}
