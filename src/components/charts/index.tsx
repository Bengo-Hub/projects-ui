'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy chart entry: recharts is code-split and only loaded on pages that render a chart.
 */
const ChartFallback = () => <div className="h-full w-full animate-pulse rounded-md bg-muted" />;

export type { SCurvePoint, CategoryPoint } from './financial-charts';

export const SCurveChart = dynamic(() => import('./financial-charts').then((m) => m.SCurveChart), {
  ssr: false,
  loading: ChartFallback,
});
export const CostBarChart = dynamic(() => import('./financial-charts').then((m) => m.CostBarChart), {
  ssr: false,
  loading: ChartFallback,
});
