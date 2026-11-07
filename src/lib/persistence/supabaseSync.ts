// Sincronización con Supabase (multiusuario + tiempo real, sin cuentas).
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

interface SyncState { mode: 'local' | 'supabase' | 'shared'; ok: boolean; loaded: boolean; readOnly: boolean; detail: string }

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);

export const useSyncStatus = create<SyncState>(() =>
  isSupabaseConfigured
    ? { mode: 'supabase', ok: false, loaded: false, readOnly: false, detail: 'Conectando con la base de datos del equipo…' }
    : { mode: 'local', ok: true, loaded: true, readOnly: false, detail: 'Los datos se guardan en este navegador.' },
);
export const syncStatus = () => useSyncStatus.getState();

// ---- Mapeo camelCase <-> snake_case ----
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const rowFrom = (o: object) => Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(o)) as object).map(([k, v]) => [toSnake(k), v]));
const objFrom = <T,>(r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [toCamel(k), v])) as T;

/** Normaliza una sola fila remota (sin tocar la identidad del resto). */
function normalizeRow(c: Collection, row: Record<string, unknown>) {
  const obj = objFrom<Record<string, unknown>>(row);
  for (const k of Object.keys(obj)) if (obj[k] === null && (k === 'email' || k === 'avatarUrl')) delete obj[k];
  return sanitize({ ...emptyData(), [c]: [obj] } as PlannerData)[c][0] as { id: string };
}
const emptyData = (): Partial<PlannerData> => ({ members: [], sprints: [], tasks: [], meetings: [], milestones: [], history: [] });

// Orden de escritura que respeta claves foráneas.
const UPSERT_ORDER: Collection[] = ['members', 'sprints', 'meetings', 'tasks', 'milestones', 'history'];
const DELETE_ORDER: Collection[] = [...UPSERT_ORDER].reverse();

let client: SupabaseClient | null = null;
let applyingRemote = false;
/** Último estado que la base conoce. Se diferencia contra él para subir solo lo cambiado. */
let lastSynced: PlannerData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> = Promise.resolve();

const setStatus = (ok: boolean, detail: string) => useSyncStatus.setState({ mode: 'supabase', ok, detail, loaded: true });

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

/** Sube los cambios locales pendientes (en serie: nunca dos subidas a la vez). */
function flush() {
  pushing = pushing.then(async () => {
    if (!client || !lastSynced) return;
    const next = selectData(usePlanner.getState());
    const prev = lastSynced;
    try {
      await pushDiff(client, prev, next);
      // Solo se marca como sincronizado lo que efectivamente se subió.
      lastSynced = mergeSynced(lastSynced!, prev, next);
      setStatus(true, 'Conectado. Los cambios se guardan para todo el equipo en tiempo real.');
    } catch (e) {
      setStatus(false, `No se pudo guardar: ${(e as Error).message}. Se reintentará con el próximo cambio.`);
    }
  });
  return pushing;
}

/** Combina: lo que se subió (prev→next) sobre lo que la base pudo recibir mientras tanto. */
function mergeSynced(current: PlannerData, prev: PlannerData, next: PlannerData): PlannerData {
  const out = { ...current, project: current.project === prev.project ? next.project : current.project } as PlannerData;
  for (const c of COLLECTIONS) {
    const prevMap = new Map((prev[c] as { id: string }[]).map((x) => [x.id, x]));
    const nextMap = new Map((next[c] as { id: string }[]).map((x) => [x.id, x]));
    const curMap = new Map((current[c] as { id: string }[]).map((x) => [x.id, x]));
    for (const [id, item] of nextMap) if (prevMap.get(id) !== item) curMap.set(id, item);
    for (const id of prevMap.keys()) if (!nextMap.has(id)) curMap.delete(id);
    (out as unknown as Record<string, unknown>)[c] = [...curMap.values()];
  }
  return out;
}

function schedulePush() {
  if (!client) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 300);
}

/** Aplica un cambio llegado de otro dispositivo, fila por fila. */
export function applyRemote(table: string, eventType: string, newRow: Record<string, unknown>, oldRow: Record<string, unknown>) {
  if (!lastSynced) return;
  applyingRemote = true;
  try {
    const st = usePlanner.getState();
    if (table === 'project') {
      if (eventType === 'DELETE') return;
      const { id: _id, ...rest } = objFrom<Record<string, unknown>>(newRow);
      const project = { ...st.project, ...rest } as PlannerData['project'];
      if (st.project === lastSynced.project) usePlanner.setState({ project });
      lastSynced = { ...lastSynced, project };
      return;
    }
    if (!(COLLECTIONS as string[]).includes(table)) return;
    const c = table as Collection;
    const replace = (list: { id: string }[], id: string, item: { id: string } | null) => {
      if (!item) return list.filter((x) => x.id !== id);
      if (list.some((x) => x.id === id)) return list.map((x) => (x.id === id ? item : x));
      return c === 'history' ? [item, ...list] : [...list, item];
    };
    if (eventType === 'DELETE') {
      const id = String(oldRow.id ?? '');
      usePlanner.setState({ [c]: replace(st[c] as { id: string }[], id, null) } as Partial<PlannerData>);
      lastSynced = { ...lastSynced, [c]: replace(lastSynced[c] as { id: string }[], id, null) } as PlannerData;
      return;
    }
    const item = normalizeRow(c, newRow);
    const local = (st[c] as { id: string }[]).find((x) => x.id === item.id);
    const synced = (lastSynced[c] as { id: string }[]).find((x) => x.id === item.id);
    const dirty = !!local && local !== synced; // edición local aún sin subir
    // El mismo objeto en el store y en lastSynced: así no se vuelve a subir (sin rebotes).
    if (!dirty) usePlanner.setState({ [c]: replace(st[c] as { id: string }[], item.id, item) } as Partial<PlannerData>);
    lastSynced = { ...lastSynced, [c]: replace(lastSynced[c] as { id: string }[], item.id, item) } as PlannerData;
  } finally {
    applyingRemote = false;
  }
}

/** Inicia la sincronización. `override` permite inyectar un cliente en las pruebas. */
export async function startSupabaseSync(override?: SupabaseClient) {
  if (client) return;
  if (override) client = override;
  else {
    if (!isSupabaseConfigured) return;
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url!, key!);
  }
  useSyncStatus.setState({ mode: 'supabase', ok: false, loaded: false, detail: 'Conectando con la base de datos del equipo…' });
  try {
    const remote = await fetchAll(client);
    if (remote) {
      applyingRemote = true;
      usePlanner.getState().replaceAll(remote);
      applyingRemote = false;
      lastSynced = selectData(usePlanner.getState());
    } else {
      // Base vacía: el primer dispositivo publica su estado como punto de partida.
      await pushDiff(client, null, selectData(usePlanner.getState()));
      lastSynced = selectData(usePlanner.getState());
    }
    setStatus(true, 'Conectado. Los cambios se guardan para todo el equipo en tiempo real.');
  } catch (e) {
    client = null;
    setStatus(false, `No se pudo conectar con la base del equipo (${(e as Error).message}). Trabajando sin conexión en este dispositivo.`);
    return;
  }

  usePlanner.subscribe(() => {
    if (!applyingRemote) schedulePush();
  });

  client
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload: { table: string; eventType: string; new: unknown; old: unknown }) =>
      applyRemote(payload.table, payload.eventType, (payload.new ?? {}) as Record<string, unknown>, (payload.old ?? {}) as Record<string, unknown>),
    )
    .subscribe();
}

/** Solo para pruebas: espera a que terminen las subidas pendientes. */
export async function __flushForTests() {
  if (timer) clearTimeout(timer);
  await flush();
}
