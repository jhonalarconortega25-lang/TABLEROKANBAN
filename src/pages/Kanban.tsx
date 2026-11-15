import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, closestCorners, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CalendarDays, CheckSquare, MessageSquare, Plus, Paperclip } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useMemberMap, useSprintMap, useToday } from '../hooks/useData';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { checklistProgress, filterTasks, isOverdue } from '../lib/metrics';
import { PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { fmtShort, relativeDays } from '../lib/dates';
import type { Task, TaskStatus } from '../types';
import { Avatar, Button, PageHeader, PriorityBadge, Tag, cx } from '../components/ui';
import { FilterBar } from '../components/FilterBar';

export default function Kanban() {
  const tasks = usePlanner((s) => s.tasks);
  const today = useToday();
  const [filters, setFilters] = useUrlFilters();
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = useMemo(() => filterTasks(tasks, { ...filters, status: '' }, today), [tasks, filters, today]);
  const columns = useMemo(() => {
    const by = Object.fromEntries(STATUSES.map((s) => [s, [] as Task[]])) as Record<TaskStatus, Task[]>;
    for (const t of visible) by[t.status].push(t);
    for (const s of STATUSES) by[s].sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    return by;
  }, [visible]);

  const onStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onEnd = (e: DragEndEvent) => {
    setDragId(null);
    const to = e.over?.id as TaskStatus | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (!to || !task || task.status === to) return;
    usePlanner.getState().setTaskStatus(task.id, to);
    useUI.getState().toast(to === 'done' ? `“${task.title}” completada · avance actualizado` : `Movida a ${STATUS_META[to].label}`);
  };
  const dragging = tasks.find((t) => t.id === dragId);

  return (
    <div>
      <PageHeader title="Tablero Kanban" subtitle="Arrastra las tarjetas entre columnas para cambiar su estado." actions={<Button variant="primary" onClick={() => useUI.getState().openNewTask({ sprintId: filters.sprintId && filters.sprintId !== 'none' ? filters.sprintId : undefined })}><Plus size={16} /> Nueva actividad</Button>} />
      <FilterBar filters={filters} onChange={setFilters} hideStatus count={visible.length} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragId(null)}>
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {STATUSES.map((s) => <Column key={s} status={s} tasks={columns[s]} sprintFilter={filters.sprintId} />)}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>{dragging && <CardView task={dragging} overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}

const COLUMN_HEAD: Record<TaskStatus, string> = {
  pending: 'bg-brand-800 text-white',
  in_progress: 'bg-gold-500 text-brand-900',
  review: 'bg-bark-500 text-white',
  done: 'bg-brand-600 text-white',
};

function Column({ status, tasks, sprintFilter }: { status: TaskStatus; tasks: Task[]; sprintFilter: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const add = () => {
    if (!title.trim()) return setAdding(false);
    usePlanner.getState().addTask({ title, status, sprintId: sprintFilter && sprintFilter !== 'none' ? sprintFilter : usePlanner.getState().sprints.find((s) => s.status === 'active')?.id ?? null });
    setTitle('');
    useUI.getState().toast('Actividad creada');
  };
  return (
    <section className="flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 border-dashed border-brand-300/80 bg-white/70 sm:w-[300px] lg:w-auto lg:max-w-none">
      <header className={cx('mb-2 flex items-center gap-2 px-3 py-2.5', COLUMN_HEAD[status])}>
        <h2 className="font-display text-xs font-extrabold uppercase tracking-wide">{STATUS_META[status].label}</h2>
        <span className="rounded-full bg-white px-2 text-xs font-bold text-slate-700">{tasks.length}</span>
        <button type="button" onClick={() => setAdding(true)} className="ml-auto rounded-full p-1 opacity-80 hover:bg-white/20 hover:opacity-100" aria-label={`Añadir en ${STATUS_META[status].label}`}><Plus size={15} /></button>
      </header>
      <div ref={setNodeRef} className={cx('flex min-h-[140px] flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition-colors', isOver && 'bg-gold-50 ring-2 ring-inset ring-gold-400')}>
        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); add(); }} className="rounded-lg bg-white p-2 shadow-sm">
            <textarea autoFocus rows={2} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } if (e.key === 'Escape') setAdding(false); }}
              onBlur={() => !title.trim() && setAdding(false)} placeholder="Nombre de la actividad…" className="w-full resize-none text-sm focus:outline-none" maxLength={120} />
            <div className="flex gap-1.5"><Button type="submit" size="sm" variant="primary">Añadir</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button></div>
          </form>
        )}
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
        {tasks.length === 0 && !adding && <p className="py-6 text-center text-xs text-slate-400">Suelta aquí</p>}
      </div>
    </section>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cx('touch-manipulation outline-none', isDragging && 'opacity-30')}>
      <CardView task={task} />
    </div>
  );
}

function CardView({ task: t, overlay }: { task: Task; overlay?: boolean }) {
  const members = useMemberMap();
  const sprints = useSprintMap();
  const today = useToday();
  const overdue = isOverdue(t, today);
  const cp = checklistProgress(t);
  const sp = sprints.get(t.sprintId ?? '');
  return (
    <article onClick={() => !overlay && useUI.getState().openTask(t.id)}
      className={cx('group relative cursor-grab overflow-hidden rounded-xl border border-brand-100 bg-white p-3 pl-3.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing', overlay && 'rotate-[1.5deg] shadow-xl ring-2 ring-brand-300')}>
      <span className={cx('absolute inset-y-0 left-0 w-1', PRIORITY_META[t.priority].bar)} aria-hidden />
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={t.priority} />
        {sp && <Tag>Sprint {sp.number}</Tag>}
        {overdue && <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Atrasada</span>}
      </div>
      <p className={cx('text-sm font-medium leading-snug', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
      {cp !== null && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full transition-all', cp === 100 ? 'bg-brand-800' : 'bg-brand-600')} style={{ width: `${cp}%` }} /></div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><CheckSquare size={11} />{cp}%</span>
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
        <Avatar member={members.get(t.assigneeId ?? '')} size={22} />
        <span className="truncate">{members.get(t.assigneeId ?? '')?.name ?? 'Sin asignar'}</span>
        <span className="ml-auto flex items-center gap-2">
          {t.comments.length > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare size={11} />{t.comments.length}</span>}
          {t.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{t.attachments.length}</span>}
          {t.dueDate && <span className={cx('inline-flex items-center gap-1', overdue && 'font-medium text-red-600')} title={relativeDays(t.dueDate, today)}><CalendarDays size={11} />{fmtShort(t.dueDate)}</span>}
        </span>
      </div>
    </article>
  );
}
