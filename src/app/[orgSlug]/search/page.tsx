'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, FolderKanban, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { AIErrorBlock, AIWorking, DraftNotice } from '@/components/ai/ai-parts';
import { aiError, useAISearch } from '@/hooks/useAI';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { newRequestKey } from '@/lib/ai/drafts';

/**
 * Smart search (sprint 10): a plain-language question ranked by the assistant over the projects
 * the person can see and, with tender access, the organisation's tenders. Every result links to a
 * record the person may already open.
 */
export default function SmartSearchPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { can } = useServicePermissions();
  const [query, setQuery] = useState('');
  const search = useAISearch(orgSlug);
  const err = aiError(search.error);
  const tooShort = query.trim().length < 3;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tooShort) return;
    search.mutate({ query: query.trim(), key: newRequestKey() });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Smart search" subtitle="Ask in your own words; the assistant ranks your projects and tenders" className="mb-0" />
      {!can(PERMS.aiAdd) ? (
        <p className="text-sm text-muted-foreground">Your role does not include the AI assistant. Ask a projects administrator.</p>
      ) : (
        <>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" role="search">
            <input
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:min-h-9 sm:text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={300}
              placeholder="For example: road design jobs for county governments"
              aria-label="Question"
            />
            <Button type="submit" className="h-11 sm:h-9" disabled={tooShort || search.isPending}>
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
          </form>
          {search.isPending && <AIWorking text="Searching..." />}
          {err && !search.isPending && <AIErrorBlock info={err} onRetry={() => search.variables && search.mutate(search.variables)} />}
          {search.data && !search.isPending && (
            <section className="space-y-3" aria-label="Results">
              {search.data.results.length === 0 ? (
                <EmptyState icon={Search} title="Nothing matched" description="Try other words, or check the project lists." />
              ) : (
                <ol className="space-y-2">
                  {search.data.results.map((r) => {
                    const Icon = r.kind === 'tender' ? FileText : FolderKanban;
                    const href = r.kind === 'tender' ? `/${orgSlug}/tenders/${r.id}` : `/${orgSlug}/projects/${r.id}`;
                    return (
                      <li key={`${r.kind}-${r.id}`} data-testid="search-result">
                        <Link href={href} className="flex min-h-11 gap-3 rounded-md border border-border p-3 hover:bg-accent">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{r.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {r.kind === 'tender' ? 'Tender' : 'Project'} · {r.status}
                            </span>
                            {r.reason && <span className="mt-1 block text-sm text-muted-foreground">{r.reason}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {search.data.credits && <DraftNotice credits={search.data.credits} review={search.data} />}
            </section>
          )}
        </>
      )}
    </div>
  );
}
