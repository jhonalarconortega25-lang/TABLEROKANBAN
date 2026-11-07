// Cálculos derivados. Funciones puras: reciben los datos reales del store y
// devuelven indicadores. Ninguna vista guarda resultados: se recalculan siempre.
import { startOfWeek, addWeeks, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ISODate, Meeting, Member, PlannerData, Priority, Sprint, Task, TaskStatus, WeightingMode } from '../types';
import { STATUSES, PRIORITIES } from './constants';
import { daysBetween, todayISO, toISODate } from './dates';

export const taskWeight = (t: Task, mode: WeightingMode) => (mode === 'weighted' ? Math.max(1, t.weight || 1) : 1);

/** Avance (%) = completadas / total × 100 (con pesos iguales). Con 'weighted' usa el peso de cada tarea. */
export function progressOf(tasks: Task[], mode: WeightingMode = 'equal'): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((s, t) => s + taskWeight(t, mode), 0);
  const done = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + taskWeight(t, mode), 0);
  return Math.round((done / total) * 100);
}

export const isOverdue = (t: Task, today: ISODate = todayISO()) =>
  t.status !== 'done' && !!t.dueDate && t.dueDate < today;

export const checklistProgress = (t: Task) =>
  t.checklist.length === 0 ? null : Math.round((t.checklist.filter((c) => c.done).length / t.checklist.length) * 100);

export interface Counts {
  total: number;
  pending: number;
  in_progress: number;
  review: number;
  done: number;
  overdue: number;
}

export function countTasks(tasks: Task[], today: ISODate = todayISO()): Counts {
  const c: Counts = { total: tasks.length, pending: 0, in_progress: 0, review: 0, done: 0, overdue: 0 };
  for (const t of tasks) {
    c[t.status]++;
    if (isOverdue(t, today)) c.overdue++;
  }
  return c;
}

export const statusDistribution = (tasks: Task[]) =>
  STATUSES.map((s) => ({ key: s as TaskStatus, value: tasks.filter((t) => t.status === s).length }));

export const priorityDistribution = (tasks: Task[]) =>
  PRIORITIES.map((p) => ({ key: p as Priority, value: tasks.filter((t) => t.priority === p).length }));

export interface SprintStats {
  sprint: Sprint;
  tasks: Task[];
  counts: Counts;
  progress: number;
}

export function sprintStats(data: PlannerData, today: ISODate = todayISO()): SprintStats[] {
  return [...data.sprints]
    .sort((a, b) => a.number - b.number)
    .map((sprint) => {
      const tasks = data.tasks.filter((t) => t.sprintId === sprint.id);
      return { sprint, tasks, counts: countTasks(tasks, today), progress: progressOf(tasks, data.project.weightingMode) };
    });
}

export interface MemberStats {
  member: Member;
  assigned: number;
  completed: number;
  open: number; // no completadas
  inProgress: number;
  overdue: number;
  collaborating: number;
  progress: number;
}

export function memberStats(data: PlannerData, today: ISODate = todayISO()): MemberStats[] {
  return data.members.map((member) => {
    const mine = data.tasks.filter((t) => t.assigneeId === member.id);
    const c = countTasks(mine, today);
    return {
      member,
      assigned: c.total,
      completed: c.done,
      open: c.total - c.done,
      inProgress: c.in_progress + c.review,
      overdue: c.overdue,
      collaborating: data.tasks.filter((t) => t.collaboratorIds.includes(member.id) && t.status !== 'done').length,
      progress: progressOf(mine, data.project.weightingMode),
    };
  });
}

/** Actividades completadas por semana (lunes a domingo) en las últimas `weeks` semanas. */
export function completedPerWeek(tasks: Task[], weeks = 8, today: ISODate = todayISO()) {
  const thisWeek = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(thisWeek, i - weeks + 1);
    return { start: toISODate(start), end: toISODate(addWeeks(start, 1)), label: format(start, 'd MMM', { locale: es }), completed: 0, cumulative: 0 };
  });
  const firstStart = buckets[0].start;
  let before = 0;
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const d = t.completedAt.slice(0, 10);
    if (d < firstStart) {
      before++;
      continue;
    }
    const b = buckets.find((x) => d >= x.start && d < x.end);
    if (b) b.completed++;
  }
  let acc = before;
  for (const b of buckets) {
    acc += b.completed;
    b.cumulative = acc;
  }
  return buckets;
}

/** Burndown simple de un sprint: tareas restantes por día vs línea ideal. */
export function sprintBurndown(sprint: Sprint, tasks: Task[], today: ISODate = todayISO()) {
  const total = tasks.length;
  const days = Math.max(1, daysBetween(sprint.startDate, sprint.endDate));
  const out: { day: string; ideal: number; remaining: number | null }[] = [];
  for (let i = 0; i <= days; i++) {
    const d = toISODate(new Date(parseISO(sprint.startDate).getTime() + i * 86400000));
    const doneBy = tasks.filter((t) => t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) <= d).length;
    out.push({
      day: format(parseISO(d), 'd MMM', { locale: es }),
      ideal: Math.round((total - (total * i) / days) * 10) / 10,
      remaining: d <= today ? total - doneBy : null,
    });
  }
  return out;
}

export function upcomingDeadlines(tasks: Task[], horizonDays = 14, today: ISODate = todayISO()) {
  return tasks
    .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate >= today && daysBetween(today, t.dueDate) <= horizonDays)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
}

export function overdueTasks(tasks: Task[], today: ISODate = todayISO()) {
  return tasks.filter((t) => isOverdue(t, today)).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
}

export function upcomingMeetings(meetings: Meeting[], today: ISODate = todayISO(), limit = 5) {
  return meetings
    .filter((m) => m.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
    .slice(0, limit);
}

/** Avance esperado según el tiempo transcurrido del proyecto (para comparar con el real). */
export function expectedProgress(start: ISODate, end: ISODate, today: ISODate = todayISO()) {
  const total = daysBetween(start, end);
  if (total <= 0) return 100;
  const elapsed = Math.min(Math.max(daysBetween(start, today), 0), total);
  return Math.round((elapsed / total) * 100);
}

// ---------- Filtros compartidos (Actividades y Kanban) ----------
export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'next14' | 'nodate';

export interface TaskFilters {
  query: string;
  assigneeId: string; // '' = todos, 'none' = sin asignar
  priority: '' | Priority;
  sprintId: string; // '' = todos, 'none' = backlog
  status: '' | TaskStatus;
  due: DueFilter;
}

export const emptyFilters: TaskFilters = { query: '', assigneeId: '', priority: '', sprintId: '', status: '', due: 'all' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterTasks(tasks: Task[], f: TaskFilters, today: ISODate = todayISO()): Task[] {
  const q = norm(f.query.trim());
  return tasks.filter((t) => {
    if (q && !norm(`${t.title} ${t.description} ${t.phase}`).includes(q)) return false;
    if (f.assigneeId === 'none' ? t.assigneeId !== null : f.assigneeId && t.assigneeId !== f.assigneeId) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.sprintId === 'none' ? t.sprintId !== null : f.sprintId && t.sprintId !== f.sprintId) return false;
    if (f.status && t.status !== f.status) return false;
    switch (f.due) {
      case 'overdue':
        return isOverdue(t, today);
      case 'today':
        return t.dueDate === today;
      case 'week':
        return !!t.dueDate && t.dueDate >= today && daysBetween(today, t.dueDate) <= 7;
      case 'next14':
        return !!t.dueDate && t.dueDate >= today && daysBetween(today, t.dueDate) <= 14;
      case 'nodate':
        return !t.dueDate;
      default:
        return true;
    }
  });
}

export const matchesText = (text: string, query: string) => norm(text).includes(norm(query.trim()));
