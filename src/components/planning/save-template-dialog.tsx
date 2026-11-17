'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useSaveAsTemplate } from '@/hooks/useTemplates';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

/**
 * "Save as template" (US-16.5, projects.templates.add): the project's phases, tasks, durations,
 * links, roles, board columns and status rules, without dates or people.
 */
export function SaveTemplateDialog({ orgSlug, projectId, projectName, onClose }: { orgSlug: string; projectId: string; projectName: string; onClose: () => void }) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const save = useSaveAsTemplate(orgSlug, projectId);
  const trimmed = name.trim();
  const ok = !!trimmed && trimmed.length <= 120;
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Save as a template" description="Keeps the plan (phases, tasks, durations, links and roles) without dates or people, to start the next project like this one.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          save.mutate(
            { name: trimmed, ...(description.trim() ? { description: description.trim() } : {}), ...(category.trim() ? { category: category.trim() } : {}) },
            { onSuccess: onClose },
          );
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Template name</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Template name" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Category</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="For example: fit-out" aria-label="Template category" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea className={`${inputClass} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Template description" />
        </label>
        {!ok && <p className="text-xs text-destructive">Give the template a name of at most 120 characters.</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={!ok || save.isPending}>
            {save.isPending ? 'Saving...' : 'Save template'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}
