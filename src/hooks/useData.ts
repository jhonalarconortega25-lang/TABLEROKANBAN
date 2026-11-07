import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanner } from '../store/usePlanner';
import type { PlannerData } from '../types';
import { todayISO } from '../lib/dates';

/** Instantánea de todos los datos (se re-renderiza al cambiar cualquier colección). */
export function useData(): PlannerData {
  return usePlanner(
    useShallow((s) => ({ project: s.project, members: s.members, sprints: s.sprints, tasks: s.tasks, meetings: s.meetings, milestones: s.milestones, history: s.history })),
  );
}

export function useMemberMap() {
  const members = usePlanner((s) => s.members);
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}

export function useSprintMap() {
  const sprints = usePlanner((s) => s.sprints);
  return useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints]);
}

/** Fecha de hoy; se refresca al cambiar de día para recalcular atrasos. */
export function useToday() {
  return todayISO();
}
