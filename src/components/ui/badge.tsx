import * as React from 'react';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  // Project statuses
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  // Task statuses
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  // Priority
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  // Milestone
  pending: 'bg-gray-100 text-gray-700',
  missed: 'bg-red-100 text-red-700',
  // Tender
  draft: 'bg-slate-100 text-slate-600',
  evaluating: 'bg-purple-100 text-purple-700',
  submitted: 'bg-blue-100 text-blue-700',
  awarded: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: string;
  variant?: 'default' | 'outline';
}

export function Badge({ className, status, variant = 'default', children, ...props }: BadgeProps) {
  const colorClass = status ? (statusColors[status] ?? 'bg-gray-100 text-gray-700') : '';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'outline' ? 'border border-current bg-transparent' : colorClass,
        className
      )}
      {...props}
    >
      {children ?? status?.replace(/_/g, ' ')}
    </span>
  );
}
