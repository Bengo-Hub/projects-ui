'use client';

import { useParams } from 'next/navigation';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { useAutomations, useStatusRules } from '@/hooks/useAutomation';
import { useProjectPeople } from '@/hooks/usePeople';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useProjectStatuses } from '@/hooks/useTasks';
import { forbiddenKind, isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { AutomationsEditor } from './automations-editor';
import { StatusRulesEditor } from './status-rules-editor';

/**
 * A project's status rules and automations (US-16.7, US-16.8). Editing needs
 * projects.automation.manage; projects.automation.view sees them read only. Without
 * project_automation on the plan the stored rules stay dormant, so the page shows the lock.
 */
export default function AutomationPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasFeature = useFeature('project_automation');
  const { can } = useServicePermissions();
  const canManage = can(PERMS.automationManage);
  const statuses = useProjectStatuses(orgSlug, projectId);
  const rules = useStatusRules(orgSlug, projectId, hasFeature);
  const automations = useAutomations(orgSlug, projectId, hasFeature);
  const { people, nameOf } = useProjectPeople(orgSlug, projectId);

  const header = (
    <PageHeader
      title="Automation"
      subtitle={canManage ? 'Rules for moving tasks between columns, and what happens when they move' : 'The rules for this project. Only a project manager can change them.'}
      back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
      className="mb-0"
    />
  );

  if (!hasFeature || forbiddenKind(rules.error) === 'subscription' || forbiddenKind(automations.error) === 'subscription') {
    return (
      <div className="space-y-4">
        {header}
        <FeatureLocked title="Status rules and automations are a premium feature" description="Upgrade your plan to control how tasks move across the board and to assign, notify or update tasks automatically." />
      </div>
    );
  }
  if (statuses.isLoading || rules.isLoading || automations.isLoading) return <PageLoading />;
  if (isNotFound(rules.error) || isNotFound(statuses.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (statuses.isError || rules.isError || automations.isError || !rules.data || !automations.data) {
    return <ErrorBanner message="The project's rules could not be loaded." />;
  }

  const list = statuses.data ?? [];
  return (
    <div className="space-y-5">
      {header}
      <StatusRulesEditor key={JSON.stringify(rules.data)} orgSlug={orgSlug} projectId={projectId} statuses={list} saved={rules.data} editable={canManage} />
      <AutomationsEditor
        key={JSON.stringify(automations.data.data)}
        orgSlug={orgSlug}
        projectId={projectId}
        statuses={list}
        saved={automations.data.data ?? []}
        people={people}
        nameOf={nameOf}
        editable={canManage}
      />
    </div>
  );
}
