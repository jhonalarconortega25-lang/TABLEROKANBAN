import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ListTodo, MessageSquare, Paperclip, Plus, Trash2 } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useMemberMap, useSprintMap, useToday } from '../hooks/useData';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { checklistProgress, filterTasks, isOverdue } from '../lib/metrics';
import { PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { fmtShort, relativeDays } from '../lib/dates';
import type { Task } from '../types';
import { Avatar, Button, Card, EmptyState, IconButton, PageHeader, PriorityBadge, Segmented, Tag, cx } from '../components/ui';
import { FilterBar } from '../components/FilterBar';

type SortKey = 'title' | 'assignee' | 'status' | 'priority' | 'dueDate' | 'sprint';
type Group = 'none' | 'sprint' | 'phase' | 'status';

export default function Activities() {
  const tasks = usePlanner((s) => s.tasks);
  const members = useMemberMap();
  const sprints = useSprintMap();
  const today = useToday();
  const [filters, setFilters] = useUrlFilters();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'dueDate', dir: 1 });
  const [group, setGroup] = useState<Group>('none');

  const list = useMemo(() => {
    const val = (t: Task): string | number => {
      switch (sort.key) {
        case 'title': return t.title.toLowerCase();
        case 'assignee': return members.get(t.assigneeId ?? '')?.name.toLowerCase() ?? '~';
        case 'status': return STATUSES.indexOf(t.status);
        case 'priority': return PRIORITY_META[t.priority].rank;
        case 'sprint': return sprints.get(t.sprintId ?? '')?.number ?? 9999;
        default: return t.dueDate ?? '9999';
      }
    };
    return filterTasks(tasks, filters, today).sort((a, b) => (val(a) < val(b) ? -sort.dir : val(a) > val(b) ? sort.dir : 0));
  }, [tasks, filters, today, sort, members, sprints]);

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '', items: list }];
    const map = new Map<string, Task[]>();
    for (const t of list) {
      const k = group === 'sprint' ? t.sprintId ?? '' : group === 'phase' ? t.phase || '' : t.status;
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    const label = (k: string) =>
      group === 'sprint' ? (sprints.get(k) ? `Sprint ${sprints.get(k)!.number} · ${sprints.get(k)!.name}` : 'Backlog') : group === 'phase' ? k || 'Sin fase' : STATUS_META[k as Task['status']].label;
    const keys = [...map.keys()].sort((a, b) =>
      group === 'sprint' ? (sprints.get(a)?.number ?? 999) - (sprints.get(b)?.number ?? 999) : group === 'status' ? STATUSES.indexOf(a as Task['status']) - STATUSES.indexOf(b as Task['status']) : a.localeCompare(b));
    return keys.map((k) => ({ key: k, label: label(k), items: map.get(k)! }));
  }, [list, group, sprints]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cx('px-3 py-2.5 text-left font-display text-[11px] font-extrabold uppercase tracking-wide text-white', cls)}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-gold-200">
        {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader title="Actividades" subtitle="Registra y administra todas las actividades del proyecto."
        actions={<>
          <Segmented<Group> value={group} onChange={setGroup} options={[{ value: 'none', label: 'Lista' }, { value: 'sprint', label: 'Por sprint' }, { value: 'phase', label: 'Por fase' }, { value: 'status', label: 'Por estado' }]} />
          <Button variant="primary" onClick={() => useUI.getState().openNewTask()}><Plus size={16} /> Nueva actividad</Button>
        </>} />
      <FilterBar filters={filters} onChange={setFilters} count={list.length} />

      {tasks.length === 0 ? (
        <Card><EmptyState icon={<ListTodo size={20} />} title="Aún no hay actividades" text="Crea la primera actividad para empezar a medir el avance del proyecto." action={<Button variant="primary" onClick={() => useUI.getState().openNewTask()}><Plus size={15} /> Nueva actividad</Button>} /></Card>
      ) : list.length === 0 ? (
        <Card><EmptyState title="Ninguna actividad coincide con los filtros" action={<Button onClick={() => setFilters({ ...filters, query: '', assigneeId: '', priority: '', sprintId: '', status: '', due: 'all' })}>Limpiar filtros</Button>} /></Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              {g.label && <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-brand-700">{g.label} <span className="text-xs font-normal text-slate-400">{g.items.length}</span></h3>}
              {/* Tabla (escritorio) */}
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed">
                  <thead className="bg-brand-600">
                    <tr>
                      <th className="w-10" />
                      {th('title', 'Actividad', 'w-[34%]')}
                      {th('assignee', 'Responsable')}
                      {th('sprint', 'Sprint', 'w-24')}
                      {th('status', 'Estado', 'w-36')}
                      {th('priority', 'Prioridad', 'w-24')}
                      {th('dueDate', 'Fecha límite', 'w-28')}
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {g.items.map((t) => <Row key={t.id} task={t} />)}
                  </tbody>
                </table>
              </Card>
              {/* Tarjetas (móvil) */}
              <div className="space-y-2 md:hidden">{g.items.map((t) => <MobileCard key={t.id} task={t} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function Row({ task: t }: { task: Task }) {
    const overdue = isOverdue(t, today);
    const cp = checklistProgress(t);
    const sp = sprints.get(t.sprintId ?? '');
    return (
      <tr className="group cursor-pointer odd:bg-white even:bg-brand-50/40 hover:bg-gold-50" onClick={() => useUI.getState().openTask(t.id)}>
        <td className="pl-4" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" aria-label="Completar" checked={t.status === 'done'} onChange={(e) => { usePlanner.getState().setTaskStatus(t.id, e.target.checked ? 'done' : 'in_progress'); useUI.getState().toast(e.target.checked ? 'Actividad completada · avance actualizado' : 'Actividad reabierta'); }} className="h-4 w-4 cursor-pointer accent-brand-600" />
        </td>
        <td className="px-3 py-2.5">
          <p className={cx('truncate text-sm font-medium', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
          <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-slate-400">
            {t.phase && <span className="truncate">{t.phase}</span>}
            {cp !== null && <span>☑ {t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
            {t.comments.length > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare size={11} />{t.comments.length}</span>}
            {t.attachments.length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={11} />{t.attachments.length}</span>}
          </div>
        </td>
        <td className="px-3"><span className="flex items-center gap-2 text-sm text-slate-600"><Avatar member={members.get(t.assigneeId ?? '')} size={22} /><span className="truncate">{members.get(t.assigneeId ?? '')?.name ?? 'Sin asignar'}</span></span></td>
        <td className="px-3">{sp ? <Tag>S{sp.number}</Tag> : <span className="text-xs text-slate-400">Backlog</span>}</td>
        <td className="px-3" onClick={(e) => e.stopPropagation()}>
          <select value={t.status} onChange={(e) => usePlanner.getState().setTaskStatus(t.id, e.target.value as Task['status'])} aria-label="Estado"
            className={cx('h-7 w-full cursor-pointer rounded-md px-1.5 text-xs font-medium ring-1 ring-inset focus:outline-none', STATUS_META[t.status].badge)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </td>
        <td className="px-3"><PriorityBadge priority={t.priority} /></td>
        <td className={cx('px-3 text-xs', overdue ? 'font-medium text-red-600' : 'text-slate-600')}>
          {t.dueDate ? <>{fmtShort(t.dueDate)}{t.status !== 'done' && <span className="block text-[11px] font-normal text-slate-400">{overdue ? 'Atrasada · ' : ''}{relativeDays(t.dueDate, today)}</span>}</> : '—'}
        </td>
        <td className="pr-3" onClick={(e) => e.stopPropagation()}>
          <IconButton label="Eliminar" onClick={() => confirmDelete(t)} className="opacity-0 group-hover:opacity-100 hover:!text-red-600"><Trash2 size={15} /></IconButton>
        </td>
      </tr>
    );
  }

  function MobileCard({ task: t }: { task: Task }) {
    const overdue = isOverdue(t, today);
    const sp = sprints.get(t.sprintId ?? '');
    return (
      <Card className="flex items-start gap-3 p-3" onClick={() => useUI.getState().openTask(t.id)}>
        <input type="checkbox" aria-label="Completar" checked={t.status === 'done'} onClick={(e) => e.stopPropagation()} onChange={(e) => usePlanner.getState().setTaskStatus(t.id, e.target.checked ? 'done' : 'in_progress')} className="mt-1 h-4 w-4 accent-brand-600" />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-medium', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_META[t.status].badge)}>{STATUS_META[t.status].label}</span>
            <PriorityBadge priority={t.priority} />
            {sp && <Tag>S{sp.number}</Tag>}
            {t.dueDate && <span className={cx('text-[11px]', overdue ? 'font-medium text-red-600' : 'text-slate-500')}>{fmtShort(t.dueDate)}</span>}
          </div>
        </div>
        <Avatar member={members.get(t.assigneeId ?? '')} size={24} />
      </Card>
    );
  }
}

async function confirmDelete(t: Task) {
  if (await useUI.getState().confirm({ title: 'Eliminar actividad', message: `¿Eliminar “${t.title}”? Los indicadores se recalcularán.`, confirmLabel: 'Eliminar', danger: true })) {
    usePlanner.getState().deleteTask(t.id);
    useUI.getState().toast('Actividad eliminada');
  }
}
