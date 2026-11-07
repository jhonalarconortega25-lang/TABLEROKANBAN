import { useEffect, useState } from 'react';
import { Download, Upload, RotateCcw, Eraser, Database, History, Cloud, CloudOff } from 'lucide-react';
import { usePlanner, selectData, sanitize } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useSyncStatus, isSupabaseConfigured } from '../lib/persistence/supabaseSync';
import { hasErrors, validateProject, type Errors } from '../lib/validation';
import { fmtDateTime, todayISO } from '../lib/dates';
import type { EntityKind, Project } from '../types';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea, cx } from '../components/ui';

const ENTITY_LABEL: Record<EntityKind, string> = { task: 'Actividad', sprint: 'Sprint', meeting: 'Reunión', member: 'Equipo', milestone: 'Hito', project: 'Proyecto' };

export default function Settings() {
  const project = usePlanner((s) => s.project);
  const history = usePlanner((s) => s.history);
  const sync = useSyncStatus();
  const [form, setForm] = useState<Project>(project);
  const [errors, setErrors] = useState<Errors<Project>>({});
  const [entity, setEntity] = useState<'' | EntityKind>('');
  useEffect(() => setForm(project), [project]);
  const { toast, confirm } = useUI.getState();
  const st = usePlanner.getState();
  const dirty = JSON.stringify(form) !== JSON.stringify(project);

  const save = () => {
    const e = validateProject(form);
    setErrors(e);
    if (hasErrors(e)) return;
    st.updateProject({ ...form, name: form.name.trim() });
    toast('Proyecto actualizado');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(selectData(usePlanner.getState()), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project-planner-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Copia de seguridad descargada');
  };

  const importJson = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(String(r.result));
        if (!parsed || !Array.isArray(parsed.tasks) || !parsed.project) throw new Error('Formato no reconocido');
        const data = sanitize(parsed);
        if (await confirm({ title: 'Importar datos', message: `Se reemplazarán los datos actuales por ${data.tasks.length} actividades, ${data.sprints.length} sprints y ${data.members.length} integrantes del archivo.`, confirmLabel: 'Importar', danger: true })) {
          st.importData(data);
          toast('Datos importados');
        }
      } catch (e) {
        toast(`No se pudo importar: ${(e as Error).message}`, 'error');
      }
    };
    r.readAsText(f);
  };

  const filtered = history.filter((h) => !entity || h.entity === entity);

  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" subtitle="Datos del proyecto, cálculo de avance, copias de seguridad e historial." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Proyecto" />
          <form className="grid grid-cols-2 gap-3.5 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Nombre del proyecto *" error={errors.name} className="col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} /></Field>
            <Field label="Descripción" className="col-span-2"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Fecha de inicio *" error={errors.startDate}><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Fecha estimada de fin *" error={errors.endDate}><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} invalid={!!errors.endDate} /></Field>
            <div className="col-span-2 flex justify-end gap-2">
              {dirty && <Button onClick={() => setForm(project)}>Descartar</Button>}
              <Button type="submit" variant="primary" disabled={!dirty}>Guardar cambios</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Cálculo del avance" subtitle="Cómo se pondera cada actividad" />
            <div className="space-y-2 px-5 pb-5">
              {([['equal', 'Pesos iguales (recomendado)', 'Avance = completadas / total × 100. Todas las actividades valen lo mismo.'], ['weighted', 'Ponderado por complejidad (beta)', 'Cada actividad tiene un peso 1–5 editable en su detalle. Avance = Σ peso completadas / Σ peso total.']] as const).map(([v, l, d]) => (
                <label key={v} className={cx('flex cursor-pointer gap-3 rounded-lg border p-3', project.weightingMode === v ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50')}>
                  <input type="radio" name="weighting" checked={project.weightingMode === v} onChange={() => { st.updateProject({ weightingMode: v }); toast('Método de cálculo actualizado'); }} className="mt-0.5 accent-blue-600" />
                  <span><span className="block text-sm font-medium text-slate-800">{l}</span><span className="text-xs text-slate-500">{d}</span></span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Almacenamiento y sincronización" />
            <div className="px-5 pb-5 text-sm">
              <p className="flex items-center gap-2 font-medium text-slate-800">
                {sync.mode === 'supabase' ? <Cloud size={16} className={sync.ok ? 'text-emerald-600' : 'text-amber-600'} /> : <CloudOff size={16} className="text-slate-400" />}
                {sync.mode === 'supabase' ? 'Supabase (multiusuario, tiempo real)' : 'Local (este navegador)'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{sync.detail}</p>
              {!isSupabaseConfigured && (
                <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                  Cada cambio se guarda automáticamente y se mantiene al cerrar el navegador. Para compartir los datos entre todo el equipo en tiempo real, ejecuta <code className="rounded bg-white px-1">supabase/schema.sql</code> en tu proyecto Supabase y define <code className="rounded bg-white px-1">VITE_SUPABASE_URL</code> y <code className="rounded bg-white px-1">VITE_SUPABASE_ANON_KEY</code> (ver README).
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title={<span className="flex items-center gap-1.5"><Database size={15} /> Datos</span>} subtitle="Copias de seguridad y datos de prueba" />
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <Button onClick={exportJson}><Download size={15} /> Exportar copia (JSON)</Button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
            <Upload size={15} /> Importar copia
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <Button onClick={async () => { if (await confirm({ title: 'Cargar datos de ejemplo', message: 'Se reemplazarán TODOS los datos actuales por el proyecto de ejemplo. Exporta una copia antes si la necesitas.', confirmLabel: 'Cargar ejemplo', danger: true })) { st.loadDemo(); toast('Datos de ejemplo cargados'); } }}>
            <RotateCcw size={15} /> Restaurar datos de ejemplo
          </Button>
          <Button variant="danger" onClick={async () => { if (await confirm({ title: 'Empezar desde cero', message: 'Se eliminarán todas las actividades, sprints, reuniones, integrantes e hitos. Esta acción no se puede deshacer.', confirmLabel: 'Borrar todo', danger: true })) { st.clearAll(); toast('Proyecto vacío listo para usar'); } }}>
            <Eraser size={15} /> Borrar todo y empezar de cero
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-1.5"><History size={15} /> Historial de cambios</span>} subtitle={`${history.length} registros (máx. 500)`}
          action={<div className="flex gap-2">
            <Select className="!h-8 !w-auto text-xs" value={entity} onChange={(e) => setEntity(e.target.value as '' | EntityKind)}>
              <option value="">Todo</option>
              {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: 'Vaciar historial', message: '¿Eliminar todos los registros del historial?', confirmLabel: 'Vaciar', danger: true })) st.clearHistory(); }}>Vaciar</Button>
          </div>} />
        <ul className="max-h-[420px] divide-y divide-slate-50 overflow-y-auto px-5 pb-4">
          {filtered.slice(0, 200).map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-slate-600">{ENTITY_LABEL[h.entity]}</span>
              <span className="min-w-0 flex-1 text-slate-700">{h.summary}</span>
              <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(h.at)}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="py-4 text-center text-xs text-slate-400">Sin registros.</li>}
        </ul>
      </Card>
    </div>
  );
}
