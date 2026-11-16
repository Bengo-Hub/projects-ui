import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * A project the user cannot reach. projects-api answers 404 both for a project that does not exist
 * and for one the user is not a member of, so the copy covers both.
 */
export function ProjectNotFound({ orgSlug }: { orgSlug: string }) {
  return (
    <EmptyState
      icon={SearchX}
      title="Project not found"
      description="It may have been deleted, or you are not a member of it. Ask the project owner to add you to the team."
      action={
        <Link href={`/${orgSlug}/projects`} className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline">
          Back to your projects
        </Link>
      }
    />
  );
}
