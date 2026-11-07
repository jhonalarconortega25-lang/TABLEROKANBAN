import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronRight, Pencil, Plus, Rocket, Trash2, Play, CheckCheck, Target, Inbox } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useData, useMemberMap, useToday } from '../hooks/useData';
import { sprintStats } from '../lib/metrics';
import { SPRINT_STATUSES, SPRINT_STATUS_META, STATUSES, STATUS_META } from '../lib/constants';
import { daysBetween, fmtShort, shiftISO, todayISO } from '../lib/dates';
import { hasErrors, validateSprint, type Errors } from '../lib/validation';
import type { Sprint, Task } from '../types';
import { Avatar, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, ProgressBar, Select, SprintStatusBadge, Textarea, cx } from '../components/ui';
import { AXIS, ChartTooltip, GRID, Legend } from '../components/charts';
import { TaskLine } from '../components/TaskLine';

export default function Sprints() {
  const data = useData();
  const today = useToday();
  const members = useMemberMap();
  const stats = useMemo(() => sprintStats(data, today), [data, today]);
  const backlog = data.tasks.filter((t) => !t.sprintId);
  const [editing, setEditing] = useState<Sprint | 'new' | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(stats.filter((s) => s.sprint.status === 'active').map((s) => s.sprint.id)));
  const loc = useLocation();

  useEffect(() => {
    const id = loc.hash.slice(1);
    if (!id) return;
    setExpanded((e) => new Set(e).add(id));
    setTimeout(() => document.getElementById(`sprint-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [loc.hash]);

  const toggle = (id: string) => setExpanded((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const store = usePlanner.getState();
  const { confirm, toast } = useUI.getState();

  const remove = async (s: Sprint, count: number) => {
    if (await confirm({ title: `Eliminar Sprint ${s.number}`, message: count ? `Sus ${count} actividades pasarán al Backlog (no se eliminan).` : '¿Eliminar este sprint?', confirmLabel: 'Eliminar sprint', danger: true })) {
      store.deleteSprint(s.id);
      toast('Sprint eliminado');
    }
  };

  const setStatus = (s: Sprint, status: Sprint['status']) => {
    if (status === 'active') data.sprints.filter((x) => x.status === 'active' && x.id !== s.id).forEach((x) => store.updateSprint(x.id, { status: 'finished' }));
    store.updateSprint(s.id, { status });
    toast(`Sprint ${s.number}: ${SPRINT_STATUS_META[status].label}`);
  };

  const chart = stats.map((s) => ({ name: `S${s.sprint.number}`, full: s.sprint.name, ...Object.fromEntries(STATUSES.map((st) => [STATUS_META[st].label, s.counts[st]])), progress: s.progress }));

  return (
    <div className="space-y-5">
      <PageHeader title="Sprints" subtitle="Organiza el trabajo en iteraciones (Scrum) y compara su avance." actions={<Button variant="primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo sprint</Button>} />

      {stats.length > 0 && (
        <Card>
          <CardHeader title="Comparativa de sprints" subtitle="Actividades por estado en cada sprint · el % indica el avance" action={<Legend items={STATUSES.map((s) => ({ label: STATUS_META[s].label, color: STATUS_META[s].chart }))} />} />
          <div className="grid gap-4 px-3 pb-4 lg:grid-cols-[1fr_280px]">
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={chart} barCategoryGap="30%">
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} width={28} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip />} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.full ?? ''} (${p?.[0]?.payload?.progress ?? 0}%)`} />
                  {STATUSES.map((s, i) => <Bar key={s} dataKey={STATUS_META[s].label} stackId="a" fill={STATUS_META[s].chart} stroke="#fff" strokeWidth={1} radius={i === STATUSES.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={44} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5 self-center px-2">
              {stats.map((s) => (
                <li key={s.sprint.id}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">Sprint {s.sprint.number}</span><span className="font-semibold text-slate-900">{s.progress}%</span></div>
                  <ProgressBar value={s.progress} />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {stats.length === 0 && <Card><EmptyState icon={<Rocket size={20} />} title="No hay sprints" text="Crea el primer sprint para planificar el trabajo por iteraciones." action={<Button variant="primary" onClick={() => setEditing('new')}><Plus size={15} /> Nuevo sprint</Button>} /></Card>}

      <div className="space-y-3">
        {stats.map(({ sprint: s, tasks, counts, progress }) => {
          const open = expanded.has(s.id);
          const left = daysBetween(today, s.endDate);
          const owner = members.get(s.ownerId ?? '');
          return (
            <Card key={s.id} id={`sprint-${s.id}`} className={cx('scroll-mt-20', s.status === 'active' && 'ring-1 ring-brand-200')}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <button type="button" onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="mt-0.5 text-slate-400">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-brand-700">SPRINT {s.number}</span>
                      <SprintStatusBadge status={s.status} />
                      {progress === 100 && tasks.length > 0 && s.status !== 'finished' && <span className="text-[11px] font-medium text-emerald-700">✓ Todas las actividades completadas</span>}
                    </div>
                    <p className="mt-0.5 font-medium text-slate-900">{s.name}</p>
                    {s.goal && <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500"><Target size={12} className="mt-0.5 shrink-0" />{s.goal}</p>}
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-8 sm:pl-0">
                  <div className="text-xs text-slate-500">
                    <p>{fmtShort(s.startDate)} – {fmtShort(s.endDate)}</p>
                    <p className={cx(s.status === 'active' && left < 0 && 'text-amber-700')}>{s.status === 'finished' ? 'Cerrado' : left >= 0 ? `${left} días restantes` : `Venció hace ${-left} días`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600" title="Responsable del sprint"><Avatar member={owner} size={22} />{owner?.name ?? '—'}</div>
                  <div className="w-36">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">{counts.done}/{counts.total}</span><span className="font-semibold text-slate-900">{progress}%</span></div>
                    <ProgressBar value={progress} />
                  </div>
                  <div className="flex items-center gap-0.5">
                    {s.status === 'planned' && <IconButton label="Activar sprint" onClick={() => setStatus(s, 'active')}><Play size={15} /></IconButton>}
                    {s.status === 'active' && <IconButton label="Finalizar sprint" onClick={() => setStatus(s, 'finished')}><CheckCheck size={15} /></IconButton>}
                    <IconButton label="Editar" onClick={() => setEditing(s)}><Pencil size={15} /></IconButton>
                    <IconButton label="Eliminar" onClick={() => remove(s, tasks.length)} className="hover:!text-red-600"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              </div>
              {open && <SprintTasks sprint={s} tasks={tasks} />}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title={<span className="flex items-center gap-1.5"><Inbox size={15} /> Backlog ({backlog.length})</span>} subtitle="Actividades sin sprint asignado" />
        <div className="px-3 pb-3">{backlog.length === 0 ? <p className="px-2 pb-3 text-xs text-slate-400">El backlog está vacío.</p> : <SprintTasks sprint={null} tasks={backlog} bare />}</div>
      </Card>

      <SprintModal value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SprintTasks({ sprint, tasks, bare }: { sprint: Sprint | null; tasks: Task[]; bare?: boolean }) {
  const sprints = usePlanner((s) => s.sprints);
  const [selected, setSelected] = useState<string[]>([]);
  const others = [...sprints].filter((s) => s.id !== sprint?.id).sort((a, b) => a.number - b.number);
  const move = (ids: string[], to: string) => {
    usePlanner.getState().moveTasksToSprint(ids, to || null);
    setSelected([]);
    useUI.getState().toast(`${ids.length} actividad(es) trasladada(s)`);
  };
  return (
    <div className={cx(!bare && 'border-t border-slate-100 px-3 py-2')}>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          {selected.length} seleccionada(s) · Mover a
          <Select className="!h-7 !w-auto text-xs" value="-" onChange={(e) => move(selected, e.target.value === 'backlog' ? '' : e.target.value)}>
            <option value="-" disabled>Elegir…</option>
            {sprint && <option value="backlog">Backlog</option>}
            {others.map((s) => <option key={s.id} value={s.id}>Sprint {s.number}</option>)}
          </Select>
          <button type="button" onClick={() => setSelected([])} className="ml-auto hover:underline">Cancelar</button>
        </div>
      )}
      {tasks.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Sin actividades. Asígnalas desde el backlog o crea una nueva.</p>}
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-1">
          <input type="checkbox" aria-label="Seleccionar" checked={selected.includes(t.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))} className="ml-2 h-3.5 w-3.5 accent-blue-600" />
          <div className="min-w-0 flex-1"><TaskLine task={t} /></div>
          <span className={cx('hidden w-24 text-right text-[11px] sm:block', t.status === 'done' ? 'text-emerald-700' : 'text-slate-500')}>{STATUS_META[t.status].label}</span>
          <Select aria-label="Mover a sprint" className="!h-7 !w-28 text-xs" value={t.sprintId ?? ''} onChange={(e) => move([t.id], e.target.value)}>
            <option value="">Backlog</option>
            {[...sprints].sort((a, b) => a.number - b.number).map((s) => <option key={s.id} value={s.id}>Sprint {s.number}</option>)}
          </Select>
        </div>
      ))}
      {sprint && (
        <div className="mt-1 flex gap-3 px-2 pb-1">
          <button type="button" onClick={() => useUI.getState().openNewTask({ sprintId: sprint.id })} className="text-xs font-medium text-brand-700 hover:underline">+ Añadir actividad</button>
          <Link to={`/kanban?sprint=${sprint.id}`} className="text-xs font-medium text-slate-500 hover:underline">Ver en Kanban</Link>
        </div>
      )}
    </div>
  );
}

type SprintForm = Omit<Sprint, 'id' | 'createdAt'>;

function SprintModal({ value, onClose }: { value: Sprint | 'new' | null; onClose: () => void }) {
  const sprints = usePlanner((s) => s.sprints);
  const members = usePlanner((s) => s.members);
  const [form, setForm] = useState<SprintForm | null>(null);
  const [errors, setErrors] = useState<Errors<Sprint>>({});

  useEffect(() => {
    setErrors({});
    if (!value) return setForm(null);
    if (value === 'new') {
      const last = [...sprints].sort((a, b) => b.number - a.number)[0];
      const start = last ? shiftISO(last.endDate, 1) : todayISO();
      setForm({ number: (last?.number ?? 0) + 1, name: '', goal: '', startDate: start, endDate: shiftISO(start, 13), ownerId: members[0]?.id ?? null, status: 'planned' });
    } else {
      const { id: _i, createdAt: _c, ...rest } = value;
      setForm(rest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!value || !form) return null;
  const set = (p: Partial<SprintForm>) => setForm((f) => f && { ...f, ...p });
  const save = () => {
    const e = validateSprint({ ...form, id: value === 'new' ? undefined : value.id }, sprints);
    setErrors(e);
    if (hasErrors(e)) return;
    const store = usePlanner.getState();
    if (form.status === 'active') sprints.filter((x) => x.status === 'active' && (value === 'new' || x.id !== value.id)).forEach((x) => store.updateSprint(x.id, { status: 'finished' }));
    if (value === 'new') store.addSprint({ ...form, name: form.name.trim() });
    else store.updateSprint(value.id, { ...form, name: form.name.trim() });
    useUI.getState().toast(value === 'new' ? 'Sprint creado' : 'Sprint actualizado');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={value === 'new' ? 'Nuevo sprint' : `Editar Sprint ${value.number}`} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}>
      <form className="grid grid-cols-1 gap-3.5 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Número *" error={errors.number}><Input type="number" min={1} value={form.number} onChange={(e) => set({ number: Number(e.target.value) })} invalid={!!errors.number} /></Field>
        <Field label="Nombre *" error={errors.name} className="sm:col-span-3"><Input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} invalid={!!errors.name} placeholder="Ej. Recolección de datos" /></Field>
        <Field label="Objetivo" className="sm:col-span-4"><Textarea rows={2} value={form.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="¿Qué debe lograr el equipo en este sprint?" /></Field>
        <Field label="Inicio *" error={errors.startDate} className="sm:col-span-2"><Input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
        <Field label="Fin *" error={errors.endDate} className="sm:col-span-2"><Input type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} invalid={!!errors.endDate} /></Field>
        <Field label="Responsable del sprint" className="sm:col-span-2">
          <Select value={form.ownerId ?? ''} onChange={(e) => set({ ownerId: e.target.value || null })}>
            <option value="">Sin responsable</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Estado" className="sm:col-span-2" hint={form.status === 'active' ? 'Solo puede haber un sprint activo; el anterior se finalizará.' : undefined}>
          <Select value={form.status} onChange={(e) => set({ status: e.target.value as Sprint['status'] })}>
            {SPRINT_STATUSES.map((s) => <option key={s} value={s}>{SPRINT_STATUS_META[s].label}</option>)}
          </Select>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
