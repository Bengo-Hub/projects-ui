'use client';

import { AlertCircle, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { BILLING_URL } from '@/components/subscription/subscription-banner';
import { creditsLine, type AIErrorInfo, type Credits, type Review } from '@/lib/ai/drafts';

/**
 * The refusal of an AI ask, inline where it was asked: a top up link when credits ran out, a retry
 * (same request key, so never charged twice) when the provider or the wallet was briefly down.
 */
export function AIErrorBlock({ info, onRetry, retrying }: { info: AIErrorInfo; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" data-testid="ai-error">
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{info.message}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {info.topUp && (
          <a
            href={BILLING_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent sm:min-h-9"
          >
            Buy AI credits
          </a>
        )}
        {info.retry && onRetry && (
          <Button variant="outline" className="h-11 sm:h-9" onClick={onRetry} disabled={retrying}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

/** While the assistant works. */
export function AIWorking({ text = 'Drafting...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground" aria-live="polite">
      <Loading size="sm" />
      <span>{text}</span>
    </div>
  );
}

/**
 * The footer of every draft: it is a draft, what it cost, and the assistant's own review notes
 * (figures or promises it could not trace to the data, or text that looked like an instruction).
 */
export function DraftNotice({ credits, review }: { credits?: Credits; review?: Partial<Review> }) {
  const notes = review?.review_notes ?? [];
  return (
    <div className="space-y-2 text-xs text-muted-foreground" data-testid="ai-draft-notice">
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          AI draft. Nothing is saved until you choose. {creditsLine(credits)}
          {review?.stopped_early ? ' The answer may be cut short.' : ''}
        </span>
      </p>
      {(notes.length > 0 || review?.tainted) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Check before you use it</p>
          <ul className="list-disc pl-4">
            {review?.tainted && <li>Some project text read like instructions to the assistant; it was treated as data only.</li>}
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
