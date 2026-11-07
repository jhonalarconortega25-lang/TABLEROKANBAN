// Sincronización opcional con Supabase (multiusuario + tiempo real).
// Se activa solo si existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
// El store local sigue siendo la fuente que consumen las vistas; este módulo
// replica cada cambio a tablas relacionales y aplica los cambios remotos.
import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { usePlanner, selectData, sanitize } from '../../store/usePlanner';
import type { PlannerData } from '../../types';

type Collection = 'members' | 'sprints' | 'tasks' | 'meetings' | 'milestones' | 'history';
const COLLECTIONS: Collection[] = ['members', 'sprints', 'tasks', 'meetings', 'milestones', 'history'];
const PROJECT_ROW_ID = 'main';

interface SyncState { mode: 'local' | 'supabase'; ok: boolean; detail: string }
export const useSyncStatus = create<SyncState>(() => ({ mode: 'local', ok: true, detail: 'Los datos se guardan en este navegador.' }));
export const syncStatus = () => useSyncStatus.getState();

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);

// ---- Mapeo camelCase <-> snake_case ----
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const rowFrom = (o: object) => Object.fromEntries(Object.entries(o).map(([k, v]) => [toSnake(k), v]));
const objFrom = <T,>(r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [toCamel(k), v])) as T;

// Orden de escritura que respeta claves foráneas.
const UPSERT_ORDER: Collection[] = ['members', 'sprints', 'meetings', 'tasks', 'milestones', 'history'];
const DELETE_ORDER: Collection[] = [...UPSERT_ORDER].reverse();

let client: SupabaseClient | null = null;
let applyingRemote = false;
let lastSynced: PlannerData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const setStatus = (ok: boolean, detail: string) => useSyncStatus.setState({ mode: 'supabase', ok, detail });

async function fetchAll(sb: SupabaseClient): Promise<PlannerData | null> {
  const { data: project, error } = await sb.from('project').select('*').eq('id', PROJECT_ROW_ID).maybeSingle();
  if (error) throw error;
  if (!project) return null;
  const out: Record<string, unknown> = { project: objFrom(project) };
  for (const c of COLLECTIONS) {
    const q = sb.from(c).select('*');
    const { data, error: e } = c === 'history' ? await q.order('at', { ascending: false }).limit(500) : await q;
    if (e) throw e;
    out[c] = (data ?? []).map((r) => objFrom(r));
  }
  return sanitize(out as unknown as PlannerData);
}

async function pushDiff(sb: SupabaseClient, prev: PlannerData | null, next: PlannerData) {
  if (!prev || prev.project !== next.project) {
    const { id: _ignored, ...rest } = rowFrom(next.project) as Record<string, unknown>;
    const { error } = await sb.from('project').upsert({ id: PROJECT_ROW_ID, ...rest });
    if (error) throw error;
  }
  for (const c of UPSERT_ORDER) {
    const before = new Map((prev?.[c] ?? []).map((x) => [x.id, x]));
    const changed = (next[c] as { id: string }[]).filter((x) => before.get(x.id) !== x);
    if (changed.length) {
      const { error } = await sb.from(c).upsert(changed.map(rowFrom));
      if (error) throw error;
    }
  }
  for (const c of DELETE_ORDER) {
    const now = new Set((next[c] as { id: string }[]).map((x) => x.id));
    const removed = (prev?.[c] ?? []).filter((x) => !now.has(x.id)).map((x) => x.id);
    if (removed.length) {
      const { error } = await sb.from(c).delete().in('id', removed);
      if (error) throw error;
    }
  }
}

function schedulePush() {
  if (!client) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const next = selectData(usePlanner.getState());
    try {
      await pushDiff(client!, lastSynced, next);
      lastSynced = next;
      setStatus(true, 'Cambios guardados en Supabase.');
    } catch (e) {
      setStatus(false, `Error al guardar: ${(e as Error).message}. Los cambios siguen en local.`);
    }
  }, 350);
}

function applyRemote(table: string, eventType: string, newRow: Record<string, unknown>, oldRow: Record<string, unknown>) {
  applyingRemote = true;
  try {
    const st = usePlanner.getState();
    if (table === 'project') {
      if (eventType !== 'DELETE') usePlanner.setState({ project: { ...st.project, ...objFrom(newRow) } as PlannerData['project'] });
    } else if ((COLLECTIONS as string[]).includes(table)) {
      const c = table as Collection;
      const list = st[c] as { id: string }[];
      let next: { id: string }[];
      if (eventType === 'DELETE') next = list.filter((x) => x.id !== oldRow.id);
      else {
        const obj = objFrom<{ id: string }>(newRow);
        next = list.some((x) => x.id === obj.id) ? list.map((x) => (x.id === obj.id ? obj : x)) : c === 'history' ? [obj, ...list] : [...list, obj];
      }
      usePlanner.setState({ [c]: sanitize({ ...selectData(st), [c]: next })[c] } as Partial<PlannerData>);
    }
    lastSynced = selectData(usePlanner.getState());
  } finally {
    applyingRemote = false;
  }
}

export async function startSupabaseSync() {
  if (!isSupabaseConfigured || client) return;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url!, key!);
  setStatus(false, 'Conectando con Supabase…');
  try {
    const remote = await fetchAll(client);
    if (remote) {
      applyingRemote = true;
      usePlanner.getState().replaceAll(remote);
      applyingRemote = false;
      lastSynced = selectData(usePlanner.getState());
    } else {
      // Base vacía: se publica el estado local como punto de partida.
      await pushDiff(client, null, selectData(usePlanner.getState()));
      lastSynced = selectData(usePlanner.getState());
    }
    setStatus(true, 'Conectado. Los cambios se sincronizan en tiempo real.');
  } catch (e) {
    setStatus(false, `No se pudo conectar: ${(e as Error).message}. Trabajando en modo local.`);
    return;
  }

  usePlanner.subscribe(() => {
    if (!applyingRemote) schedulePush();
  });

  client
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) =>
      applyRemote(payload.table, payload.eventType, (payload.new ?? {}) as Record<string, unknown>, (payload.old ?? {}) as Record<string, unknown>),
    )
    .subscribe();
}
