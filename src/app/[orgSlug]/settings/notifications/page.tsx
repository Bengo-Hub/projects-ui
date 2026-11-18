'use client';

import { useParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageHeader } from '@/components/common/page-header';
import { ListError } from '@/components/common/list-parts';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { Card, CardContent } from '@/components/ui/card';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useDigestSettings, useSaveDigest } from '@/hooks/useStatusReports';
import { PERMS, isAdminTier } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';

/**
 * Organisation-wide notices from Projects (sprint 7). The weekly digest goes out on Monday
 * morning to each staff member with something in it; anyone with projects.reports.view sees the
 * switch, and only an administrator (with projects.reports.manage) can change it.
 */
function NotificationSettings() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const hasFeature = useFeature('project_management');
  const { profile, subject, can } = useServicePermissions();
  const canChange = isAdminTier(profile, !!subject?.bypass) && can(PERMS.reportsManage);
  const q = useDigestSettings(orgSlug, hasFeature);
  const save = useSaveDigest(orgSlug);

  const header = <PageHeader title="Notifications" subtitle="What Projects sends your team on its own" className="mb-0" />;

  if (!hasFeature) {
    return (
      <div className="space-y-4">
        {header}
        <FeatureLocked title="Notifications need project management" description="Upgrade your plan to send your team a weekly digest of their projects." />
      </div>
    );
  }

  const on = q.data?.weekly_enabled ?? false;
  return (
    <div className="space-y-5">
      {header}
      {q.isError ? (
        <ListError error={q.error} title="The digest setting could not be loaded." onRetry={() => void q.refetch()} />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
                <Mail className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h2 id="digest-label" className="font-semibold">
                  Weekly digest
                </h2>
                <p id="digest-help" className="text-sm text-muted-foreground">
                  Every Monday at 08:00 Nairobi time, each staff member gets one email with their overdue tasks, what is due this week, milestones and rising risks on the projects they
                  lead, and the approvals waiting for them. People with nothing to report get nothing.
                </p>
                {!canChange && <p className="text-xs text-muted-foreground" data-testid="digest-admin-note">Only an administrator can change this.</p>}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby="digest-label"
              aria-describedby="digest-help"
              disabled={!canChange || q.isLoading || save.isPending}
              onClick={() => save.mutate({ weekly_enabled: !on })}
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-3 self-start rounded-full border px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                on ? 'border-primary bg-primary/10' : 'border-border bg-muted',
              )}
              data-testid="digest-switch"
            >
              <span className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted-foreground/40')} aria-hidden>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all', on ? 'left-[1.375rem]' : 'left-0.5')} />
              </span>
              <span className="pr-2">{q.isLoading ? 'Loading' : on ? 'On' : 'Off'}</span>
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function NotificationSettingsPage() {
  return (
    <RequirePermission anyOf={PERMS.reportsView}>
      <NotificationSettings />
    </RequirePermission>
  );
}
