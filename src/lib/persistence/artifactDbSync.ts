// Sincronización con la base de datos compartida del artefacto (claude.ai).
// Cada entidad es un documento: members/<id>, sprints/<id>, tasks/<id>,
// meetings/<id>, milestones/<id>, history/<id> y meta/project.
// Las vistas siguen leyendo del store; aquí se replican los cambios en ambos sentidos.
import { usePlanner, selectData, sanitize } from '../../store/usePlanner';
import type { PlannerData } from '../../types';
import { claudeUse } from '../backend';
import { useSyncStatus } from './supabaseSync';
import { useUI } from '../../store/useUI';

type Collection = 'members' | 'sprints' | 'tasks' | 'meetings' | 'milestones' | 'history';
const COLLECTIONS: Collection[] = ['members', 'sprints', 'tasks', 'meetings', 'milestones', 'history'];

interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined; metadata: { fromCache: boolean } }
interface QuerySnap { docs: DocSnap[]; metadata: { fromCache: boolean } }
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (s: DocSnap) => void, err?: (e: { code: string; message: string }) => void): () => void;
}
interface CollRef { doc(id: string): DocRef; onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code: string; message: string }) => void): () => void }
interface DB { doc(path: string): DocRef; collection(path: string): CollRef }
interface UserCap { can(name: string): Promise<boolean | null> }

let db: DB | null = null;
let applyingRemote = false;
let lastSynced: PlannerData | null = null;
let readOnly = false;
const chains = new Map<string, Promise<void>>();

const setStatus = (patch: Partial<ReturnType<typeof useSyncStatus.getState>>) => useSyncStatus.setState({ mode: 'shared', ...patch });

/** Copia JSON limpia (sin undefined) para escribir. */
const plain = (o: unknown) => JSON.parse(JSON.stringify(o)) as Record<string, unknown>;

/** Escrituras en serie por documento (una a la vez), en paralelo entre documentos. */
function enqueue(path: string, op: () => Promise<void>) {
  const prev = chains.get(path) ?? Promise.resolve();
  const next = prev
    .then(op)
    .catch((e: { code?: string; message?: string }) => {
      if (e?.code === 'invalid_argument' && !readOnly) {
        readOnly = true;
        setStatus({ readOnly: true, detail: 'No tienes permiso para guardar cambios. Pide al propietario que te invite como Editor.' });
        useUI.getState().toast('Tus cambios no se guardaron: necesitas permiso de Editor', 'error');
      } else if (e?.code === 'quota_exceeded') {
        useUI.getState().toast('La base compartida está llena. Elimina adjuntos o historial antiguo.', 'error');
      } else if (e?.code !== 'invalid_argument') {
        setStatus({ ok: false, detail: `Error al guardar (${e?.code ?? 'desconocido'}). Revisa tu conexión.` });
      }
    })
    .finally(() => {
      if (chains.get(path) === next) chains.delete(path);
    });
  chains.set(path, next);
}

function pushDiff(prev: PlannerData, next: PlannerData) {
  if (!db || readOnly) return;
  if (prev.project !== next.project) {
    const body = plain(next.project);
    enqueue('meta/project', () => db!.doc('meta/project').set(body));
  }
  for (const c of COLLECTIONS) {
    const before = new Map((prev[c] as { id: string }[]).map((x) => [x.id, x]));
    const nowIds = new Set<string>();
    for (const item of next[c] as { id: string }[]) {
      nowIds.add(item.id);
      if (before.get(item.id) !== item) {
        const body = plain(item);
        enqueue(`${c}/${item.id}`, () => db!.collection(c).doc(item.id).set(body));
      }
    }
    for (const id of before.keys()) if (!nowIds.has(id)) enqueue(`${c}/${id}`, () => db!.collection(c).doc(id).delete());
  }
}

function applyRemote(patch: Partial<PlannerData>) {
  applyingRemote = true;
  try {
    usePlanner.setState(patch);
    lastSynced = selectData(usePlanner.getState());
  } finally {
    applyingRemote = false;
  }
}

export async function startArtifactSync() {
  setStatus({ ok: false, loaded: false, detail: 'Conectando con la base de datos compartida…' });
  const [database, user] = await Promise.all([claudeUse<DB>('db'), claudeUse<UserCap>('user')]);
  if (!database) {
    setStatus({ ok: false, loaded: true, readOnly: true, detail: 'La base compartida no está disponible. Inicia sesión en claude.ai y abre el enlace que te compartieron.' });
    return;
  }
  db = database;
  if (user && (await user.can('data.write')) === false) {
    readOnly = true;
    setStatus({ readOnly: true });
  }

  lastSynced = selectData(usePlanner.getState());
  const pending = new Set<string>(['meta', ...COLLECTIONS]);
  const settle = (key: string, fromCache: boolean) => {
    if (fromCache || !pending.has(key)) return;
    pending.delete(key);
    if (pending.size === 0) {
      clearTimeout(slow);
      setStatus({ ok: true, loaded: true, detail: readOnly ? 'Solo lectura: puedes ver el proyecto pero no modificarlo.' : 'Conectado. Los cambios se guardan para todo el equipo en tiempo real.' });
    }
  };
  const slow = setTimeout(() => {
    if (pending.size) setStatus({ ok: false, loaded: true, detail: 'La base compartida tarda en responder; lo que ves puede no estar actualizado.' });
  }, 10_000);
  const onError = (e: { code: string; message: string }) => {
    clearTimeout(slow);
    setStatus({ ok: false, loaded: true, detail: e.code === 'revoked' ? 'Se retiró tu acceso a este proyecto.' : `Se perdió la conexión con la base compartida (${e.code}). Recarga la página.` });
  };

  db.doc('meta/project').onSnapshot((snap) => {
    if (snap.exists) {
      const project = { ...usePlanner.getState().project, ...(snap.data() as object) } as PlannerData['project'];
      applyRemote({ project });
    }
    settle('meta', snap.metadata.fromCache);
  }, onError);

  for (const c of COLLECTIONS) {
    db.collection(c).onSnapshot((snap) => {
      let items = snap.docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as object), id: d.id }));
      if (c === 'history') items.sort((a, b) => String((b as { at?: string }).at).localeCompare(String((a as { at?: string }).at)));
      else items.sort((a, b) => String((a as { createdAt?: string }).createdAt ?? '').localeCompare(String((b as { createdAt?: string }).createdAt ?? '')));
      // Conserva la identidad de los objetos que no cambiaron (evita reescrituras).
      const current = new Map((usePlanner.getState()[c] as { id: string }[]).map((x) => [x.id, x]));
      items = items.map((it) => {
        const cur = current.get(it.id);
        return cur && JSON.stringify(cur) === JSON.stringify(it) ? cur : it;
      });
      const clean = sanitize({ ...selectData(usePlanner.getState()), [c]: items })[c];
      applyRemote({ [c]: clean } as Partial<PlannerData>);
      settle(c, snap.metadata.fromCache);
    }, onError);
  }

  usePlanner.subscribe((state) => {
    if (applyingRemote || !lastSynced) return;
    const next = selectData(state);
    const prev = lastSynced;
    lastSynced = next;
    pushDiff(prev, next);
  });
}
