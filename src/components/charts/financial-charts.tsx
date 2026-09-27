'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface SCurvePoint {
  month: string;
  planned: number;
  actual: number;
}

const compact = (v: number) =>
  new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Cumulative planned spend against cumulative actual spend by month (the project S-curve). */
export function SCurveChart({ data }: { data: SCurvePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} width={48} />
        <Tooltip formatter={(v) => compact(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="planned" name="Planned (cumulative)" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} />
        <Line type="monotone" dataKey="actual" name="Actual (cumulative)" stroke="#2563eb" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="actual" name=" " stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} legendType="none" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface CategoryPoint {
  label: string;
  amount: number;
}

/** Cost by chart account, largest first. */
export function CostBarChart({ data }: { data: CategoryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={compact} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(v) => compact(Number(v))} />
        <Bar dataKey="amount" name="Cost" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
