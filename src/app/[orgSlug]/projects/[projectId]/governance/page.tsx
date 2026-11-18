'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Gavel, Grid3x3, Landmark } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { PageHeader } from '@/components/common/page-header';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { DecisionLog } from '@/components/governance/decision-log';
import { GovernanceRoles } from '@/components/governance/governance-roles';
import { RaciMatrix } from '@/components/governance/raci-matrix';
import { useProjectPeople } from '@/hooks/usePeople';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'roles', label: 'Governance roles', icon: Landmark },
  { key: 'raci', label: 'RACI matrix', icon: Grid3x3 },
  { key: 'decisions', label: 'Decision log', icon: Gavel },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/**
 * A project's governance (sprint 7, US-7.1): who sponsors and steers it, who is responsible,
 * accountable, consulted and informed for each activity, and the decisions taken with their
 * approvals. projects.governance.view reads all three and answers a decision that names the
 * reader as an approver; projects.governance.manage edits.
 */
export default function GovernancePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasFeature = useFeature('project_management');
  const { can } = useServicePermissions();
  const canManage = can(PERMS.governanceManage);
  const { people, nameOf, me } = useProjectPeople(orgSlug, projectId);
  const [tab, setTab] = useState<TabKey>('roles');

  const header = (
    <PageHeader
      title="Governance"
      subtitle={canManage ? 'Who steers the project, who does what, and the decisions on record' : 'Who steers the project, who does what, and the decisions on record. Only a project manager can change them.'}
      back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
      className="mb-0"
    />
  );

  if (!hasFeature) {
    return (
      <div className="space-y-4">
        {header}
        <FeatureLocked title="Governance needs project management" description="Upgrade your plan to keep governance roles, a RACI matrix and a decision log on your projects." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <div role="tablist" aria-label="Governance sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
        {tab === 'roles' && <GovernanceRoles orgSlug={orgSlug} projectId={projectId} canManage={canManage} people={people} />}
        {tab === 'raci' && <RaciMatrix orgSlug={orgSlug} projectId={projectId} canManage={canManage} people={people} nameOf={nameOf} />}
        {tab === 'decisions' && <DecisionLog orgSlug={orgSlug} projectId={projectId} canManage={canManage} people={people} nameOf={nameOf} me={me} />}
      </div>
    </div>
  );
}
