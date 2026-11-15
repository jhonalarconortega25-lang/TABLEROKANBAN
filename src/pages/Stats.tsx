import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData, useToday } from '../hooks/useData';
import { completedPerWeek, countTasks, expectedProgress, memberStats, priorityDistribution, progressOf, sprintBurndown, sprintStats, statusDistribution } from '../lib/metrics';
import { PRIORITY_META, STATUS_META, colorFor } from '../lib/constants';
import { Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, Select, cx } from '../components/ui';
import { AXIS, ChartTooltip, Donut, GRID, Legend } from '../components/charts';
import { TaskLine } from '../components/TaskLine';
import { overdueTasks } from '../lib/metrics';
import { TUCKMAN_STAGES, tuckmanStage } from '../lib/tuckman';
import { Lightbulb, AlertTriangle } from 'lucide-react';

export default function Stats() {
  const data = useData();
  const today = useToday();
  const { tasks, project } = data;
  const [weeks, setWeeks] = useState<'8' | '12'>('8');
  const counts = useMemo(() => countTasks(tasks, today), [tasks, today]);
  const progress = progressOf(tasks, project.weightingMode);
  const expected = expectedProgress(project.startDate, project.endDate, today);
  const sprints = useMemo(() => sprintStats(data, today), [data, today]);
  const people = useMemo(() => memberStats(data, today), [data, today]);
  const weekly = useMemo(() => completedPerWeek(tasks, Number(weeks), today), [tasks, weeks, today]);
  const defaultSprint = sprints.find((s) => s.sprint.status === 'active') ?? sprints[sprints.length - 1];
  const [burnId, setBurnId] = useState<string>('');
  const burnSprint = sprints.find((s) => s.sprint.id === burnId) ?? defaultSprint;
  const burndown = useMemo(() => (burnSprint ? sprintBurndown(burnSprint.sprint, burnSprint.tasks, today) : []), [burnSprint, today]);
  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const tuck = useMemo(() => tuckmanStage(data, today), [data, today]);

  if (tasks.length === 0) return <div><PageHeader title="Estadísticas" /><Card><EmptyState title="Sin datos aún" text="Los indicadores se calcularán automáticamente cuando registres actividades." /></Card></div>;

  return (
    <div className="space-y-5">
      <PageHeader title="Estadísticas" subtitle="Indicadores calculados en tiempo real a partir de los datos del proyecto." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:col-span-2">
          <p className="text-xs font-medium text-slate-500">Avance general del proyecto</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-4xl font-extrabold text-brand-700">{progress}%</span>
            <span className={cx('text-xs font-medium', progress >= expected ? 'text-brand-700' : 'text-bark-600')}>{progress >= expected ? '▲' : '▼'} esperado {expected}%</span>
          </div>
          <ProgressBar value={progress} height={8} className="mt-3" />
          <p className="mt-2 text-[11px] text-slate-400">
            Fórmula: completadas / total × 100 = {counts.done} / {counts.total} × 100{project.weightingMode === 'weighted' && ' (ponderado por complejidad)'}
          </p>
        </Card>
        <Card className="p-4"><p className="text-xs font-medium text-slate-500">Pendientes (no completadas)</p><p className="mt-1 text-3xl font-semibold text-slate-900">{counts.total - counts.done}</p><p className="mt-1 text-xs text-slate-500">{counts.pending} sin iniciar · {counts.in_progress} en progreso · {counts.review} en revisión</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-slate-500">Atrasadas</p><p className={cx('mt-1 text-3xl font-semibold', counts.overdue ? 'text-red-600' : 'text-slate-900')}>{counts.overdue}</p><p className="mt-1 text-xs text-slate-500">{counts.total ? Math.round((counts.overdue / counts.total) * 100) : 0}% del total</p></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Distribución por estado" />
          <div className="px-5 pb-5"><Donut data={statusDistribution(tasks).map((d) => ({ name: STATUS_META[d.key].label, value: d.value, color: STATUS_META[d.key].chart }))} sub="actividades" /></div>
        </Card>
        <Card>
          <CardHeader title="Distribución por prioridad" />
          <div className="px-5 pb-5"><Donut data={priorityDistribution(tasks).map((d) => ({ name: `${PRIORITY_META[d.key].emoji} ${PRIORITY_META[d.key].label}`, value: d.value, color: PRIORITY_META[d.key].chart }))} sub="actividades" /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividades completadas por semana" subtitle="Barras: completadas en la semana · Línea: acumulado"
          action={<Segmented value={weeks} onChange={setWeeks} options={[{ value: '8', label: '8 sem' }, { value: '12', label: '12 sem' }]} />} />
        <div className="grid gap-2 px-2 pb-4 lg:grid-cols-2">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={weekly}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis allowDecimals={false} {...AXIS} width={28} />
                <Tooltip cursor={{ fill: '#f1f6ec' }} content={<ChartTooltip />} labelFormatter={(l) => `Semana del ${l}`} />
                <Bar dataKey="completed" name="Completadas" fill="#3f7a22" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <AreaChart data={weekly}>
                <defs><linearGradient id="cum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dfa020" stopOpacity={0.25} /><stop offset="100%" stopColor="#dfa020" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis allowDecimals={false} {...AXIS} width={28} domain={[0, counts.total]} />
                <Tooltip content={<ChartTooltip />} labelFormatter={(l) => `Semana del ${l}`} />
                <Area type="monotone" dataKey="cumulative" name="Acumulado" stroke="#dfa020" strokeWidth={2} fill="url(#cum)" dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Avance por responsable" subtitle="% de sus actividades completadas, con la lectura del equipo según el modelo de Tuckman" />
        <div className="grid grid-cols-1 gap-6 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="space-y-3">
            {people.map((p) => (
              <div key={p.member.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-700"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorFor(p.member.colorIndex) }} />{p.member.name}</span>
                  <span className="text-slate-500">{p.completed}/{p.assigned}{p.overdue > 0 && <span className="text-red-600"> · {p.overdue} atrasada{p.overdue > 1 ? 's' : ''}</span>} · <span className="font-semibold text-slate-900">{p.progress}%</span></span>
                </div>
                <ProgressBar value={p.progress} />
              </div>
            ))}
            {people.length === 0 && <p className="text-xs text-slate-400">Sin integrantes.</p>}
          </div>
          <TuckmanPanel result={tuck} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Avance por sprint" />
          <div className="h-[240px] px-2 pb-4">
            {sprints.length === 0 ? <EmptyState title="Sin sprints" /> : (
              <ResponsiveContainer>
                <BarChart data={sprints.map((s) => ({ name: `S${s.sprint.number}`, full: s.sprint.name, Avance: s.progress }))}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis domain={[0, 100]} {...AXIS} width={34} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: '#f1f6ec' }} content={<ChartTooltip unit="%" />} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.full ?? ''}`} />
                  <Bar dataKey="Avance" radius={[4, 4, 0, 0]} maxBarSize={44}>{sprints.map((s) => <Cell key={s.sprint.id} fill={s.progress === 100 ? '#2f5f18' : '#3f7a22'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        {burnSprint && (
        <Card>
          <CardHeader title="Burndown del sprint" subtitle="Actividades restantes frente a la línea ideal"
            action={<Select className="!h-8 !w-auto text-xs" value={burnSprint.sprint.id} onChange={(e) => setBurnId(e.target.value)}>{sprints.map((s) => <option key={s.sprint.id} value={s.sprint.id}>Sprint {s.sprint.number}</option>)}</Select>} />
          <div className="px-5"><Legend items={[{ label: 'Restantes', color: '#3f7a22' }, { label: 'Ideal', color: '#94a3b8', dashed: true }]} /></div>
          <div className="h-[240px] px-2 pb-4 pt-2">
            <ResponsiveContainer>
              <LineChart data={burndown}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} {...AXIS} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="linear" dataKey="ideal" name="Ideal" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                <Line type="stepAfter" dataKey="remaining" name="Restantes" stroke="#3f7a22" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        )}

      </div>

      <Card>
        <CardHeader title={`Actividades atrasadas (${overdue.length})`} />
        <div className="grid gap-x-4 px-3 pb-3 md:grid-cols-2">
          {overdue.length === 0 ? <p className="px-2 pb-2 text-xs text-slate-400">No hay actividades atrasadas. ¡Buen trabajo!</p> : overdue.map((t) => <TaskLine key={t.id} task={t} />)}
        </div>
      </Card>
    </div>
  );
}

function TuckmanPanel({ result }: { result: ReturnType<typeof tuckmanStage> }) {
  const idx = TUCKMAN_STAGES.findIndex((x) => x.key === result.stage);
  const st = TUCKMAN_STAGES[idx];
  return (
    <div className="min-w-0 rounded-2xl border-2 border-brand-600 bg-brand-50/40 p-4">
      <p className="font-display text-[11px] font-extrabold uppercase tracking-wide text-brand-700">Interpretación · Modelo de Tuckman</p>
      <div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-0.5 sm:min-w-0" aria-label="Etapas del modelo de Tuckman">
          {TUCKMAN_STAGES.map((x, i) => (
            <li key={x.key} aria-current={i === idx ? 'step' : undefined}
              className={cx('min-w-0 py-1.5 pl-4 pr-4 text-center sm:flex-1', i === 0 ? 'chevron-first pl-2' : 'chevron',
                i === idx ? 'bg-gold-500 text-brand-900' : i < idx ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-800')}>
              <span className="block whitespace-nowrap font-display text-[9.5px] font-extrabold uppercase">{x.name}</span>
              <span className="block whitespace-nowrap text-[9.5px] opacity-80">{x.en}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-sm text-slate-800">
        El equipo está en la etapa de <b className="font-display font-extrabold uppercase text-brand-700">{st.name}</b> <span className="text-slate-500">({st.en})</span>.
      </p>
      <p className="mt-1 text-sm text-slate-600">{st.summary}</p>
      <p className="mt-3 font-display text-[11px] font-extrabold uppercase tracking-wide text-brand-700">Por qué</p>
      <ul className="mt-1 space-y-1 text-xs text-slate-700">
        {result.reasons.map((r) => <li key={r} className="flex gap-1.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{r}</li>)}
      </ul>
      {result.behind.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Atención: {result.behind.map((b) => `${b.name} (${b.overdue} atrasada${b.overdue > 1 ? 's' : ''})`).join(', ')}.
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800 ring-1 ring-gold-200">
        <Lightbulb size={14} className="mt-0.5 shrink-0" /><span><b>Recomendación:</b> {st.tip}</span>
      </p>
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Lectura orientativa que se recalcula sola con los datos del planner: avance frente al tiempo, cumplimiento de plazos, reparto del trabajo y atrasos.
      </p>
    </div>
  );
}
