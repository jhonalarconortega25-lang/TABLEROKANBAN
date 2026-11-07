import type { Priority, SprintStatus, TaskStatus } from '../types';

export const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'review', 'done'];

export const STATUS_META: Record<TaskStatus, { label: string; dot: string; badge: string; chart: string }> = {
  pending: { label: 'Pendiente', dot: 'bg-stone-400', badge: 'bg-stone-100 text-stone-700 ring-stone-200', chart: '#a8a99a' },
  in_progress: { label: 'En progreso', dot: 'bg-gold-500', badge: 'bg-gold-50 text-gold-700 ring-gold-200', chart: '#dfa020' },
  review: { label: 'En revisión', dot: 'bg-bark-500', badge: 'bg-bark-50 text-bark-700 ring-bark-200', chart: '#9c5a14' },
  done: { label: 'Completada', dot: 'bg-brand-600', badge: 'bg-brand-50 text-brand-700 ring-brand-200', chart: '#3f7a22' },
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
  active: { label: 'Activo', badge: 'bg-gold-50 text-gold-700 ring-gold-200' },
  finished: { label: 'Finalizado', badge: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

/** Paleta categórica estilo póster, validada (orden fijo; los 5 primeros pasan las pruebas de daltonismo). */
export const CATEGORICAL = ['#3f7a22', '#dfa020', '#9c5a14', '#008f8c', '#7d58a8', '#c4572e', '#5d7f99', '#a3a13a'];

export const colorFor = (index: number) => CATEGORICAL[((index % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
