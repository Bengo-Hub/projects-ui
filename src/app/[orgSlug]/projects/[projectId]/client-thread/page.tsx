'use client';

import { useParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { ClientThread } from '@/components/portal/client-thread';
import { useClientPortalAccess, useClientThread, usePostClientThread } from '@/hooks/useClients';
import { useServicePermissions } from '@/hooks/usePermissions';
import { isNotFound } from '@/lib/api/errors';

/**
 * The project's client thread for the team: what the client reads and writes in the portal. It
 * never mixes with the team's own comments, and nobody can be @mentioned here.
 */
export default function ClientThreadPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const access = useClientPortalAccess();
  const { profile } = useServicePermissions();
  const thread = useClientThread(orgSlug, projectId, access.canViewThread);
  const post = usePostClientThread(orgSlug, projectId);

  if (!access.isLoading && !access.feature) {
    return <FeatureLocked title="The client portal is not on your plan" description="Upgrade your plan to talk with clients in the portal." />;
  }
  if (isNotFound(thread.error)) return <ProjectNotFound orgSlug={orgSlug} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Client thread"
        subtitle="Messages here are shared with the project's clients in the portal. Use task comments for team-only talk."
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
      />
      <p className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        Clients read everything posted on this page.
      </p>
      <ClientThread
        items={thread.items}
        loading={thread.isLoading}
        error={thread.isError}
        onRetry={() => void thread.refetch()}
        hasMore={!!thread.hasNextPage}
        loadingMore={thread.isFetchingNextPage}
        onMore={() => void thread.fetchNextPage()}
        meId={profile?.user_id}
        canPost={access.canPostThread}
        posting={post.isPending}
        onPost={(content, done) => post.mutate(content, { onSuccess: done })}
        emptyText="No messages with the client yet."
        placeholder="Write to the client"
      />
    </div>
  );
}
