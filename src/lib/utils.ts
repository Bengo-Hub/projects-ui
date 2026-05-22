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
