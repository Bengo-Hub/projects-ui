'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Send, Trash2, UserRoundPlus, Users } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { useClientPortalAccess, useInviteClient, useProjectClients, useRevokeClient } from '@/hooks/useClients';
import { isNotFound } from '@/lib/api/errors';
import { projectsApi, type LookupOption } from '@/lib/api/projects';
import { clientStatusLabel, portalBase } from '@/lib/portal/logic';
import type { ProjectClient } from '@/types/portal';

const toOption = (o: LookupOption): ComboboxOption => ({ value: o.id, label: o.name, hint: o.detail });

/**
 * Pick a marketflow contact and invite them, the same picker as the project's contract card. The
 * contact lookup opens to portal.manage, the same code this page needs.
 */
function InviteForm({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const [contact, setContact] = useState({ id: '', name: '' });
  const invite = useInviteClient(orgSlug, projectId);
  const { data: initial = [], isLoading } = useQuery({
    queryKey: ['lookups', orgSlug, 'contacts', ''],
    queryFn: () => projectsApi.searchContacts(orgSlug, ''),
    staleTime: 60_000,
  });

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!contact.id) return;
        invite.mutate(contact, { onSuccess: () => setContact({ id: '', name: '' }) });
      }}
    >
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <span className="text-xs text-muted-foreground">Client contact (from the CRM)</span>
        <SearchableCombobox
          options={initial.map(toOption)}
          value={contact.id}
          valueLabel={contact.name}
          onChange={(id, opt) => setContact({ id, name: opt?.label ?? '' })}
          onRemoteSearch={async (q) => (await projectsApi.searchContacts(orgSlug, q)).map(toOption)}
          loading={isLoading}
          placeholder="Choose a contact"
          searchPlaceholder="Search name, email or phone"
          emptyText="No matching contacts"
          clearable
        />
      </div>
      <Button type="submit" className="h-11 sm:h-9" disabled={!contact.id || invite.isPending}>
        <Send className="h-4 w-4" aria-hidden />
        {invite.isPending ? 'Sending...' : 'Send invite'}
      </Button>
    </form>
  );
}

/**
 * The project's clients: who was invited from the CRM and who has signed in to the portal. An
 * invite again for someone still at the invite stage re-sends it; removing ends access at once.
 */
export default function ProjectClientsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const access = useClientPortalAccess();
  const list = useProjectClients(orgSlug, projectId, access.canManage);
  const revoke = useRevokeClient(orgSlug, projectId);
  const [removing, setRemoving] = useState<ProjectClient | null>(null);
  const clients = list.data ?? [];

  const columns = useMemo<DataTableColumn<ProjectClient>[]>(
    () => [
      {
        key: 'name',
        header: 'Client',
        primary: true,
        sortable: true,
        accessor: (c) => c.name || c.email_hint,
        render: (c) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.name || 'Unnamed contact'}</span>
            <span className="block truncate text-xs text-muted-foreground">{c.email_hint}</span>
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        filterable: true,
        accessor: (c) => clientStatusLabel(c.status),
        render: (c) => <Badge status={c.status}>{clientStatusLabel(c.status)}</Badge>,
      },
      {
        key: 'invited_at',
        header: 'Invited',
        sortable: true,
        render: (c) => <span className="text-muted-foreground">{c.invited_at ? formatDate(c.invited_at) : '-'}</span>,
      },
      {
        key: 'activated_at',
        header: 'First signed in',
        sortable: true,
        render: (c) => <span className="text-muted-foreground">{c.activated_at ? formatDate(c.activated_at) : 'Not yet'}</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (c) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRemoving(c);
            }}
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${c.name || c.email_hint}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ),
      },
    ],
    [],
  );

  if (!access.isLoading && !access.feature) {
    return <FeatureLocked title="The client portal is not on your plan" description="Upgrade your plan to invite clients to follow and approve the work." />;
  }
  if (list.isLoading) return <PageLoading />;
  if (isNotFound(list.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (list.isError) return <ErrorBanner message="The clients could not be loaded." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={clients.length > 0 ? `Clients (${clients.length})` : 'Clients'}
        subtitle={`Clients follow progress, approve milestones and message the team at ${portalBase(orgSlug)}. They see only the tasks and files you mark visible.`}
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
      />
      <Card>
        <CardContent className="space-y-2 pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserRoundPlus className="h-4 w-4" aria-hidden />
            Invite a client
          </h2>
          <InviteForm orgSlug={orgSlug} projectId={projectId} />
        </CardContent>
      </Card>
      {clients.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" description="Invite the client's contact so they can follow the project without email back and forth." />
      ) : (
        <DataTable columns={columns} rows={clients} rowKey={(c) => c.id} gridLines="rows" storageKey="projects-clients-columns" />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this client?"
        description={removing ? `${removing.name || removing.email_hint} loses portal access to this project at once. You can invite them again later.` : undefined}
        confirmLabel="Remove"
        variant="danger"
        loading={revoke.isPending}
        onConfirm={() => removing && revoke.mutate(removing.id, { onSettled: () => setRemoving(null) })}
      />
    </div>
  );
}
