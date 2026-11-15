import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePlanner } from '../store/usePlanner';
import { startSupabaseSync, __flushForTests, useSyncStatus } from '../lib/persistence/supabaseSync';

type Row = Record<string, unknown>;
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

/** Supabase en memoria: tablas, upsert/delete y eventos Realtime (incluye el eco propio). */
function mockSupabase() {
  const tables = new Map<string, Map<string, Row>>();
  const t = (n: string) => tables.get(n) ?? tables.set(n, new Map()).get(n)!;
  const listeners: ((p: Row) => void)[] = [];
  let writes = 0;
  const emit = (table: string, eventType: string, row: Row) =>
    setTimeout(() => listeners.forEach((l) => l({ table, eventType, new: eventType === 'DELETE' ? {} : JSON.parse(JSON.stringify(row)), old: { id: row.id } })), 0);
  const client = {
    from(table: string) {
      const rows = () => [...t(table).values()].map((r) => JSON.parse(JSON.stringify(r)));
      const result = () => Promise.resolve({ data: rows(), error: null });
      return {
        select: () => ({
          eq: (_c: string, v: unknown) => ({ maybeSingle: () => Promise.resolve({ data: t(table).get(String(v)) ?? null, error: null }) }),
          order: () => ({ limit: () => result() }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => result().then(res, rej),
        }),
        upsert: (input: Row | Row[]) => {
          for (const r of Array.isArray(input) ? input : [input]) { writes++; t(table).set(String(r.id), r); emit(table, 'UPDATE', r); }
          return Promise.resolve({ error: null });
        },
        delete: () => ({
          in: (_c: string, ids: string[]) => { for (const id of ids) { t(table).delete(id); emit(table, 'DELETE', { id }); } return Promise.resolve({ error: null }); },
        }),
      };
    },
    channel: () => ({ on: (_e: string, _f: unknown, cb: (p: Row) => void) => { listeners.push(cb); return { subscribe: () => undefined }; } }),
  };
  return {
    client: client as unknown as SupabaseClient,
    tables,
    writes: () => writes,
    /** Otro integrante cambia una fila. */
    remoteUpsert: (table: string, row: Row) => { t(table).set(String(row.id), row); emit(table, 'UPDATE', row); },
    remoteDelete: (table: string, id: string) => { t(table).delete(id); emit(table, 'DELETE', { id }); },
  };
}

describe('sincronización con Supabase', () => {
  it('sube el estado inicial, sincroniza en ambos sentidos y no rebota', async () => {
    usePlanner.getState().loadDemo();
    const db = mockSupabase();
    await startSupabaseSync(db.client);
    expect(useSyncStatus.getState().loaded).toBe(true);
    expect(useSyncStatus.getState().ok).toBe(true);

    // 1) Base vacía: el primer dispositivo publica el proyecto con el equipo
    expect(db.tables.get('project')!.get('main')).toBeTruthy();
    const names = [...db.tables.get('members')!.values()].map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(['Jhon', 'Youssef', 'Mauricio', 'Gabriela', 'Ashley']));
    expect(db.tables.get('tasks')!.size).toBe(usePlanner.getState().tasks.length);
    await tick();

    // 2) Cambio local → se sube con nombres de columna en snake_case
    const task = usePlanner.getState().tasks.find((x) => x.status !== 'done')!;
    usePlanner.getState().setTaskStatus(task.id, 'done');
    await __flushForTests();
    const row = db.tables.get('tasks')!.get(task.id)!;
    expect(row.status).toBe('done');
    expect(row.completed_at).toBeTruthy();
    expect(row).toHaveProperty('assignee_id');

    // 3) El eco del propio cambio no provoca nuevas escrituras (sin bucle)
    const before = db.writes();
    await tick(50);
    await __flushForTests();
    expect(db.writes()).toBe(before);

    // 4) Cambio de otro integrante → aparece aquí
    const other = usePlanner.getState().tasks.find((x) => x.id !== task.id)!;
    db.remoteUpsert('tasks', { ...db.tables.get('tasks')!.get(other.id)!, title: 'Editado por Gabriela' });
    await tick();
    expect(usePlanner.getState().tasks.find((x) => x.id === other.id)!.title).toBe('Editado por Gabriela');
    await __flushForTests();
    expect(db.writes()).toBe(before); // aplicar un cambio remoto no lo vuelve a subir

    // 5) Edición local sin subir + eco atrasado: no se pierde la edición
    usePlanner.getState().updateTask(other.id, { title: 'Mi edición' });
    db.remoteUpsert('tasks', { ...db.tables.get('tasks')!.get(other.id)! }); // versión anterior
    await tick();
    expect(usePlanner.getState().tasks.find((x) => x.id === other.id)!.title).toBe('Mi edición');
    await __flushForTests();
    expect(db.tables.get('tasks')!.get(other.id)!.title).toBe('Mi edición');

    // 6) Borrado remoto y local
    db.remoteDelete('tasks', other.id);
    await tick();
    expect(usePlanner.getState().tasks.some((x) => x.id === other.id)).toBe(false);
    usePlanner.getState().deleteTask(task.id);
    await __flushForTests();
    expect(db.tables.get('tasks')!.has(task.id)).toBe(false);

    // 7) Renombrar a un integrante se refleja en la base
    const y = usePlanner.getState().members.find((m) => m.name === 'Youssef')!;
    usePlanner.getState().updateMember(y.id, { role: 'Alcance' });
    await __flushForTests();
    expect(db.tables.get('members')!.get(y.id)!.role).toBe('Alcance');
  });
});
