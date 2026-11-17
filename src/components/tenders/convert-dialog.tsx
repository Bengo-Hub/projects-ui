'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useConvertTender, useTenderCommittees } from '@/hooks/useTenders';
import { useTemplates } from '@/hooks/useTemplates';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/auth';
import { projectsApi } from '@/lib/api/projects';
import type { ConvertInput } from '@/lib/api/tenders';
import { PERMS } from '@/lib/auth/permissions';
import { BILLING_LABEL, BILLING_TYPES } from '@/lib/tenders/logic';
import type { Tender } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const BILLING_OPTIONS: ComboboxOption[] = BILLING_TYPES.map((b) => ({ value: b, label: BILLING_LABEL[b] }));

/**
 * Turns a won tender into a project (US-2.1): the name, client, award as the contract value, the
 * contract dates, the committee as the team, the documents linked, an optional template and the
 * bid budget as a draft treasury budget. Everything defaults from the tender.
 */
export function ConvertDialog({ orgSlug, tender, onClose }: { orgSlug: string; tender: Tender; onClose: () => void }) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user?.id ?? '');
  const { can } = useServicePermissions();
  const canTemplates = can(PERMS.templatesView);
  const meta = tender.metadata ?? {};
  const outcome = meta.outcome;
  const hasBid = (meta.bid_budget?.lines?.length ?? 0) > 0;
  const committees = useTenderCommittees(orgSlug, tender.id);
  const templates = useTemplates(orgSlug, '', canTemplates);
  const convert = useConvertTender(orgSlug, tender.id);

  const [f, setF] = useState({
    name: tender.title,
    billing_type: 'fixed',
    contract_value: String(outcome?.award_value ?? tender.estimated_value ?? ''),
    start_date: outcome?.contract_start ?? '',
    end_date: outcome?.contract_end ?? '',
    owner_id: me,
    template_id: '',
    include_team: true,
    create_budget: true,
  });
  const [contact, setContact] = useState({ id: meta.crm_contact_id ?? '', name: meta.crm_contact_name ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const ownerOptions = useMemo<ComboboxOption[]>(() => {
    const out: ComboboxOption[] = [{ value: me, label: 'Me' }];
    for (const c of committees.data?.data ?? []) {
      for (const m of c.edges?.members ?? []) {
        if (m.user_id !== me && !out.some((o) => o.value === m.user_id)) out.push({ value: m.user_id, label: m.user_name || m.email || 'Committee member' });
      }
    }
    return out;
  }, [committees.data, me]);
  const templateOptions = useMemo<ComboboxOption[]>(
    () => (templates.data?.data ?? []).map((t) => ({ value: t.id, label: t.name, description: `${t.task_count} tasks, ${t.duration_days} days` })),
    [templates.data],
  );

  const error = !f.name.trim()
    ? 'The project needs a name.'
    : f.start_date && f.end_date && f.end_date < f.start_date
      ? 'The project ends before it starts.'
      : f.contract_value !== '' && Number(f.contract_value) < 0
        ? 'The contract value is zero or more.'
        : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    const body: ConvertInput = { name: f.name.trim(), billing_type: f.billing_type };
    if (f.contract_value !== '') body.contract_value = Number(f.contract_value);
    if (f.start_date) body.start_date = f.start_date;
    if (f.end_date) body.end_date = f.end_date;
    if (f.owner_id && f.owner_id !== me) body.owner_id = f.owner_id;
    if (f.template_id) body.template_id = f.template_id;
    if (contact.id && contact.id !== meta.crm_contact_id) {
      body.crm_contact_id = contact.id;
      body.crm_contact_name = contact.name;
    }
    if (!f.include_team) body.skip_team = true;
    if (hasBid && !f.create_budget) body.skip_budget = true;
    convert.mutate(body, {
      onSuccess: (res) => {
        onClose();
        if (!res.already_converted) router.push(`/${orgSlug}/projects/${res.project.id}`);
      },
    });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Convert to a project" description="The tender stays as the record; this creates the project once." className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Project name</span>
          <input className={inputClass} value={f.name} onChange={(e) => set('name', e.target.value)} aria-label="Project name" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <span className="font-medium">Billing</span>
            <SearchableCombobox options={BILLING_OPTIONS} value={f.billing_type} onChange={(v) => set('billing_type', v || 'fixed')} clearable={false} searchPlaceholder="Billing type" />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Contract value ({tender.currency || 'KES'})</span>
            <input type="number" min={0} step="0.01" className={inputClass} value={f.contract_value} onChange={(e) => set('contract_value', e.target.value)} aria-label="Contract value" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Starts</span>
            <input type="date" className={inputClass} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} aria-label="Project start" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Ends</span>
            <input type="date" className={inputClass} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} aria-label="Project end" />
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Owner</span>
            <SearchableCombobox options={ownerOptions} value={f.owner_id} onChange={(v) => set('owner_id', v || me)} clearable={false} searchPlaceholder="You or a committee member" />
          </div>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Client in the CRM</span>
            <SearchableCombobox
              options={contact.id ? [{ value: contact.id, label: contact.name }] : []}
              value={contact.id}
              valueLabel={contact.name}
              onChange={(id, opt) => setContact({ id: id ?? '', name: opt?.label ?? '' })}
              onRemoteSearch={async (q) => (await projectsApi.searchContacts(orgSlug, q)).map((c) => ({ value: c.id, label: c.name, description: c.detail }))}
              placeholder="No CRM client"
              searchPlaceholder="Search the CRM"
            />
          </div>
          {canTemplates && (
            <div className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Plan from a template</span>
              <SearchableCombobox options={templateOptions} value={f.template_id} onChange={(v) => set('template_id', v ?? '')} placeholder="No template" searchPlaceholder="Find a template" loading={templates.isLoading} />
            </div>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.include_team} onChange={(e) => set('include_team', e.target.checked)} />
          Add the committee as the project team
        </label>
        {hasBid && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={f.create_budget} onChange={(e) => set('create_budget', e.target.checked)} />
            Create a draft project budget in treasury from the bid budget
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={convert.isPending || !!error}>
            {convert.isPending ? 'Converting' : 'Create the project'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
