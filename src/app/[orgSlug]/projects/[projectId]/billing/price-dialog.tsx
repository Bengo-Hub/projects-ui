'use client';

import { useState } from 'react';
import { formatCurrency } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useSetMilestonePrice } from '@/hooks/useBilling';
import type { MilestoneBilling } from '@/lib/api/billing';
import { hasPrice, validPercent, validPrice } from '@/lib/billing/logic';
import { cn } from '@/lib/utils';

type Mode = 'amount' | 'percent';

const inputClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:h-9';

/**
 * Sets a milestone's price: a fixed amount, or a share of the contract value. Mount it with a key
 * per milestone so each opening starts from that milestone's price.
 */
export function PriceDialog({
  orgSlug,
  projectId,
  milestone,
  contractValue,
  currency,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  milestone: MilestoneBilling;
  contractValue?: number;
  currency: string;
  onClose: () => void;
}) {
  const canPercent = contractValue != null && contractValue > 0;
  const [mode, setMode] = useState<Mode>(milestone.amount_pct != null && canPercent ? 'percent' : 'amount');
  const [amount, setAmount] = useState(milestone.amount ?? '');
  const [pct, setPct] = useState(milestone.amount_pct != null ? String(milestone.amount_pct) : '');
  const save = useSetMilestonePrice(orgSlug, projectId);

  const valid = mode === 'amount' ? validPrice(amount) : validPercent(pct);
  const preview = mode === 'percent' && validPercent(pct) && canPercent ? ((contractValue ?? 0) * Number(pct)) / 100 : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const body = mode === 'amount' ? { amount: amount.trim(), amount_pct: null } : { amount: null, amount_pct: Number(pct) };
    save.mutate({ milestoneId: milestone.id, body }, { onSuccess: onClose });
  }

  function clear() {
    save.mutate({ milestoneId: milestone.id, body: { amount: null, amount_pct: null } }, { onSuccess: onClose });
  }

  const option = (m: Mode, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === m}
      disabled={disabled}
      onClick={() => setMode(m)}
      className={cn(
        'h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50',
        mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={`Price for ${milestone.name}`} description="What the milestone's invoice charges.">
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="Price as" className="flex gap-1 rounded-lg bg-muted p-1">
          {option('amount', 'Fixed amount')}
          {option('percent', 'Share of contract', !canPercent)}
        </div>
        {!canPercent && <p className="text-xs text-muted-foreground">A share of the contract needs a contract value on the project.</p>}
        {mode === 'amount' ? (
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Amount ({currency})</span>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="For example 150000"
              aria-label="Amount"
            />
          </label>
        ) : (
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Percent of the contract value</span>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="For example 30"
              aria-label="Percent of contract value"
            />
            {preview != null && (
              <span className="block text-xs text-muted-foreground">
                {pct}% of {formatCurrency(contractValue ?? 0, currency)} is {formatCurrency(preview, currency)}
              </span>
            )}
          </label>
        )}
        {mode === 'amount' && amount.trim() !== '' && !validPrice(amount) && (
          <p className="text-sm text-destructive">Enter an amount above zero with at most two decimal places.</p>
        )}
        {mode === 'percent' && pct.trim() !== '' && !validPercent(pct) && (
          <p className="text-sm text-destructive">Enter a percent above 0 and at most 100.</p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
          {hasPrice(milestone) || milestone.amount_pct != null ? (
            <Button type="button" variant="ghost" onClick={clear} disabled={save.isPending}>
              Clear price
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? 'Saving...' : 'Save price'}
            </Button>
          </div>
        </div>
      </form>
    </QADialog>
  );
}
