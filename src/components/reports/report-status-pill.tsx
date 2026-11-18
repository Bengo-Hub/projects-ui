import { cn } from '@/lib/utils';

const CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  published: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
};

/** Draft or published. */
export function ReportStatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', CLASS[status] ?? CLASS.draft, className)} data-testid="report-status">
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  );
}
