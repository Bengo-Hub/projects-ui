'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShieldX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useServicePermissions } from '@/hooks/usePermissions';
import { roleName } from '@/lib/auth/permissions';

/** Where a permission or tenant refusal on a page load lands. */
export default function UnauthorizedPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { serviceRole } = useServicePermissions();

  return (
    <div className="space-y-5">
      <PageHeader title="You do not have access to this page" className="mb-0" />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-start">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive" aria-hidden>
            <ShieldX className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-2 text-sm">
            <p>
              {serviceRole
                ? `Your projects role is ${roleName(serviceRole)}, and it does not include this page.`
                : 'Your projects role does not include this page.'}{' '}
              A projects administrator can give you a role that does, under Settings, Roles and access.
            </p>
            <p className="text-muted-foreground">If you opened a link from someone else, it may belong to a project you are not a member of.</p>
            <Link href={`/${orgSlug}/dashboard`} className="inline-flex h-11 items-center font-medium text-primary hover:underline">
              Back to the dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
