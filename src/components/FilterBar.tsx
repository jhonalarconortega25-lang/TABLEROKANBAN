import { Search, X } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { emptyFilters, type TaskFilters } from '../lib/metrics';
import { Button, Select, cx } from './ui';

export function FilterBar({ filters, onChange, hideStatus, count }: { filters: TaskFilters; onChange: (f: TaskFilters) => void; hideStatus?: boolean; count?: number }) {
  const members = usePlanner((s) => s.members);
  const sprints = usePlanner((s) => s.sprints);
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  const active = (Object.keys(emptyFilters) as (keyof TaskFilters)[]).filter((k) => filters[k] !== emptyFilters[k]).length;
  const sel = (on: boolean) => cx('!h-8 !w-auto text-xs', on && '!border-brand-400 !bg-brand-50 !text-brand-700');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="Filtrar por texto…"
          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <Select aria-label="Responsable" value={filters.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })} className={sel(!!filters.assigneeId)}>
        <option value="">Todos los responsables</option>
        <option value="none">Sin asignar</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
      <Select aria-label="Prioridad" value={filters.priority} onChange={(e) => set({ priority: e.target.value as TaskFilters['priority'] })} className={sel(!!filters.priority)}>
        <option value="">Toda prioridad</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].emoji} {PRIORITY_META[p].label}</option>)}
      </Select>
      <Select aria-label="Sprint" value={filters.sprintId} onChange={(e) => set({ sprintId: e.target.value })} className={sel(!!filters.sprintId)}>
        <option value="">Todos los sprints</option>
        <option value="none">Backlog</option>
        {[...sprints].sort((a, b) => a.number - b.number).map((s) => <option key={s.id} value={s.id}>Sprint {s.number}</option>)}
      </Select>
      {!hideStatus && (
        <Select aria-label="Estado" value={filters.status} onChange={(e) => set({ status: e.target.value as TaskFilters['status'] })} className={sel(!!filters.status)}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
      )}
      <Select aria-label="Fecha de entrega" value={filters.due} onChange={(e) => set({ due: e.target.value as TaskFilters['due'] })} className={sel(filters.due !== 'all')}>
        <option value="all">Cualquier fecha</option>
        <option value="overdue">Atrasadas</option>
        <option value="today">Vencen hoy</option>
        <option value="week">Próximos 7 días</option>
        <option value="next14">Próximos 14 días</option>
        <option value="nodate">Sin fecha límite</option>
      </Select>
      {active > 0 && <Button size="sm" variant="ghost" onClick={() => onChange(emptyFilters)}><X size={13} /> Limpiar ({active})</Button>}
      {count !== undefined && <span className="ml-auto text-xs text-slate-500">{count} actividad{count === 1 ? '' : 'es'}</span>}
    </div>
  );
}
