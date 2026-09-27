import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
