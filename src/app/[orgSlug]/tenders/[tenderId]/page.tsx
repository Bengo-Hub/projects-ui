'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { useTender } from '@/hooks/useTenders';
import { useTenderCommittees } from '@/hooks/useTenders';
import { useTenderMeetings } from '@/hooks/useTenders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { format } from 'date-fns';

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
      <div>
        <Link
          href={`/${orgSlug}/tenders`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          All Tenders
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-1">{tender.number}</p>
            <h1 className="text-2xl font-bold">{tender.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tender.client_name}</p>
          </div>
          <div className="flex gap-2">
            <Badge status={tender.status} />
            <Badge status={tender.priority} />
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-border">
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
                  <dd>{tender.description}</dd>
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
                  <dd className="font-medium">
                    {tender.currency} {tender.estimated_value.toLocaleString()}
                  </dd>
                </div>
              )}
              {tender.deadline && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Deadline
                  </dt>
                  <dd className="font-medium">{format(new Date(tender.deadline), 'MMM d, yyyy')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Submission Type</dt>
                <dd className="font-medium capitalize">{tender.submission_type}</dd>
              </div>
              {tender.submitted_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Submitted At</dt>
                  <dd className="font-medium">{format(new Date(tender.submitted_at), 'MMM d, yyyy')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{format(new Date(tender.created_at), 'MMM d, yyyy')}</dd>
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
                        {format(new Date(m.scheduled_at), 'MMM d, yyyy HH:mm')} · {m.platform}
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
