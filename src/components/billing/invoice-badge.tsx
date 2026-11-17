import { INVOICE_STATE_LABEL, invoiceState, type InvoiceLike, type InvoiceState } from '@/lib/billing/logic';
import { cn } from '@/lib/utils';

const TONE: Record<InvoiceState, string> = {
  paid: 'bg-success/15 text-success',
  overdue: 'bg-destructive/10 text-destructive',
  partial: 'bg-warning/15 text-warning',
  void: 'bg-muted text-muted-foreground line-through',
  draft: 'bg-muted text-muted-foreground',
  to_send: 'bg-warning/10 text-warning',
  unpaid: 'bg-primary/10 text-primary',
};

/** One badge for an invoice: paid, partly paid, overdue, void, draft, ready to send or unpaid. */
export function InvoiceBadge({ invoice, className }: { invoice: InvoiceLike; className?: string }) {
  const state = invoiceState(invoice);
  return (
    <span
      data-testid="invoice-badge"
      data-state={state}
      className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', TONE[state], className)}
    >
      {INVOICE_STATE_LABEL[state]}
    </span>
  );
}
