import type { Priority, SprintStatus, TaskStatus } from '../types';

export const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'review', 'done'];

export const STATUS_META: Record<TaskStatus, { label: string; dot: string; badge: string; chart: string }> = {
  pending: { label: 'Pendiente', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 ring-slate-200', chart: '#94a3b8' },
  in_progress: { label: 'En progreso', dot: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700 ring-blue-200', chart: '#2a78d6' },
  review: { label: 'En revisión', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800 ring-amber-200', chart: '#eda100' },
  done: { label: 'Completada', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', chart: '#1baf7a' },
};

export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_META: Record<Priority, { label: string; emoji: string; badge: string; bar: string; chart: string; rank: number }> = {
  high: { label: 'Alta', emoji: '🔴', badge: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-500', chart: '#e34948', rank: 0 },
  medium: { label: 'Media', emoji: '🟡', badge: 'bg-amber-50 text-amber-800 ring-amber-200', bar: 'bg-amber-400', chart: '#eda100', rank: 1 },
  low: { label: 'Baja', emoji: '🟢', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', chart: '#1baf7a', rank: 2 },
};

export const SPRINT_STATUSES: SprintStatus[] = ['planned', 'active', 'finished'];

export const SPRINT_STATUS_META: Record<SprintStatus, { label: string; badge: string }> = {
  planned: { label: 'Planificado', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  active: { label: 'Activo', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  finished: { label: 'Finalizado', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

/** Paleta categórica validada (orden fijo, nunca ciclado por rango). */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export const colorFor = (index: number) => CATEGORICAL[((index % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
