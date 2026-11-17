'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LayoutTemplate, Trash2 } from 'lucide-react';
import { SearchInput, useDebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDeleteTemplate, useStartFromTemplate, useTemplates } from '@/hooks/useTemplates';
import type { TemplateSummary } from '@/lib/api/planning';
import { cn } from '@/lib/utils';

const inputClass = 'w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base sm:min-h-9 sm:text-sm';

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function facts(t: TemplateSummary) {
  const weeks = Math.max(1, Math.round(t.duration_days / 7));
  return `${t.task_count} ${t.task_count === 1 ? 'task' : 'tasks'}, ${t.phase_count} ${t.phase_count === 1 ? 'phase' : 'phases'}, about ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}

function StartForm({ orgSlug, template, onBack, onClose }: { orgSlug: string; template: TemplateSummary; onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [start, setStart] = useState(todayYmd);
  const startProject = useStartFromTemplate(orgSlug);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(start);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        startProject.mutate(
          { templateId: template.id, body: { start_date: start, ...(name.trim() ? { name: name.trim() } : {}) } },
          {
            onSuccess: (res) => {
              onClose();
              router.push(`/${orgSlug}/projects/${res.project.id}`);
            },
          },
        );
      }}
    >
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        All templates
      </button>
      <div className="rounded-md border border-border p-3">
        <p className="font-medium">{template.name}</p>
        {template.description && <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{facts(template)}</p>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Project name</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={template.name} aria-label="Project name" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Start date</span>
        <input type="date" required className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" />
        <span className="block text-xs text-muted-foreground">Every task and milestone is dated from here. You can move them later.</span>
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={startProject.isPending}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 sm:h-9" disabled={!ok || startProject.isPending}>
          {startProject.isPending ? 'Creating...' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}

/**
 * "New from template" (US-16.5): the template gallery, starter templates first, then the
 * organisation's own; picking one asks for a start date and a name and opens the new project.
 */
export function TemplateGallery({ orgSlug, canDelete, onClose }: { orgSlug: string; canDelete: boolean; onClose: () => void }) {
  const search = useDebouncedSearch();
  const { data, isLoading, isError } = useTemplates(orgSlug, search.term);
  const [picked, setPicked] = useState<TemplateSummary | null>(null);
  const [deleting, setDeleting] = useState<TemplateSummary | null>(null);
  const del = useDeleteTemplate(orgSlug);
  const list = data?.data ?? [];

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={picked ? 'Start the project' : 'New project from a template'} className="sm:max-w-2xl">
      {picked ? (
        <StartForm orgSlug={orgSlug} template={picked} onBack={() => setPicked(null)} onClose={onClose} />
      ) : (
        <div className="space-y-3">
          <SearchInput search={search} placeholder="Search templates" label="Search templates" busy={isLoading} className="w-full" />
          {isError ? (
            <p className="text-sm text-destructive">The templates could not be loaded.</p>
          ) : isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{search.term ? `No template matches "${search.term}".` : 'No templates yet.'}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="template-gallery">
              {list.map((t) => (
                <li key={t.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setPicked(t)}
                    className={cn('flex h-full min-h-24 w-full flex-col items-start gap-1 rounded-md border border-border p-3 text-left hover:border-primary hover:bg-accent/40', canDelete && !t.system && 'pr-12')}
                    aria-label={`Use template ${t.name}`}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="font-medium">{t.name}</span>
                    </span>
                    {t.system && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Starter</span>}
                    {t.description && <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>}
                    <span className="text-xs text-muted-foreground">{facts(t)}</span>
                  </button>
                  {canDelete && !t.system && (
                    <Button variant="ghost" className="absolute right-1 top-1 h-11 w-11 p-0 text-destructive sm:h-9 sm:w-9" onClick={() => setDeleting(t)} aria-label={`Delete template ${t.name}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete the template "${deleting?.name ?? ''}"?`}
        description="Projects already started from it stay as they are."
        confirmLabel="Delete template"
        variant="danger"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </QADialog>
  );
}
