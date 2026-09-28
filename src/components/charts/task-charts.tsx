'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TaskTrendMonth } from '@/types';

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });

/** Tasks created and completed per month, with the overdue backlog at each month end. */
export function TaskTrendChart({ data }: { data: TaskTrendMonth[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
        <Tooltip labelFormatter={(m) => monthLabel(String(m))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="created" name="Created" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="overdue_at_month_end" name="Overdue at month end" stroke="#dc2626" strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
