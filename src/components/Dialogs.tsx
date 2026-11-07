import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, Plus, Trash2, ArrowRightCircle, ListPlus } from 'lucide-react';
import { usePlanner, type NewTask } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { hasErrors, validateMeeting, validateTask, type Errors } from '../lib/validation';
import { todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import type { ActionItem, Meeting, Task } from '../types';
import { Avatar, Button, Field, Input, Modal, Select, Textarea, cx } from './ui';

export function ConfirmDialog() {
  const req = useUI((s) => s.confirmReq);
  const resolve = useUI((s) => s.resolveConfirm);
  if (!req) return null;
  return (
    <Modal open onClose={() => resolve(false)} title={req.title} size="sm"
      footer={<><Button onClick={() => resolve(false)}>Cancelar</Button><Button variant={req.danger ? 'danger' : 'primary'} onClick={() => resolve(true)} autoFocus>{req.confirmLabel ?? 'Confirmar'}</Button></>}>
      <div className="flex gap-3">
        {req.danger && <div className="h-fit rounded-full bg-red-50 p-2 text-red-600"><AlertTriangle size={18} /></div>}
        <p className="text-sm text-slate-600">{req.message}</p>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => dismiss(t.id)} className="pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-lg animate-fade-in">
          {t.kind === 'success' ? <CheckCircle2 size={17} className="mt-px text-brand-600" /> : t.kind === 'error' ? <XCircle size={17} className="mt-px text-red-600" /> : <Info size={17} className="mt-px text-brand-600" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Nueva actividad ----------
export function NewTaskModal() {
  const defaults = useUI((s) => s.newTask);
  const close = useUI((s) => s.closeNewTask);
  const members = usePlanner((s) => s.members);
  const sprints = usePlanner((s) => s.sprints);
  const blank = (): NewTask => ({ title: '', description: '', priority: 'medium', status: 'pending', assigneeId: null, sprintId: sprints.find((s) => s.status === 'active')?.id ?? null, startDate: todayISO(), dueDate: null, phase: '' });
  const [form, setForm] = useState<NewTask>(blank);
  const [errors, setErrors] = useState<Errors<Task>>({});

  useEffect(() => {
    if (defaults) {
      setForm({ ...blank(), ...defaults });
      setErrors({});
    }
  }, [defaults]);

  if (!defaults) return null;
  const set = (patch: Partial<NewTask>) => setForm((f) => ({ ...f, ...patch }));

  const submit = (openAfter: boolean) => {
    const e = validateTask(form);
    setErrors(e);
    if (hasErrors(e)) return;
    const t = usePlanner.getState().addTask(form);
    useUI.getState().toast('Actividad creada');
    close();
    if (openAfter) useUI.getState().openTask(t.id);
  };

  return (
    <Modal open onClose={close} title="Nueva actividad"
      footer={<><Button onClick={close}>Cancelar</Button><Button onClick={() => submit(true)}>Crear y abrir detalle</Button><Button variant="primary" onClick={() => submit(false)}>Crear actividad</Button></>}>
      <form className="grid grid-cols-1 gap-3.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <Field label="Nombre de la actividad *" error={errors.title} className="sm:col-span-2">
          <Input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} invalid={!!errors.title} placeholder="Ej. Medir tiempos de setup" maxLength={120} />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <Textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Detalle, alcance, criterios de aceptación…" />
        </Field>
        <Field label="Responsable">
          <Select value={form.assigneeId ?? ''} onChange={(e) => set({ assigneeId: e.target.value || null })}>
            <option value="">Sin asignar</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Sprint">
          <Select value={form.sprintId ?? ''} onChange={(e) => set({ sprintId: e.target.value || null })}>
            <option value="">Backlog (sin sprint)</option>
            {[...sprints].sort((a, b) => a.number - b.number).map((s) => <option key={s.id} value={s.id}>Sprint {s.number} · {s.name}</option>)}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set({ status: e.target.value as Task['status'] })}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
        </Field>
        <Field label="Prioridad">
          <Select value={form.priority} onChange={(e) => set({ priority: e.target.value as Task['priority'] })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].emoji} {PRIORITY_META[p].label}</option>)}
          </Select>
        </Field>
        <Field label="Fecha de inicio">
          <Input type="date" value={form.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || null })} />
        </Field>
        <Field label="Fecha límite" error={errors.dueDate}>
          <Input type="date" value={form.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} invalid={!!errors.dueDate} />
        </Field>
        <Field label="Fase / etapa" className="sm:col-span-2">
          <Input value={form.phase} onChange={(e) => set({ phase: e.target.value })} placeholder="Ej. Diagnóstico, Propuesta, Entrega…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------- Reunión (crear / editar) ----------
type MeetingForm = Omit<Meeting, 'id' | 'createdAt'>;

export function MeetingModal() {
  const editor = useUI((s) => s.meetingEditor);
  const close = useUI((s) => s.closeMeeting);
  const members = usePlanner((s) => s.members);
  const sprints = usePlanner((s) => s.sprints);
  const existing = usePlanner((s) => s.meetings.find((m) => m.id === editor?.id));
  const tasks = usePlanner((s) => s.tasks);
  const [form, setForm] = useState<MeetingForm | null>(null);
  const [errors, setErrors] = useState<Errors<Meeting>>({});
  const [item, setItem] = useState('');

  useEffect(() => {
    if (!editor) return setForm(null);
    setErrors({});
    if (existing) {
      const { id: _id, createdAt: _c, ...rest } = existing;
      setForm(rest);
    } else {
      setForm({ title: '', date: editor.date ?? todayISO(), time: '10:00', durationMin: 60, participantIds: members.map((m) => m.id), objective: '', agenda: '', agreements: '', actionItems: [], sprintId: sprints.find((s) => s.status === 'active')?.id ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor?.id, editor?.date, !!editor]);

  // Mantener sincronizados los vínculos de acuerdos → tareas creadas
  useEffect(() => {
    if (existing && form) setForm((f) => f && { ...f, actionItems: f.actionItems.map((a) => ({ ...a, taskId: existing.actionItems.find((x) => x.id === a.id)?.taskId ?? a.taskId })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.actionItems]);

  if (!editor || !form) return null;
  const set = (patch: Partial<MeetingForm>) => setForm((f) => f && { ...f, ...patch });
  const setItemPatch = (id: string, patch: Partial<ActionItem>) => set({ actionItems: form.actionItems.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const { toast, confirm } = useUI.getState();
  const store = usePlanner.getState();

  const save = (): string | null => {
    const e = validateMeeting(form);
    setErrors(e);
    if (hasErrors(e)) return null;
    if (existing) {
      store.updateMeeting(existing.id, form);
      return existing.id;
    }
    const m = store.addMeeting(form);
    useUI.getState().openMeeting(m.id); // seguir editando la reunión ya creada
    return m.id;
  };

  const createTaskFrom = (itemId: string) => {
    const id = save();
    if (!id) return;
    const t = usePlanner.getState().createTaskFromActionItem(id, itemId);
    if (t) toast(`Tarea creada: “${t.title}”`);
  };

  const convert = () => {
    const id = save();
    if (!id) return;
    const t = usePlanner.getState().convertMeetingToTask(id);
    if (t) {
      toast('Reunión convertida en actividad');
      close();
      useUI.getState().openTask(t.id);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: 'Eliminar reunión', message: `Se eliminará “${existing.title}”. Las tareas derivadas se conservarán.`, confirmLabel: 'Eliminar', danger: true })) {
      store.deleteMeeting(existing.id);
      toast('Reunión eliminada');
      close();
    }
  };

  return (
    <Modal open size="lg" onClose={close} title={existing ? 'Editar reunión' : 'Nueva reunión'}
      footer={
        <>
          {existing && <Button variant="ghost" onClick={remove} className="mr-auto !text-red-600"><Trash2 size={15} /> Eliminar</Button>}
          {existing && <Button onClick={convert}><ArrowRightCircle size={15} /> Convertir en actividad</Button>}
          <Button onClick={close}>Cerrar</Button>
          <Button variant="primary" onClick={() => { if (save()) { toast(existing ? 'Reunión guardada' : 'Reunión programada'); close(); } }}>Guardar</Button>
        </>
      }>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-6">
        <Field label="Nombre *" error={errors.title} className="sm:col-span-6">
          <Input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} invalid={!!errors.title} placeholder="Ej. Sprint review" />
        </Field>
        <Field label="Fecha *" error={errors.date} className="sm:col-span-2"><Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} invalid={!!errors.date} /></Field>
        <Field label="Hora *" error={errors.time} className="sm:col-span-2"><Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} invalid={!!errors.time} /></Field>
        <Field label="Duración (min)" error={errors.durationMin} className="sm:col-span-2"><Input type="number" min={5} max={600} step={5} value={form.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} /></Field>
        <Field label="Participantes" className="sm:col-span-4">
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = form.participantIds.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => set({ participantIds: on ? form.participantIds.filter((x) => x !== m.id) : [...form.participantIds, m.id] })}
                  className={cx('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs ring-1', on ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'text-slate-500 ring-slate-200 hover:bg-slate-50')}>
                  <Avatar member={m} size={18} /> {m.name}
                </button>
              );
            })}
            {members.length === 0 && <span className="text-xs text-slate-400">No hay integrantes registrados.</span>}
          </div>
        </Field>
        <Field label="Sprint relacionado" className="sm:col-span-2">
          <Select value={form.sprintId ?? ''} onChange={(e) => set({ sprintId: e.target.value || null })}>
            <option value="">Ninguno</option>
            {[...sprints].sort((a, b) => a.number - b.number).map((s) => <option key={s.id} value={s.id}>Sprint {s.number}</option>)}
          </Select>
        </Field>
        <Field label="Objetivo de la reunión" className="sm:col-span-6"><Input value={form.objective} onChange={(e) => set({ objective: e.target.value })} /></Field>
        <Field label="Agenda" className="sm:col-span-3"><Textarea rows={4} value={form.agenda} onChange={(e) => set({ agenda: e.target.value })} placeholder={'1. …\n2. …'} /></Field>
        <Field label="Acuerdos" className="sm:col-span-3"><Textarea rows={4} value={form.agreements} onChange={(e) => set({ agreements: e.target.value })} /></Field>

        <div className="sm:col-span-6">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Tareas pendientes derivadas</span>
          <ul className="space-y-1.5">
            {form.actionItems.map((a) => {
              const linked = tasks.find((t) => t.id === a.taskId);
              return (
                <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2 sm:flex-row sm:items-center">
                  <Input value={a.text} onChange={(e) => setItemPatch(a.id, { text: e.target.value })} className="flex-1" />
                  <Select value={a.assigneeId ?? ''} onChange={(e) => setItemPatch(a.id, { assigneeId: e.target.value || null })} className="sm:!w-40">
                    <option value="">Sin asignar</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  {linked ? (
                    <Button size="sm" variant="ghost" onClick={() => { close(); useUI.getState().openTask(linked.id); }} className="!text-brand-700"><CheckCircle2 size={14} /> Ver tarea</Button>
                  ) : (
                    <Button size="sm" onClick={() => createTaskFrom(a.id)} disabled={!a.text.trim()}><ListPlus size={14} /> Crear tarea</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => set({ actionItems: form.actionItems.filter((x) => x.id !== a.id) })} aria-label="Quitar"><Trash2 size={14} /></Button>
                </li>
              );
            })}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (item.trim()) { set({ actionItems: [...form.actionItems, { id: uid(), text: item.trim(), assigneeId: null, taskId: null }] }); setItem(''); } }}>
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Añadir tarea derivada de la reunión…" />
            <Button type="submit" disabled={!item.trim()}><Plus size={15} /></Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
