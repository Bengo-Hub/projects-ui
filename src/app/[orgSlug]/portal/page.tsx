'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, ChevronRight, FolderOpen, MailWarning } from 'lucide-react';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useTenantBranding } from '@bengo-hub/shared-ui-lib/tenant';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PortalProgress } from '@/components/portal/portal-progress';
import { PortalRefused } from '@/components/portal/portal-refused';
import { usePortalProjects } from '@/hooks/usePortal';
import { landingNote, portalBase, verifyEmailUrl } from '@/lib/portal/logic';
import { usePortalAuthStore } from '@/store/portal-auth';
import type { PortalProjectListItem } from '@/types/portal';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_AUTH_UI_URL ?? 'https://accounts.codevertexafrica.com';

/** Shown when invites wait for a verified address (X-Client-Invites: email_not_verified). */
function VerifyEmailBanner() {
  return (
    <div role="status" data-testid="verify-email-banner" className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-medium">Verify your email to open the projects shared with you</p>
        <p className="text-muted-foreground">
          The firm invited your email address. Confirm it on your Codevertex account, then come back here and the projects appear.
        </p>
        <a
          href={verifyEmailUrl(ACCOUNTS_URL)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Verify my email
        </a>
      </div>
    </div>
  );
}

function ProjectCard({ orgSlug, project }: { orgSlug: string; project: PortalProjectListItem }) {
  // The list carries each project's progress, so a card never asks for its own summary.
  const note = landingNote(project.progress);
  return (
    <li>
      <Link
        href={`${portalBase(orgSlug)}/projects/${project.id}`}
        className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
        data-testid="portal-project-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="wrap-break-word text-base font-semibold">{project.name}</h2>
            {(project.start_date || project.end_date) && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {project.start_date ? formatDate(project.start_date) : 'Start not set'}
                {' to '}
                {project.end_date ? formatDate(project.end_date) : 'end not set'}
              </p>
            )}
          </div>
          <Badge status={project.status} className="shrink-0 capitalize" />
        </div>
        <PortalProgress value={project.progress?.percent} className="mt-4" />
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className={(project.progress?.awaiting_review ?? 0) > 0 ? 'font-medium text-foreground' : undefined}>{note}</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

export default function PortalHomePage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { tenant } = useTenantBranding();
  const firm = tenant?.orgName || tenant?.name || 'the firm';
  const name = usePortalAuthStore((s) => s.user?.fullName?.split(' ')[0] ?? '');
  const { projects, needsVerification, refusal, isLoading, isError, refetch } = usePortalProjects(orgSlug);

  if (refusal === 'not_client' || refusal === 'no_feature') return <PortalRefused kind={refusal} firm={firm} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">{name ? `Hello ${name}` : 'Your projects'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Projects {firm} shares with you.</p>
      </div>

      {needsVerification && <VerifyEmailBanner />}

      {isLoading ? (
        <ul className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </ul>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <span>Your projects could not be loaded.</span>
          <button type="button" onClick={() => void refetch()} className="h-10 rounded-md border border-border bg-background px-3 text-foreground">
            Try again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description={
            needsVerification
              ? 'Once your email is verified, the projects you were invited to show here.'
              : `When ${firm} shares a project with you, it shows here.`
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} orgSlug={orgSlug} project={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
