'use client';

import { Lock } from 'lucide-react';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';

/**
 * Full-section locked state shown when a premium feature/tab is not in the tenant's plan.
 * Pair with <FeatureGate feature="x" fallback={<FeatureLocked .../>}> to guard whole pages.
 */
export function FeatureLocked({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
        <Lock className="h-5 w-5 text-amber-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      <a
        href={UPGRADE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
      >
        <Lock className="h-4 w-4" />
        Upgrade to unlock
      </a>
    </div>
  );
}
