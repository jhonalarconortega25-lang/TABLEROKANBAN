import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import type { ReactNode } from 'react';

export const AXIS = { stroke: '#94a3b8', fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = { stroke: '#eef2f7', vertical: false } as const;

export function ChartTooltip({ active, payload, label, unit = '' }: TooltipProps<number, string> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-slate-700">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey) + p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: (p.payload?.fill as string) || p.color }} />
          {p.name}: <span className="font-semibold text-slate-900">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

export interface DonutDatum { name: string; value: number; color: string }

/** Donut con leyenda (identidad nunca solo por color: etiqueta + valor). */
export function Donut({ data, center, sub, height = 180 }: { data: DonutDatum[]; center?: ReactNode; sub?: string; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: 'Sin datos', value: 1, color: '#e2e8f0' }]} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={total ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive animationDuration={500}>
              {(total ? data : [{ color: '#e2e8f0' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={<ChartTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900">{center ?? total}</span>
          {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-600">{d.name}</span>
            <span className="ml-auto font-medium text-slate-900">{d.value}</span>
            <span className="w-10 text-right text-xs text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}
