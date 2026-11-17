'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatCurrency } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateTender } from '@/hooks/useTenders';
import { BUDGET_CATEGORIES, bidBudgetError, bidTotal } from '@/lib/tenders/logic';
import type { BidBudgetLine, Tender } from '@/types';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const CATEGORY_LABEL: Record<(typeof BUDGET_CATEGORIES)[number], string> = { expense: 'Expense', revenue: 'Revenue', capex: 'Capital' };
const CATEGORY_OPTIONS: ComboboxOption[] = BUDGET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

interface Row {
  name: string;
  category: (typeof BUDGET_CATEGORIES)[number];
  planned_amount: string;
  notes: string;
}

function rowsOf(t: Tender): Row[] {
  return (t.metadata?.bid_budget?.lines ?? []).map((l) => ({
    name: l.name,
    category: l.category ?? 'expense',
    planned_amount: String(l.planned_amount ?? ''),
    notes: l.notes ?? '',
  }));
}

/**
 * The cost estimate behind the bid (tender metadata.bid_budget). It is not a ledger: when the
 * tender becomes a project the lines go to treasury as a draft project budget, and from then on
 * treasury owns it, so editing stops. Mount it with a key per tender version so it starts from the
 * saved lines.
 */
export function BidBudgetCard({ orgSlug, tender, canEdit }: { orgSlug: string; tender: Tender; canEdit: boolean }) {
  const converted = !!tender.metadata?.conversion;
  const [rows, setRows] = useState<Row[]>(() => rowsOf(tender));
  const [editing, setEditing] = useState(false);
  const [tried, setTried] = useState(false);
  const update = useUpdateTender(orgSlug);
  const currency = tender.currency || 'KES';
  const saved = rowsOf(tender);
  const error = bidBudgetError(rows);
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function save() {
    setTried(true);
    if (error) return;
    const lines: BidBudgetLine[] = rows.map((r) => ({
      name: r.name.trim(),
      category: r.category,
      planned_amount: r.planned_amount.trim(),
      ...(r.notes.trim() ? { notes: r.notes.trim() } : {}),
    }));
    update.mutate(
      { id: tender.id, data: { metadata: { bid_budget: lines.length > 0 ? { lines } : null } } },
      {
        onSuccess: () => {
          setEditing(false);
          setTried(false);
        },
      },
    );
  }

  return (
    <Card data-testid="bid-budget">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Bid budget</CardTitle>
          {canEdit && !converted && !editing && (
            <Button
              variant="outline"
              className="h-11 sm:h-8"
              onClick={() => {
                setRows(rowsOf(tender));
                setEditing(true);
              }}
            >
              {saved.length > 0 ? 'Edit' : 'Add lines'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {converted && <p className="text-muted-foreground">This tender is now a project, so its budget lives in treasury. Edit it from the project&apos;s Financials.</p>}
        {!editing ? (
          saved.length === 0 ? (
            <p className="text-muted-foreground">No cost estimate yet. On conversion the lines become a draft project budget in treasury.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {saved.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2 py-1.5">
                    <span className="min-w-0">
                      <span className="block truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[l.category]}
                        {l.notes ? `, ${l.notes}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(Number(l.planned_amount), currency)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between font-medium" data-testid="bid-total">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(bidTotal(saved), currency)}</span>
              </p>
            </>
          )
        ) : (
          <>
            <ul className="space-y-3" aria-label="Bid budget lines">
              {rows.map((r, i) => (
                <li key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
                  <input className={inputClass} value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="What it covers" aria-label={`Line ${i + 1} name`} />
                  <SearchableCombobox options={CATEGORY_OPTIONS} value={r.category} onChange={(v) => set(i, { category: (v || 'expense') as Row['category'] })} clearable={false} searchPlaceholder="Category" />
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={r.planned_amount}
                    onChange={(e) => set(i, { planned_amount: e.target.value })}
                    placeholder="0.00"
                    aria-label={`Line ${i + 1} amount`}
                  />
                  <Button type="button" variant="ghost" className="h-11 w-11 p-0 text-destructive sm:h-9 sm:w-9" onClick={() => setRows((list) => list.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                  <input className={`${inputClass} sm:col-span-4`} value={r.notes} onChange={(e) => set(i, { notes: e.target.value })} placeholder="Notes (optional)" aria-label={`Line ${i + 1} notes`} />
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setRows((list) => [...list, { name: '', category: 'expense', planned_amount: '', notes: '' }])}>
              <Plus className="h-4 w-4" aria-hidden />
              Add line
            </Button>
            <p className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(bidTotal(rows), currency)}</span>
            </p>
            {tried && error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-11 sm:h-9" disabled={update.isPending} onClick={save}>
                {update.isPending ? 'Saving' : 'Save bid budget'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
