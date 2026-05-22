'use client';

import { useParams } from 'next/navigation';
import { useGanttData } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart2 } from 'lucide-react';

export default function GanttPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';

  const { data: tasks, isLoading, isError } = useGanttData(orgSlug, projectId);

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load Gantt data." />;
  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="No tasks with schedule data"
        description="Add tasks with dates to see the project timeline."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Gantt / Timeline</h2>
        <p className="text-sm text-muted-foreground">Task schedule and dependencies</p>
      </div>

      <Card>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Task</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Start</th>
                <th className="py-3 text-left font-medium text-muted-foreground">End / Due</th>
                <th className="py-3 text-left font-medium text-muted-foreground">WBS</th>
                <th className="py-3 text-left font-medium text-muted-foreground">Depends On</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr key={task.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                  <td className="py-3 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="py-3 font-medium">{task.title}</td>
                  <td className="py-3"><Badge status={task.status} /></td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 text-muted-foreground text-xs">
                    {(task.end_date ?? task.due_date)
                      ? new Date((task.end_date ?? task.due_date)!).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">{task.wbs_code ?? '—'}</td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {task.dependencies.length > 0 ? task.dependencies.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
