'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { ChangeList } from '@/components/planning/change-list';
import { ChangeRequestDetail } from '@/components/planning/change-request-detail';
import { ChangeRequestDialog } from '@/components/planning/change-request-dialog';
import { useProjectChanges } from '@/hooks/useChangeRequests';
import { useProject } from '@/hooks/useProjects';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useTaskParam } from '@/hooks/useTaskParam';
import { isNotFound } from '@/lib/api/errors';
import type { ChangeStatus } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import { CHANGE_STATUS_LABEL } from '@/lib/planning/changes';

const LIMIT = 100;
const STATUS_OPTIONS: ComboboxOption[] = Object.entries(CHANGE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

/**
 * A project's change requests (US-16.4): scope, schedule and cost changes, who raised them and
 * how they were decided. The open request lives in the URL (?cr=<id>).
 */
export default function ChangesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const url = useTaskParam();
  const openId = url.get('cr');
  const { can } = useServicePermissions();
  const canAdd = can(PERMS.changeRequestsAdd);
  const project = useProject(orgSlug, projectId);
  const [status, setStatus] = useState<ChangeStatus | ''>('');
  const [raising, setRaising] = useState(false);
  const list = useProjectChanges(orgSlug, projectId, { limit: LIMIT, ...(status ? { status } : {}) });

  if (isNotFound(list.error) || isNotFound(project.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  const rows = list.data?.data ?? [];
  const total = list.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Changes"
        subtitle="Scope, schedule and cost changes waiting for approval or already decided"
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={
          canAdd ? (
            <Button className="h-11 sm:h-9" onClick={() => setRaising(true)} disabled={!project.data}>
              <Plus className="h-4 w-4" aria-hidden />
              Raise change
            </Button>
          ) : undefined
        }
      />
      <div className="sm:w-56">
        <SearchableCombobox options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus((v ?? '') as ChangeStatus | '')} placeholder="All statuses" searchPlaceholder="Status" />
      </div>
      <ChangeList
        rows={rows}
        loading={list.isLoading}
        error={list.isError}
        onRetry={() => void list.refetch()}
        onOpen={(cr) => url.setValue('cr', cr.id)}
        emptyText={status ? `No ${CHANGE_STATUS_LABEL[status].toLowerCase()} changes.` : 'No changes raised on this project yet.'}
      />
      {total > rows.length && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {rows.length} of {total}.
        </p>
      )}
      {raising && <ChangeRequestDialog orgSlug={orgSlug} project={project.data} onClose={() => setRaising(false)} onCreated={(id) => url.setValue('cr', id)} />}
      <ChangeRequestDetail orgSlug={orgSlug} projectId={projectId} id={openId} onClose={() => url.setValue('cr', null)} />
    </div>
  );
}
