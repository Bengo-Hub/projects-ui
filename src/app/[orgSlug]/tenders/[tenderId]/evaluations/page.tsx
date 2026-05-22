'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { useTenderEvaluations, useSubmitEvaluation } from '@/hooks/useTenders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import type { CreateEvaluationInput } from '@/lib/api/tenders';

function SubmitEvaluationModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: CreateEvaluationInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateEvaluationInput>({ score: 0, notes: '', criteria: '' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Submit Evaluation</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Score (0-100) *</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: Number(e.target.value) }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Criteria</label>
            <input
              type="text"
              value={form.criteria ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, criteria: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. technical, financial"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EvaluationsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';
  const [showSubmit, setShowSubmit] = useState(false);

  const { data, isLoading, isError } = useTenderEvaluations(orgSlug, tenderId);
  const submitEvaluation = useSubmitEvaluation(orgSlug, tenderId);

  const evaluations = data?.data ?? [];
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length)
    : null;

  function handleSubmit(input: CreateEvaluationInput) {
    submitEvaluation.mutate(input, { onSuccess: () => setShowSubmit(false) });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load evaluations." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Evaluations</h2>
          {avgScore !== null && (
            <p className="text-sm text-muted-foreground">Average score: {avgScore}/100</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowSubmit(true)}>
          <Plus className="h-4 w-4" />
          Submit Evaluation
        </Button>
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No evaluations yet"
          description="Submit the first evaluation for this tender."
          action={
            <Button size="sm" onClick={() => setShowSubmit(true)}>
              <Plus className="h-4 w-4" />
              Submit Evaluation
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{evaluations.length} Evaluation(s)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {evaluations.map((ev) => (
                <div key={ev.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{ev.score}</span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                      {ev.criteria && (
                        <span className="text-xs bg-secondary rounded px-1.5 py-0.5 capitalize">{ev.criteria}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ev.evaluated_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted mt-2">
                    <div
                      className={`h-1.5 rounded-full ${ev.score >= 70 ? 'bg-green-500' : ev.score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${ev.score}%` }}
                    />
                  </div>
                  {ev.notes && <p className="text-xs text-muted-foreground mt-2">{ev.notes}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showSubmit && (
        <SubmitEvaluationModal
          onClose={() => setShowSubmit(false)}
          onSubmit={handleSubmit}
          isPending={submitEvaluation.isPending}
        />
      )}
    </div>
  );
}
