import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** hasId is false for a missing id and for the nil UUID, which the API sends for unset optional ids. */
export function hasId(id?: string | null): id is string {
  return !!id && id !== NIL_UUID;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatCurrency(amount?: number, currency = 'KES'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount);
}

// formatCompact shortens large amounts for KPI cards (1.2M, 450K), with the currency code.
export function formatCompact(amount: number, currency = 'KES'): string {
  const n = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  return `${currency} ${n}`;
}
