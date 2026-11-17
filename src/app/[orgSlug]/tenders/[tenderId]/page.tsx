'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { PageHeader } from '@/components/common/page-header';
import { RichTextView } from '@/components/common/rich-text';
import { useEvaluationSummary, useTender, useTenderCommittees, useTenderMeetings, useTenderSections } from '@/hooks/useTenders';
import { useServicePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { TenderNav } from '@/components/tenders/tender-nav';
import { ConversionCard, DecisionSummary, OutcomeSummary, StatusActions } from '@/components/tenders/lifecycle-cards';
import { DecisionDialog } from '@/components/tenders/decision-dialog';
import { OutcomeDialog } from '@/components/tenders/outcome-dialog';
import { ConvertDialog } from '@/components/tenders/convert-dialog';
import { EditTenderDialog } from '@/components/tenders/edit-tender-dialog';
import { BidBudgetCard } from '@/components/tenders/bid-budget-card';
import { PERMS } from '@/lib/auth/permissions';
import { canDecide, canRecordOutcome, canSubmit, displayStatus, tenderStatusLabel } from '@/lib/tenders/logic';

export default function TenderDetailPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';
  const [dialog, setDialog] = useState<'decision' | 'outcome' | 'convert' | 'edit' | null>(null);

  const { data: tender, isLoading, isError } = useTender(orgSlug, tenderId);
  const { data: committeesData } = useTenderCommittees(orgSlug, tenderId);
  const { data: meetingsData } = useTenderMeetings(orgSlug, tenderId);
  const sections = useTenderSections(orgSlug, tenderId);
  const summary = useEvaluationSummary(orgSlug, tenderId);
  const { can } = useServicePermissions();
  const canManage = can(PERMS.tendersManage);
  const canChange = can(PERMS.tendersChange);
  const canConvert = canManage && can(PERMS.projectsAdd);

  const committees = committeesData?.data ?? [];
  const meetings = meetingsData?.data ?? [];

  if (isLoading) return <PageLoading />;
  if (isError || !tender) return <ErrorBanner message="Failed to load tender." />;

  const converted = !!tender.metadata?.conversion;
  const sectionSummary = sections.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tender.title}
        back={{ href: `/${orgSlug}/tenders`, label: 'All tenders' }}
        subtitle={
          <>
            <span className="font-mono text-xs">{tender.number}</span>
            <span className="block">
              {tender.metadata?.crm_contact_name || tender.client_name}
            </span>
          </>
        }
        className="mb-0"
        actions={
          <div className="flex flex-none gap-2">
            <Badge status={displayStatus(tender.status)}>{tenderStatusLabel(tender.status)}</Badge>
            <Badge status={tender.priority} />
          </div>
        }
      />

      <TenderNav orgSlug={orgSlug} tenderId={tenderId} />

      {/* What comes next. */}
      <div className="flex flex-wrap gap-2">
        {canManage && canDecide(tender.status) && (
          <Button className="h-11 sm:h-9" onClick={() => setDialog('decision')}>
            {tender.metadata?.go_decision ? 'Decide again' : 'Go or no go'}
          </Button>
        )}
        {canManage && canSubmit(tender.status) && (
          <Link
            href={`/${orgSlug}/tenders/${tenderId}/submissions`}
            className={buttonVariants({ variant: tender.status === 'preparing' ? 'default' : 'outline', className: 'h-11 sm:h-9' })}
          >
            {tender.status === 'preparing' ? 'Submit the bid' : 'Record another submission'}
          </Link>
        )}
        {canManage && canRecordOutcome(tender.status) && (
          <Button className="h-11 sm:h-9" onClick={() => setDialog('outcome')}>
            Record the outcome
          </Button>
        )}
        {canConvert && tender.status === 'awarded' && !converted && (
          <Button className="h-11 sm:h-9" onClick={() => setDialog('convert')}>
            Convert to a project
          </Button>
        )}
        {canChange && (
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => setDialog('edit')}>
            Edit details
          </Button>
        )}
        {canChange && <StatusActions orgSlug={orgSlug} tender={tender} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <ConversionCard orgSlug={orgSlug} tender={tender} />
          <OutcomeSummary tender={tender} />
          <BidBudgetCard key={tender.updated_at} orgSlug={orgSlug} tender={tender} canEdit={canChange} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Go or no go</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DecisionSummary tender={tender} />
              {summary.data && summary.data.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Committee: {summary.data.count} {summary.data.count === 1 ? 'evaluation' : 'evaluations'}, average {summary.data.average_score}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sections</CardTitle>
                <Link href={`/${orgSlug}/tenders/${tenderId}/sections`} className="text-xs text-primary hover:underline">
                  Open
                </Link>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              {!sectionSummary || sectionSummary.total === 0 ? (
                <p className="text-muted-foreground">The bid is not split into sections.</p>
              ) : (
                <p data-testid="sections-progress">
                  {sectionSummary.by_status.approved ?? 0} of {sectionSummary.total} approved{sectionSummary.ready ? ': ready to submit' : ''}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tender details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {tender.description && (
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">Description</dt>
                    <dd>
                      <RichTextView value={tender.description} />
                    </dd>
                  </div>
                )}
                {(tender.metadata?.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1" aria-label="Tags">
                    {tender.metadata?.tags?.map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {tender.source && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-medium">{tender.source}</dd>
                  </div>
                )}
                {tender.estimated_value != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      Estimated value
                    </dt>
                    <dd className="font-medium tabular">{formatCurrency(tender.estimated_value, tender.currency || 'KES')}</dd>
                  </div>
                )}
                {tender.deadline && (
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Deadline
                    </dt>
                    <dd className="font-medium">{formatDate(tender.deadline)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Submission type</dt>
                  <dd className="font-medium capitalize">{tender.submission_type}</dd>
                </div>
                {tender.submitted_at && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Submitted</dt>
                    <dd className="font-medium">{formatDate(tender.submitted_at)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{formatDate(tender.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Committees ({committees.length})</CardTitle>
                <Link href={`/${orgSlug}/tenders/${tenderId}/committees`} className="text-xs text-primary hover:underline">
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
                    <div key={c.id} className="border-b border-border py-1 text-sm last:border-0">
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                    <div key={m.id} className="border-b border-border pb-2 text-sm last:border-0">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(m.scheduled_at)}, {m.platform}
                      </p>
                      {m.meeting_url && (
                        <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline">
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

      {dialog === 'decision' && (
        <DecisionDialog orgSlug={orgSlug} tenderId={tenderId} summary={summary.data} previous={tender.metadata?.go_decision} onClose={() => setDialog(null)} />
      )}
      {dialog === 'outcome' && <OutcomeDialog orgSlug={orgSlug} tender={tender} onClose={() => setDialog(null)} />}
      {dialog === 'convert' && <ConvertDialog orgSlug={orgSlug} tender={tender} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditTenderDialog orgSlug={orgSlug} tender={tender} onClose={() => setDialog(null)} />}
    </div>
  );
}
