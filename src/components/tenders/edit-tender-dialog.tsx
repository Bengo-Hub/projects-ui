'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { RichTextField } from '@/components/common/rich-text';
import { useUpdateTender } from '@/hooks/useTenders';
import { projectsApi } from '@/lib/api/projects';
import type { CreateTenderInput } from '@/lib/api/tenders';
import { MAX_TAGS, addTag, tenderPatch } from '@/lib/tenders/logic';
import type { Tender } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const PRIORITY_OPTIONS: ComboboxOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function formOf(t: Tender) {
  return {
    title: t.title,
    client_name: t.client_name,
    source: t.source ?? '',
    priority: t.priority,
    estimated_value: t.estimated_value != null ? String(t.estimated_value) : '',
    currency: t.currency || 'KES',
    deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    description: t.description ?? '',
  };
}

/**
 * Edits a tender's details (tenders.change). Only what changed is sent (PUT is a partial update and
 * metadata merges); the status moves through the status actions, not here.
 */
export function EditTenderDialog({ orgSlug, tender, onClose }: { orgSlug: string; tender: Tender; onClose: () => void }) {
  const [initial] = useState(() => formOf(tender));
  const [f, setF] = useState(initial);
  const [contact, setContact] = useState({ id: tender.metadata?.crm_contact_id ?? '', name: tender.metadata?.crm_contact_name ?? '' });
  const [tags, setTags] = useState<string[]>(() => tender.metadata?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const update = useUpdateTender(orgSlug);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const error = !f.title.trim()
    ? 'The tender needs a title.'
    : !f.client_name.trim()
      ? 'The tender needs a client name.'
      : f.estimated_value !== '' && !(Number(f.estimated_value) >= 0)
        ? 'The estimated value is zero or more.'
        : null;

  function commitTag() {
    const r = addTag(tags, tagDraft);
    setTags(r.tags);
    setTagError(r.error);
    if (!r.error) setTagDraft('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const after = { ...f, title: f.title.trim(), client_name: f.client_name.trim(), source: f.source.trim(), currency: f.currency.trim() || 'KES' };
    const raw = tenderPatch(
      initial,
      after,
      { crm_contact_id: tender.metadata?.crm_contact_id, crm_contact_name: tender.metadata?.crm_contact_name, tags: tender.metadata?.tags },
      { crm_contact_id: contact.id, crm_contact_name: contact.id ? contact.name : '', tags },
    );
    const body: Partial<CreateTenderInput> = { ...(raw as Partial<CreateTenderInput>) };
    if ('estimated_value' in raw) body.estimated_value = after.estimated_value === '' ? 0 : Number(after.estimated_value);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    update.mutate({ id: tender.id, data: body }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Edit tender" className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={inputClass} value={f.title} onChange={(e) => set('title', e.target.value)} aria-label="Tender title" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
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
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Client name</span>
            <input className={inputClass} value={f.client_name} onChange={(e) => set('client_name', e.target.value)} aria-label="Client name" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Source</span>
            <input className={inputClass} value={f.source} onChange={(e) => set('source', e.target.value)} aria-label="Source" placeholder="Government portal, referral..." />
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Priority</span>
            <SearchableCombobox options={PRIORITY_OPTIONS} value={f.priority} onChange={(v) => set('priority', v || 'medium')} clearable={false} searchPlaceholder="Priority" />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Estimated value</span>
            <input type="number" min={0} className={inputClass} value={f.estimated_value} onChange={(e) => set('estimated_value', e.target.value)} aria-label="Estimated value" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Currency</span>
            <input className={inputClass} value={f.currency} onChange={(e) => set('currency', e.target.value)} aria-label="Currency" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Deadline</span>
            <input type="date" className={inputClass} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} aria-label="Deadline" />
          </label>
        </div>
        <div className="space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <RichTextField value={f.description} onChange={(html) => set('description', html)} ariaLabel="Description" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="font-medium">
            Tags ({tags.length} of {MAX_TAGS})
          </span>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {tags.map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {t}
                  <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent" aria-label={`Remove tag ${t}`} onClick={() => setTags((list) => list.filter((x) => x !== t))}>
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commitTag();
                }
              }}
              placeholder="Add a tag and press Enter"
              aria-label="New tag"
            />
            <Button type="button" variant="outline" className="h-11 shrink-0 sm:h-9" onClick={commitTag} disabled={!tagDraft.trim()}>
              Add
            </Button>
          </div>
          {tagError && <p className="text-xs text-destructive">{tagError}</p>}
        </div>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={update.isPending}>
            {update.isPending ? 'Saving' : 'Save tender'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
