import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { emptyFilters, type TaskFilters } from '../lib/metrics';

const KEYS: Record<keyof TaskFilters, string> = { query: 'q', assigneeId: 'assignee', priority: 'priority', sprintId: 'sprint', status: 'status', due: 'due' };

/** Filtros guardados en la URL: se pueden compartir y sobreviven a recargas. */
export function useUrlFilters(): [TaskFilters, (f: TaskFilters) => void] {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const f = { ...emptyFilters } as Record<string, string>;
    (Object.keys(KEYS) as (keyof TaskFilters)[]).forEach((k) => {
      const v = params.get(KEYS[k]);
      if (v) f[k] = v;
    });
    return f as unknown as TaskFilters;
  }, [params]);
  const set = useCallback(
    (f: TaskFilters) => {
      const p = new URLSearchParams();
      (Object.keys(KEYS) as (keyof TaskFilters)[]).forEach((k) => f[k] !== emptyFilters[k] && p.set(KEYS[k], String(f[k])));
      setParams(p, { replace: true });
    },
    [setParams],
  );
  return [filters, set];
}
