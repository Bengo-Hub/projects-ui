'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { RichTextView } from '@/components/common/rich-text';
import { useTender } from '@/hooks/useTenders';
import { useTenderCommittees } from '@/hooks/useTenders';
import { useTenderMeetings } from '@/hooks/useTenders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';

export default function TenderDetailPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';

  const { data: tender, isLoading, isError } = useTender(orgSlug, tenderId);
  const { data: committeesData } = useTenderCommittees(orgSlug, tenderId);
  const { data: meetingsData } = useTenderMeetings(orgSlug, tenderId);

  const committees = committeesData?.data ?? [];
  const meetings = meetingsData?.data ?? [];

  if (isLoading) return <PageLoading />;
  if (isError || !tender) return <ErrorBanner message="Failed to load tender." />;

  const subNav = [
    { href: `/${orgSlug}/tenders/${tenderId}/committees`, label: 'Committees' },
    { href: `/${orgSlug}/tenders/${tenderId}/evaluations`, label: 'Evaluations' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tender.title}
        back={{ href: `/${orgSlug}/tenders`, label: 'All tenders' }}
        subtitle={
          <>
            <span className="font-mono text-xs">{tender.number}</span>
            <span className="block">{tender.client_name}</span>
          </>
        }
        className="mb-0"
        actions={
          <div className="flex flex-none gap-2">
            <Badge status={tender.status} />
            <Badge status={tender.priority} />
          </div>
        }
      />

      {/* Sub-navigation */}
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:px-0">
        {subNav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tender Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {tender.description && (
                <div>
                  <dt className="text-muted-foreground text-xs mb-1">Description</dt>
                  <dd><RichTextView value={tender.description} /></dd>
                </div>
              )}
              {tender.source && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="font-medium">{tender.source}</dd>
                </div>
              )}
              {tender.estimated_value != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Estimated Value
                  </dt>
                  <dd className="font-medium tabular">{formatCurrency(tender.estimated_value, tender.currency || 'KES')}</dd>
                </div>
              )}
              {tender.deadline && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Deadline
                  </dt>
                  <dd className="font-medium">{formatDate(tender.deadline)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Submission Type</dt>
                <dd className="font-medium capitalize">{tender.submission_type}</dd>
              </div>
              {tender.submitted_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Submitted At</dt>
                  <dd className="font-medium">{formatDate(tender.submitted_at)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(tender.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Committees summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Committees ({committees.length})</CardTitle>
                <Link
                  href={`/${orgSlug}/tenders/${tenderId}/committees`}
                  className="text-xs text-primary hover:underline"
                >
                  Manage
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {committees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No committees yet</p>
              ) : (
                <div className="space-y-1">
                  {committees.map((c) => (
                    <div key={c.id} className="text-sm py-1 border-b border-border last:border-0">
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meetings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meetings ({meetings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meetings scheduled</p>
              ) : (
                <div className="space-y-2">
                  {meetings.map((m) => (
                    <div key={m.id} className="text-sm border-b border-border last:border-0 pb-2">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(m.scheduled_at)}, {m.platform}
                      </p>
                      {m.meeting_url && (
                        <a
                          href={m.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Join
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
