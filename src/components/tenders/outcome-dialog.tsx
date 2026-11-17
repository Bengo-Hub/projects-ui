'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useRecordOutcome } from '@/hooks/useTenders';
import type { OutcomeInput } from '@/lib/api/tenders';
import type { Tender } from '@/types';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

/** Records the award or the loss of a submitted tender (US-1.13). A loss needs its reason. */
export function OutcomeDialog({ orgSlug, tender, onClose }: { orgSlug: string; tender: Tender; onClose: () => void }) {
  const [outcome, setOutcome] = useState<'won' | 'lost'>('won');
  const [f, setF] = useState({
    award_value: tender.estimated_value != null ? String(tender.estimated_value) : '',
    award_date: '',
    contract_reference: '',
    contract_start: '',
    contract_end: '',
    loss_reason: '',
    competitor: '',
    competitor_price: '',
    lessons: '',
  });
  const [tried, setTried] = useState(false);
  const record = useRecordOutcome(orgSlug, tender.id);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const error =
    outcome === 'lost' && !f.loss_reason.trim()
      ? 'Say why the tender was lost.'
      : f.contract_start && f.contract_end && f.contract_end < f.contract_start
        ? 'The contract ends before it starts.'
        : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const body: OutcomeInput = { outcome };
    if (f.lessons.trim()) body.lessons = f.lessons.trim();
    if (outcome === 'won') {
      if (f.award_value) body.award_value = Number(f.award_value);
      if (f.award_date) body.award_date = f.award_date;
      if (f.contract_reference.trim()) body.contract_reference = f.contract_reference.trim();
      if (f.contract_start) body.contract_start = f.contract_start;
      if (f.contract_end) body.contract_end = f.contract_end;
    } else {
      body.loss_reason = f.loss_reason.trim();
      if (f.competitor.trim()) body.competitor = f.competitor.trim();
      if (f.competitor_price) body.competitor_price = Number(f.competitor_price);
    }
    record.mutate(body, { onSuccess: onClose });
  }

  const field = (key: keyof typeof f, label: string, type = 'text') => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input type={type} min={type === 'number' ? 0 : undefined} className={inputClass} value={f[key]} onChange={(e) => set(key, e.target.value)} aria-label={label} />
    </label>
  );

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Record the outcome">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
          {(['won', 'lost'] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={outcome === o}
              onClick={() => setOutcome(o)}
              className={cn('min-h-11 rounded-md border text-sm font-medium', outcome === o ? 'border-primary bg-primary/10' : 'border-border')}
            >
              {o === 'won' ? 'We won' : 'We lost'}
            </button>
          ))}
        </div>
        {outcome === 'won' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {field('award_value', `Award value (${tender.currency || 'KES'})`, 'number')}
            {field('award_date', 'Award date', 'date')}
            {field('contract_reference', 'Contract reference')}
            <span className="hidden sm:block" />
            {field('contract_start', 'Contract starts', 'date')}
            {field('contract_end', 'Contract ends', 'date')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('loss_reason', 'Why we lost')}</div>
            {field('competitor', 'Who won it')}
            {field('competitor_price', 'Their price', 'number')}
          </div>
        )}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Lessons learned</span>
          <textarea className={`${inputClass} min-h-20`} value={f.lessons} onChange={(e) => set('lessons', e.target.value)} aria-label="Lessons learned" />
        </label>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={record.isPending}>
            {record.isPending ? 'Saving' : 'Save outcome'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
