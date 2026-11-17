'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FolderKanban, Users, Calendar, LayoutTemplate } from 'lucide-react';
import { TemplateGallery } from '@/components/planning/template-gallery';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';
import { useDebouncedSearch } from '@bengo-hub/shared-ui-lib/search';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useProjects, useCreateProject } from '@/hooks/useProjects';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ListError, ListFilters, ListSearch } from '@/components/common/list-parts';
import { RichTextField, toPlainText } from '@/components/common/rich-text';
import type { CreateProjectInput } from '@/lib/api/projects';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
// One page large enough for the search box to cover a normal portfolio; projects-api filters
// by status server side and has no text search yet, so the search runs over this page.
const PAGE_LIMIT = 100;

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring';

function CreateProjectModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: CreateProjectInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CreateProjectInput>({ name: '', description: '', currency: 'KES' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card p-4 shadow-lg sm:mx-4 sm:rounded-xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">New project</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="project-name" className="mb-1 block text-sm font-medium">Name *</label>
            <input
              id="project-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="Project name"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Description</span>
            <RichTextField
              value={form.description ?? ''}
              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              placeholder="Optional description"
              ariaLabel="Description"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="project-start" className="mb-1 block text-sm font-medium">Start date</label>
              <input
                id="project-start"
                type="date"
                value={form.start_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || undefined }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="project-end" className="mb-1 block text-sm font-medium">End date</label>
              <input
                id="project-end"
                type="date"
                value={form.end_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || undefined }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.name.trim()}>
              {isPending ? 'Creating...' : 'Create project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const search = useDebouncedSearch();

  const { data, isLoading, isError, error, refetch, isFetching } = useProjects(orgSlug, { status: status || undefined, limit: PAGE_LIMIT });
  const createProject = useCreateProject(orgSlug);
  const { can } = useServicePermissions();
  const canAdd = can(PERMS.projectsAdd);
  // Starting from a template needs projects.add and templates.view (sprint 16).
  const canUseTemplates = canAdd && can(PERMS.templatesView);
  const [showTemplates, setShowTemplates] = useState(false);

  const projects = useMemo(() => {
    const all = data?.data ?? [];
    const term = search.term.toLowerCase();
    if (!term) return all;
    return all.filter((p) => p.name.toLowerCase().includes(term) || toPlainText(p.description).toLowerCase().includes(term));
  }, [data, search.term]);

  function handleCreate(input: CreateProjectInput) {
    createProject.mutate(input, {
      onSuccess: () => setShowCreate(false),
    });
  }

  const filtered = !!status || !!search.term;
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label.toLowerCase();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        subtitle={`${data?.total ?? 0} ${status ? statusLabel : 'total'} projects`}
        className="mb-0"
        actions={
          canAdd ? (
            <>
              {canUseTemplates && (
                <Button variant="outline" onClick={() => setShowTemplates(true)} className="h-11 sm:h-8 sm:px-3 sm:text-xs">
                  <LayoutTemplate className="h-4 w-4" />
                  New from template
                </Button>
              )}
              <Button onClick={() => setShowCreate(true)} size="sm" className="h-11 sm:h-8">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <ListSearch search={search} label="Search projects" busy={isFetching} />
        <ListFilters active={status ? 1 : 0} className="w-full sm:w-52">
          <SearchableCombobox
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v)}
            placeholder="All statuses"
            searchPlaceholder="Find a status"
          />
        </ListFilters>
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <ListError error={error} title="The projects could not be loaded." onRetry={() => void refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            search.term
              ? `Nothing matches "${search.term}".`
              : status
                ? `No ${statusLabel} projects.`
                : canAdd
                  ? 'Create your first project to get started.'
                  : 'You are not on any project yet. A project owner can add you to the team.'
          }
          action={
            !filtered && canAdd ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/${orgSlug}/projects/${project.id}`} className="min-w-0">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold">{project.name}</h3>
                    <Badge status={project.status} className="shrink-0" />
                  </div>
                  {project.description && (
                    <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{toPlainText(project.description)}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    {project.edges?.members && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.edges.members.length}
                      </span>
                    )}
                    {project.end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(project.end_date)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showTemplates && <TemplateGallery orgSlug={orgSlug} canDelete={can(PERMS.templatesDelete)} onClose={() => setShowTemplates(false)} />}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createProject.isPending}
        />
      )}
    </div>
  );
}
