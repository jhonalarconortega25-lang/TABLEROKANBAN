import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed, Clock3, ListChecks, Eye, ArrowRight, Flag, Rocket } from 'lucide-react';
import { useData, useMemberMap, useToday } from '../hooks/useData';
import { useUI } from '../store/useUI';
import { countTasks, expectedProgress, overdueTasks, progressOf, sprintStats, statusDistribution, upcomingDeadlines, upcomingMeetings } from '../lib/metrics';
import { STATUS_META } from '../lib/constants';
import { daysBetween, fmtDate, fmtShort, relativeDays } from '../lib/dates';
import { AvatarStack, Card, CardHeader, EmptyState, ProgressBar, SprintStatusBadge, cx } from '../components/ui';
import { AXIS, ChartTooltip, Donut, GRID } from '../components/charts';
import { TaskLine } from '../components/TaskLine';

type Tone = 'green' | 'gold' | 'bark' | 'stone' | 'red' | 'dark';
const TONES: Record<Tone, { head: string; border: string }> = {
  dark: { head: 'bg-brand-700 text-white', border: 'border-brand-700' },
  green: { head: 'bg-brand-600 text-white', border: 'border-brand-600' },
  gold: { head: 'bg-gold-500 text-brand-900', border: 'border-gold-500' },
  bark: { head: 'bg-bark-500 text-white', border: 'border-bark-500' },
  stone: { head: 'bg-stone-400 text-white', border: 'border-stone-400' },
  red: { head: 'bg-red-600 text-white', border: 'border-red-600' },
};

/** Caja tipo póster: cabecera de color con el nombre y cuerpo blanco con la cifra. */
function Kpi({ label, value, icon, tone, to }: { label: string; value: number; icon: ReactNode; tone: Tone; to: string }) {
  return (
    <Link to={to} className={cx('group overflow-hidden rounded-xl border-2 bg-white transition-transform hover:-translate-y-0.5', TONES[tone].border)}>
      <span className={cx('flex items-center justify-between gap-2 px-3 py-1.5 font-display text-[11px] font-extrabold uppercase tracking-wide', TONES[tone].head)}>
        {label}
        {icon}
      </span>
      <p className="px-3 py-2.5 font-display text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
    </Link>
  );
}

export default function Dashboard() {
  const data = useData();
  const today = useToday();
  const members = useMemberMap();
  const { project, tasks, meetings, milestones } = data;

  const counts = useMemo(() => countTasks(tasks, today), [tasks, today]);
  const progress = progressOf(tasks, project.weightingMode);
  const expected = expectedProgress(project.startDate, project.endDate, today);
  const daysLeft = daysBetween(today, project.endDate);
  const sprints = useMemo(() => sprintStats(data, today), [data, today]);
  const active = sprints.find((s) => s.sprint.status === 'active');
  const deadlines = useMemo(() => upcomingDeadlines(tasks, 14, today).slice(0, 6), [tasks, today]);
  const overdue = useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const nextMeetings = useMemo(() => upcomingMeetings(meetings, today, 4), [meetings, today]);
  const nextMilestones = milestones.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 3);
  const donut = statusDistribution(tasks).map((d) => ({ name: STATUS_META[d.key].label, value: d.value, color: STATUS_META[d.key].chart }));
  const gap = progress - expected;

  return (
    <div className="space-y-5">
      {/* Encabezado del proyecto: banda verde como el título del póster */}
      <section className="overflow-hidden rounded-2xl bg-brand-600 text-white shadow-[0_10px_30px_-12px_rgba(35,73,20,.55)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_340px] lg:items-center">
          <div className="text-center lg:text-left">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">Resumen del proyecto</p>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-[34px]">{project.name}</h1>
            {project.description && <p className="mx-auto mt-2 max-w-2xl text-sm text-brand-50/90 lg:mx-0">{project.description}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs lg:justify-start">
              <span className="rounded-full bg-white/15 px-3 py-1">Inicio <b className="ml-1">{fmtDate(project.startDate)}</b></span>
              <span className="rounded-full bg-white/15 px-3 py-1">Fin estimado <b className="ml-1">{fmtDate(project.endDate)}</b></span>
              <span className={cx('rounded-full px-3 py-1 font-bold', daysLeft >= 0 ? 'bg-gold-500 text-brand-900' : 'bg-red-600 text-white')}>{daysLeft >= 0 ? `Quedan ${daysLeft} días` : `Plazo vencido hace ${-daysLeft} días`}</span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-brand-300 bg-white p-4 text-slate-800">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-[11px] font-extrabold uppercase tracking-wide text-brand-700">Avance general</p>
                <p className="font-display text-5xl font-extrabold tracking-tight text-brand-700">{progress}<span className="text-2xl text-gold-500">%</span></p>
              </div>
              <p className="text-right text-xs text-slate-500">{counts.done} de {counts.total}<br />actividades completadas</p>
            </div>
            <ProgressBar value={progress} height={12} className="mt-3" />
            <div className="relative mt-1 h-3">
              <span className="absolute -translate-x-1/2 text-[10px] text-gold-600" style={{ left: `${Math.min(100, Math.max(0, expected))}%` }}>▲</span>
            </div>
            <p className={cx('text-xs font-medium', gap >= 0 ? 'text-brand-700' : 'text-bark-600')}>
              Esperado según el tiempo transcurrido: {expected}% · {gap >= 0 ? `adelantado ${gap} pts` : `retraso de ${-gap} pts`}
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total actividades" value={counts.total} icon={<ListChecks size={14} />} tone="dark" to="/actividades" />
        <Kpi label="Completadas" value={counts.done} icon={<CheckCircle2 size={14} />} tone="green" to="/actividades?status=done" />
        <Kpi label="En progreso" value={counts.in_progress} icon={<Clock3 size={14} />} tone="gold" to="/actividades?status=in_progress" />
        <Kpi label="En revisión" value={counts.review} icon={<Eye size={14} />} tone="bark" to="/actividades?status=review" />
        <Kpi label="Pendientes" value={counts.pending} icon={<CircleDashed size={14} />} tone="stone" to="/actividades?status=pending" />
        <Kpi label="Atrasadas" value={counts.overdue} icon={<AlertTriangle size={14} />} tone={counts.overdue ? 'red' : 'stone'} to="/actividades?due=overdue" />
      </div>

      {/* Ruta del proyecto: sprints como flechas (Inicio → … → Entrega) */}
      {sprints.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-display text-[13px] font-extrabold uppercase tracking-wide text-brand-700">Ruta del proyecto</h3>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <ol className="flex min-w-max gap-1">
              {sprints.map((s, i) => {
                const style = s.sprint.status === 'finished' ? 'bg-brand-700 text-white' : s.sprint.status === 'active' ? 'bg-gold-500 text-brand-900' : 'bg-brand-100 text-brand-800';
                return (
                  <li key={s.sprint.id} className="w-44 sm:w-52 lg:min-w-0 lg:flex-1">
                    <Link to={`/sprints#${s.sprint.id}`} className={cx('block h-full py-2.5 pl-5 pr-7 transition-opacity hover:opacity-90', i === 0 ? 'chevron-first pl-3' : 'chevron', style)}>
                      <span className="block font-display text-[11px] font-extrabold uppercase tracking-wide">Sprint {s.sprint.number} · {s.progress}%</span>
                      <span className="mt-0.5 block truncate text-xs font-semibold opacity-90">{s.sprint.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-700" />Finalizado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold-500" />Activo</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-100 ring-1 ring-brand-200" />Planificado</span>
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Actividades por estado" subtitle="Distribución actual" />
          <div className="px-5 pb-5"><Donut data={donut} center={`${progress}%`} sub="completado" height={150} /></div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Avance por sprint" subtitle="% de actividades completadas en cada sprint" action={<Link to="/sprints" className="text-xs font-medium text-brand-700 hover:underline">Ver sprints</Link>} />
          <div className="h-[210px] px-2 pb-3">
            {sprints.length === 0 ? <EmptyState icon={<Rocket size={18} />} title="Sin sprints" text="Crea sprints para ver su avance." /> : (
              <ResponsiveContainer>
                <BarChart data={sprints.map((s) => ({ name: `S${s.sprint.number}`, full: s.sprint.name, Avance: s.progress, fill: s.sprint.status === 'active' ? '#dfa020' : s.progress === 100 ? '#2f5f18' : '#6f9f45' }))} barCategoryGap="28%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis domain={[0, 100]} {...AXIS} width={34} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: '#f1f6ec' }} content={<ChartTooltip unit="%" />} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.full ?? ''}`} />
                  <Bar dataKey="Avance" radius={[4, 4, 0, 0]} maxBarSize={48}>{sprints.map((s) => <Cell key={s.sprint.id} fill={s.sprint.status === 'active' ? '#dfa020' : s.progress === 100 ? '#2f5f18' : '#6f9f45'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Sprint activo */}
        <Card>
          <CardHeader title="Sprint activo" />
          <div className="px-5 pb-5">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">Sprint {active.sprint.number} · {active.sprint.name}</p>
                  <SprintStatusBadge status={active.sprint.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{active.sprint.goal}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{fmtShort(active.sprint.startDate)} – {fmtShort(active.sprint.endDate)}</span>
                  <span>{daysBetween(today, active.sprint.endDate) >= 0 ? `Termina ${relativeDays(active.sprint.endDate, today)}` : 'Fecha de fin superada'}</span>
                </div>
                <ProgressBar value={active.progress} height={8} className="mt-2" />
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {(['pending', 'in_progress', 'review', 'done'] as const).map((s) => (
                    <div key={s} className="rounded-lg border-2 border-brand-100 py-2">
                      <p className="font-display text-lg font-extrabold text-brand-700">{active.counts[s]}</p>
                      <p className="text-[10px] leading-tight text-slate-500">{STATUS_META[s].label}</p>
                    </div>
                  ))}
                </div>
                <Link to={`/kanban?sprint=${active.sprint.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">Abrir en Kanban <ArrowRight size={12} /></Link>
              </>
            ) : <EmptyState icon={<Rocket size={18} />} title="No hay sprint activo" text="Activa un sprint desde la sección Sprints." />}
          </div>
        </Card>

        {/* Próximas entregas */}
        <Card>
          <CardHeader title="Próximas fechas de entrega" subtitle="Siguientes 14 días" />
          <div className="px-3 pb-4">
            {deadlines.length === 0 ? <p className="px-2 py-6 text-center text-xs text-slate-400">No hay entregas próximas.</p> : deadlines.map((t) => <TaskLine key={t.id} task={t} />)}
          </div>
        </Card>

        {/* Reuniones e hitos */}
        <Card>
          <CardHeader title="Próximas reuniones" action={<button type="button" onClick={() => useUI.getState().openMeeting(null)} className="text-xs font-medium text-brand-700 hover:underline">+ Programar</button>} />
          <div className="space-y-1 px-3 pb-3">
            {nextMeetings.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No hay reuniones programadas.</p>}
            {nextMeetings.map((m) => (
              <button key={m.id} type="button" onClick={() => useUI.getState().openMeeting(m.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50">
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-brand-600 py-1 text-white">
                  <span className="text-[10px] font-bold uppercase text-gold-300">{fmtDate(m.date, 'MMM')}</span>
                  <span className="font-display text-base font-extrabold leading-none">{fmtDate(m.date, 'd')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                  <p className="text-xs text-slate-500"><CalendarClock size={11} className="mr-1 inline" />{relativeDays(m.date, today)} · {m.time}</p>
                </div>
                <AvatarStack members={m.participantIds.map((id) => members.get(id)!).filter(Boolean)} size={20} max={3} />
              </button>
            ))}
            {nextMilestones.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                {nextMilestones.map((ms) => (
                  <div key={ms.id} className="flex items-center gap-2 px-2 py-1 text-xs">
                    <Flag size={13} className="text-bark-600" /><span className="flex-1 truncate text-slate-700">{ms.title}</span><span className="text-slate-500">{relativeDays(ms.date, today)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="!border-red-300">
          <CardHeader title={<span className="flex items-center gap-1.5 text-red-700"><AlertTriangle size={15} /> Actividades atrasadas ({overdue.length})</span>} subtitle="Superaron su fecha límite y no están completadas" />
          <div className="grid gap-x-4 px-3 pb-3 md:grid-cols-2">{overdue.map((t) => <TaskLine key={t.id} task={t} />)}</div>
        </Card>
      )}
    </div>
  );
}
