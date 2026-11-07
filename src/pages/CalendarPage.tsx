import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flag, CalendarClock, Rocket, CircleDot, Plus, PlayCircle, Trash2 } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useData, useMemberMap, useToday } from '../hooks/useData';
import { isOverdue } from '../lib/metrics';
import { PRIORITY_META } from '../lib/constants';
import { fmtDate, toISODate } from '../lib/dates';
import { hasErrors, validateMilestone, type Errors } from '../lib/validation';
import type { ISODate, Milestone } from '../types';
import { AvatarStack, Button, Card, Field, IconButton, Input, Modal, PageHeader, Segmented, Textarea, cx } from '../components/ui';

type View = 'month' | 'week' | 'day';
type Kind = 'due' | 'start' | 'sprint' | 'meeting' | 'milestone';

interface CalEvent {
  id: string;
  kind: Kind;
  date: ISODate;
  title: string;
  time?: string;
  className: string;
  icon: ReactNode;
  draggable?: { type: 'task' | 'meeting' | 'milestone'; id: string };
  onOpen: () => void;
  sub?: string;
  participants?: string[];
}

const KIND_LABEL: Record<Kind, string> = { due: 'Entregas', start: 'Inicio de actividades', sprint: 'Sprints', meeting: 'Reuniones', milestone: 'Hitos' };

export default function CalendarPage() {
  const { tasks, sprints, meetings, milestones } = useData();
  const members = useMemberMap();
  const today = useToday();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<ISODate>(today);
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(['due', 'sprint', 'meeting', 'milestone']));
  const [milestone, setMilestone] = useState<Milestone | { date: ISODate } | null>(null);
  const nav = useNavigate();

  const events = useMemo(() => {
    const out: CalEvent[] = [];
    const openTask = (id: string) => () => useUI.getState().openTask(id);
    for (const t of tasks) {
      if (t.dueDate) {
        const od = isOverdue(t, today);
        out.push({
          id: `due-${t.id}`, kind: 'due', date: t.dueDate, title: t.title, onOpen: openTask(t.id), draggable: { type: 'task', id: t.id },
          sub: `Entrega · ${members.get(t.assigneeId ?? '')?.name ?? 'Sin asignar'}`,
          className: t.status === 'done' ? 'bg-brand-50 text-brand-800 line-through decoration-brand-400' : od ? 'bg-red-50 text-red-700' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200',
          icon: <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', t.status === 'done' ? 'bg-brand-600' : od ? 'bg-red-600' : PRIORITY_META[t.priority].bar)} />,
        });
      }
      if (t.startDate && t.startDate !== t.dueDate)
        out.push({ id: `start-${t.id}`, kind: 'start', date: t.startDate, title: t.title, onOpen: openTask(t.id), sub: 'Inicio de actividad', className: 'bg-slate-50 text-slate-600', icon: <PlayCircle size={11} className="shrink-0 text-slate-400" /> });
    }
    for (const s of sprints) {
      const open = () => nav(`/sprints#${s.id}`);
      out.push({ id: `ss-${s.id}`, kind: 'sprint', date: s.startDate, title: `Inicio Sprint ${s.number}`, sub: s.name, onOpen: open, className: 'bg-gold-50 text-gold-800', icon: <Rocket size={11} className="shrink-0" /> });
      out.push({ id: `se-${s.id}`, kind: 'sprint', date: s.endDate, title: `Fin Sprint ${s.number}`, sub: s.name, onOpen: open, className: 'bg-gold-50 text-gold-800', icon: <Rocket size={11} className="shrink-0 rotate-90" /> });
    }
    for (const m of meetings)
      out.push({ id: `m-${m.id}`, kind: 'meeting', date: m.date, time: m.time, title: m.title, sub: m.objective, participants: m.participantIds, onOpen: () => useUI.getState().openMeeting(m.id), draggable: { type: 'meeting', id: m.id }, className: 'bg-brand-600 text-white', icon: <CalendarClock size={11} className="shrink-0" /> });
    for (const ms of milestones)
      out.push({ id: `ms-${ms.id}`, kind: 'milestone', date: ms.date, title: ms.title, sub: ms.description, onOpen: () => setMilestone(ms), draggable: { type: 'milestone', id: ms.id }, className: 'bg-bark-100 text-bark-700 font-medium', icon: <Flag size={11} className="shrink-0" /> });
    const order: Record<Kind, number> = { milestone: 0, sprint: 1, meeting: 2, due: 3, start: 4 };
    return out.filter((e) => kinds.has(e.kind)).sort((a, b) => order[a.kind] - order[b.kind] || (a.time ?? '').localeCompare(b.time ?? ''));
  }, [tasks, sprints, meetings, milestones, kinds, today, members, nav]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const date = parseISO(cursor);
  const move = (dir: 1 | -1) => setCursor(toISODate(view === 'month' ? addMonths(date, dir) : view === 'week' ? addWeeks(date, dir) : addDays(date, dir)));
  const title = view === 'month' ? format(date, 'MMMM yyyy', { locale: es }) : view === 'week' ? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: es })} – ${format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}` : format(date, "EEEE d 'de' MMMM yyyy", { locale: es });

  // Reprogramar arrastrando (escritorio)
  const onDrop = (day: ISODate) => (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-planner');
    if (!raw) return;
    const { type, id } = JSON.parse(raw) as { type: string; id: string };
    const st = usePlanner.getState();
    if (type === 'task') {
      const t = st.tasks.find((x) => x.id === id);
      if (t?.startDate && day < t.startDate) return useUI.getState().toast('La fecha límite no puede ser anterior al inicio', 'error');
      st.updateTask(id, { dueDate: day });
    } else if (type === 'meeting') st.updateMeeting(id, { date: day });
    else st.updateMilestone(id, { date: day });
    useUI.getState().toast(`Reprogramado al ${fmtDate(day)}`);
  };

  const Chip = ({ e, full }: { e: CalEvent; full?: boolean }) => (
    <button type="button" onClick={(ev) => { ev.stopPropagation(); e.onOpen(); }} title={`${e.title}${e.sub ? ' — ' + e.sub : ''}`}
      draggable={!!e.draggable} onDragStart={(ev) => e.draggable && ev.dataTransfer.setData('application/x-planner', JSON.stringify(e.draggable))}
      className={cx('flex w-full items-center gap-1 rounded px-1.5 text-left text-[11px] leading-5 transition-opacity hover:opacity-80', e.className, full && 'py-1.5 text-sm')}>
      {e.icon}
      {e.time && <span className="font-semibold">{e.time}</span>}
      <span className="truncate">{e.title}</span>
      {full && e.sub && <span className="ml-auto hidden truncate pl-2 text-xs opacity-75 sm:block">{e.sub}</span>}
      {full && e.participants && <span className="ml-2"><AvatarStack members={e.participants.map((p) => members.get(p)!).filter(Boolean)} size={18} max={3} /></span>}
    </button>
  );

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Entregas, sprints, reuniones e hitos en un solo lugar. Arrastra un evento para reprogramarlo."
        actions={<>
          <Button onClick={() => setMilestone({ date: cursor })}><Flag size={15} /> Nuevo hito</Button>
          <Button variant="primary" onClick={() => useUI.getState().openMeeting(null, cursor)}><Plus size={16} /> Nueva reunión</Button>
        </>} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1">
            <IconButton label="Anterior" onClick={() => move(-1)}><ChevronLeft size={18} /></IconButton>
            <IconButton label="Siguiente" onClick={() => move(1)}><ChevronRight size={18} /></IconButton>
            <Button size="sm" onClick={() => setCursor(today)}>Hoy</Button>
            <h2 className="ml-2 font-display text-base font-extrabold uppercase tracking-wide text-brand-700">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button key={k} type="button" onClick={() => setKinds((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                  className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition-colors', kinds.has(k) ? 'bg-brand-700 text-white ring-brand-700' : 'text-slate-500 ring-slate-200 hover:bg-slate-50')}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <Segmented<View> value={view} onChange={setView} options={[{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' }]} />
          </div>
        </div>

        {view === 'month' && <MonthGrid date={date} today={today} byDay={byDay} onDrop={onDrop} onDay={(d) => { setCursor(d); setView('day'); }} Chip={Chip} />}
        {view === 'week' && (
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0">
            {Array.from({ length: 7 }, (_, i) => toISODate(addDays(startOfWeek(date, { weekStartsOn: 1 }), i))).map((d) => (
              <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(d)} className={cx('min-h-[120px] p-2 md:min-h-[420px]', d === today && 'bg-brand-50/40')}>
                <button type="button" onClick={() => { setCursor(d); setView('day'); }} className="mb-2 flex items-baseline gap-1.5 text-left">
                  <span className="text-xs capitalize text-slate-500">{format(parseISO(d), 'EEE', { locale: es })}</span>
                  <span className={cx('text-lg font-semibold', d === today ? 'text-brand-700' : 'text-slate-800')}>{format(parseISO(d), 'd')}</span>
                </button>
                <div className="space-y-1">{(byDay.get(d) ?? []).map((e) => <Chip key={e.id} e={e} />)}</div>
              </div>
            ))}
          </div>
        )}
        {view === 'day' && (
          <div className="p-4">
            {(byDay.get(cursor) ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <CircleDot size={20} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">Sin eventos este día.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" onClick={() => useUI.getState().openMeeting(null, cursor)}>+ Reunión</Button>
                  <Button size="sm" onClick={() => useUI.getState().openNewTask({ dueDate: cursor })}>+ Entrega</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(byDay.get(cursor) ?? []).map((e) => <Chip key={e.id} e={e} full />)}
                <div className="flex gap-2 pt-3">
                  <Button size="sm" onClick={() => useUI.getState().openMeeting(null, cursor)}>+ Reunión</Button>
                  <Button size="sm" onClick={() => useUI.getState().openNewTask({ dueDate: cursor })}>+ Entrega</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <MilestoneModal value={milestone} onClose={() => setMilestone(null)} />
    </div>
  );
}

function MonthGrid({ date, today, byDay, onDrop, onDay, Chip }: { date: Date; today: ISODate; byDay: Map<string, CalEvent[]>; onDrop: (d: ISODate) => (e: DragEvent) => void; onDay: (d: ISODate) => void; Chip: (p: { e: CalEvent }) => JSX.Element }) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 bg-brand-600">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} className="px-2 py-1.5 text-center font-display text-[11px] font-extrabold uppercase tracking-wide text-white">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const iso = toISODate(d);
          const ev = byDay.get(iso) ?? [];
          return (
            <div key={iso} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(iso)} onClick={() => onDay(iso)}
              className={cx('min-h-[64px] cursor-pointer border-b border-r border-slate-100 p-1 transition-colors hover:bg-slate-50 sm:min-h-[108px]', !isSameMonth(d, date) && 'bg-slate-50/50 text-slate-400')}>
              <span className={cx('mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', iso === today ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600')}>{format(d, 'd')}</span>
              {/* Escritorio: chips · Móvil: puntos */}
              <div className="hidden space-y-0.5 sm:block">
                {ev.slice(0, 3).map((e) => <Chip key={e.id} e={e} />)}
                {ev.length > 3 && <p className="px-1 text-[10px] font-medium text-slate-500">+{ev.length - 3} más</p>}
              </div>
              {ev.length > 0 && <div className="flex flex-wrap gap-0.5 px-1 sm:hidden">{ev.slice(0, 4).map((e) => <span key={e.id} className={cx('h-1.5 w-1.5 rounded-full', e.kind === 'meeting' ? 'bg-brand-600' : e.kind === 'milestone' ? 'bg-bark-500' : e.kind === 'sprint' ? 'bg-gold-500' : 'bg-slate-400')} />)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneModal({ value, onClose }: { value: Milestone | { date: ISODate } | null; onClose: () => void }) {
  const existing = value && 'id' in value ? value : null;
  const [form, setForm] = useState({ title: '', date: '', description: '' });
  const [errors, setErrors] = useState<Errors<Milestone>>({});
  const [lastValue, setLastValue] = useState<typeof value>(null);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) setForm({ title: existing?.title ?? '', date: value.date, description: existing?.description ?? '' });
    setErrors({});
  }
  if (!value) return null;
  const save = () => {
    const e = validateMilestone(form);
    setErrors(e);
    if (hasErrors(e)) return;
    const st = usePlanner.getState();
    existing ? st.updateMilestone(existing.id, form) : st.addMilestone(form);
    useUI.getState().toast(existing ? 'Hito actualizado' : 'Hito creado');
    onClose();
  };
  const remove = async () => {
    if (existing && (await useUI.getState().confirm({ title: 'Eliminar hito', message: `¿Eliminar “${existing.title}”?`, confirmLabel: 'Eliminar', danger: true }))) {
      usePlanner.getState().deleteMilestone(existing.id);
      onClose();
    }
  };
  return (
    <Modal open size="sm" onClose={onClose} title={existing ? 'Editar hito' : 'Nuevo hito'}
      footer={<>{existing && <Button variant="ghost" className="mr-auto !text-red-600" onClick={remove}><Trash2 size={15} /> Eliminar</Button>}<Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}>
      <div className="space-y-3">
        <Field label="Nombre *" error={errors.title}><Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} invalid={!!errors.title} placeholder="Ej. Entrega parcial" /></Field>
        <Field label="Fecha *" error={errors.date}><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Descripción"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
