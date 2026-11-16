'use client';

import type { StreamState } from '@/hooks/useProjectStream';
import { cn } from '@/lib/utils';

const TEXT: Record<StreamState, string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  off: 'Not live',
};

/** Whether the project's live updates are flowing. Hidden when the stream is off (no permission). */
export function LiveDot({ state }: { state: StreamState }) {
  if (state === 'off') return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" title={state === 'live' ? 'Changes by others show up here as they happen' : undefined}>
      <span className={cn('h-2 w-2 rounded-full', state === 'live' ? 'bg-success' : 'animate-pulse bg-warning')} aria-hidden />
      <span className="max-sm:sr-only">{TEXT[state]}</span>
    </span>
  );
}
