import type { ReactNode } from "react";
import type { Task } from '../types';
import { useMemberMap, useToday } from '../hooks/useData';
import { useUI } from '../store/useUI';
import { isOverdue } from '../lib/metrics';
import { fmtShort, relativeDays } from '../lib/dates';
import { Avatar, PriorityBadge, cx } from './ui';

/** Fila compacta de actividad (listas del dashboard, sprints, equipo). */
export function TaskLine({ task, right }: { task: Task; right?: ReactNode }) {
  const members = useMemberMap();
  const today = useToday();
  const overdue = isOverdue(task, today);
  return (
    <button type="button" onClick={() => useUI.getState().openTask(task.id)} className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
      <Avatar member={task.assigneeId ? members.get(task.assigneeId) : null} size={22} />
      <span className={cx('min-w-0 flex-1 truncate text-sm', task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700')}>{task.title}</span>
      <PriorityBadge priority={task.priority} compact />
      {right ?? (task.dueDate && (
        <span className={cx('w-20 shrink-0 text-right text-xs', overdue ? 'font-medium text-red-600' : 'text-slate-500')} title={fmtShort(task.dueDate)}>
          {task.status === 'done' ? fmtShort(task.dueDate) : relativeDays(task.dueDate, today)}
        </span>
      ))}
    </button>
  );
}
