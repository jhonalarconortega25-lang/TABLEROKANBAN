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

function Kpi({ label, value, icon, tone, to }: { label: string; value: number; icon: ReactNode; tone: string; to: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cx('rounded-lg p-1.5', tone)}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
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
      {/* Encabezado del proyecto */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-600">Resumen del proyecto</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{project.name}</h1>
            {project.description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{project.description}</p>}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-slate-500">Inicio <span className="ml-1 font-medium text-slate-800">{fmtDate(project.startDate)}</span></span>
              <span className="text-slate-500">Fin estimado <span className="ml-1 font-medium text-slate-800">{fmtDate(project.endDate)}</span></span>
              <span className="text-slate-500">{daysLeft >= 0 ? <>Quedan <span className="font-medium text-slate-800">{daysLeft} días</span></> : <span className="font-medium text-red-600">Plazo vencido hace {-daysLeft} días</span>}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Avance general</p>
                <p className="text-4xl font-semibold tracking-tight text-slate-900">{progress}<span className="text-xl text-slate-400">%</span></p>
              </div>
              <p className="text-right text-xs text-slate-500">{counts.done} de {counts.total}<br />actividades completadas</p>
            </div>
            <ProgressBar value={progress} height={10} className="mt-3" />
            <div className="relative mt-1 h-3">
              <span className="absolute -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${Math.min(100, Math.max(0, expected))}%` }}>▲</span>
            </div>
            <p className={cx('text-xs', gap >= 0 ? 'text-emerald-700' : 'text-amber-700')}>
              Esperado según el tiempo transcurrido: {expected}% · {gap >= 0 ? `adelantado ${gap} pts` : `retraso de ${-gap} pts`}
            </p>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total actividades" value={counts.total} icon={<ListChecks size={16} />} tone="bg-slate-100 text-slate-600" to="/actividades" />
        <Kpi label="Completadas" value={counts.done} icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" to="/actividades?status=done" />
        <Kpi label="En progreso" value={counts.in_progress} icon={<Clock3 size={16} />} tone="bg-blue-50 text-blue-600" to="/actividades?status=in_progress" />
        <Kpi label="En revisión" value={counts.review} icon={<Eye size={16} />} tone="bg-amber-50 text-amber-600" to="/actividades?status=review" />
        <Kpi label="Pendientes" value={counts.pending} icon={<CircleDashed size={16} />} tone="bg-slate-100 text-slate-600" to="/actividades?status=pending" />
        <Kpi label="Atrasadas" value={counts.overdue} icon={<AlertTriangle size={16} />} tone={counts.overdue ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'} to="/actividades?due=overdue" />
      </div>

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
                <BarChart data={sprints.map((s) => ({ name: `S${s.sprint.number}`, full: s.sprint.name, Avance: s.progress, fill: s.sprint.status === 'active' ? '#2563eb' : s.progress === 100 ? '#1baf7a' : '#93c5fd' }))} barCategoryGap="28%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis domain={[0, 100]} {...AXIS} width={34} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip unit="%" />} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.full ?? ''}`} />
                  <Bar dataKey="Avance" radius={[4, 4, 0, 0]} maxBarSize={48}>{sprints.map((s) => <Cell key={s.sprint.id} fill={s.sprint.status === 'active' ? '#2563eb' : s.progress === 100 ? '#1baf7a' : '#93c5fd'} />)}</Bar>
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
                    <div key={s} className="rounded-lg bg-slate-50 py-2">
                      <p className="text-lg font-semibold text-slate-900">{active.counts[s]}</p>
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
                <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-slate-200 py-1">
                  <span className="text-[10px] uppercase text-slate-500">{fmtDate(m.date, 'MMM')}</span>
                  <span className="text-base font-semibold leading-none text-slate-900">{fmtDate(m.date, 'd')}</span>
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
                    <Flag size={13} className="text-violet-600" /><span className="flex-1 truncate text-slate-700">{ms.title}</span><span className="text-slate-500">{relativeDays(ms.date, today)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader title={<span className="flex items-center gap-1.5 text-red-700"><AlertTriangle size={15} /> Actividades atrasadas ({overdue.length})</span>} subtitle="Superaron su fecha límite y no están completadas" />
          <div className="grid gap-x-4 px-3 pb-3 md:grid-cols-2">{overdue.map((t) => <TaskLine key={t.id} task={t} />)}</div>
        </Card>
      )}
    </div>
  );
}
