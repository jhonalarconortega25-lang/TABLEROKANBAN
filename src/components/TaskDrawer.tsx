import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Link2, Paperclip, Plus, RotateCcw, Send, Trash2, X, CalendarClock, History } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useToday } from '../hooks/useData';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { checklistProgress, isOverdue } from '../lib/metrics';
import { fmtDate, fmtDateTime, relativeDays } from '../lib/dates';
import type { Task } from '../types';
import { IS_ARTIFACT } from '../lib/backend';
import { Avatar, Button, IconButton, Input, PriorityBadge, ProgressBar, Select, StatusBadge, Textarea, cx } from './ui';

const MAX_FILE = 750 * 1024; // límite para guardar archivos dentro del navegador

/** Texto editable que guarda al salir del campo (autoguardado). */
function InlineText({ value, onCommit, multiline, placeholder, className, required }: { value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string; className?: string; required?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (required && !v.trim()) return setV(value);
    if (v !== value) onCommit(v);
  };
  return multiline ? (
    <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} rows={4} className={className} />
  ) : (
    <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={placeholder} className={className} maxLength={120} />
  );
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-1.5">
    <span className="text-xs font-medium text-slate-500">{label}</span>
    <div className="min-w-0">{children}</div>
  </div>
);

export function TaskDrawer() {
  const openTaskId = useUI((s) => s.openTaskId);
  const close = () => useUI.getState().openTask(null);
  const task = usePlanner((s) => s.tasks.find((t) => t.id === openTaskId));

  useEffect(() => {
    if (!openTaskId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useUI.getState().confirmReq && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openTaskId]);

  // Si la tarea se elimina, cerrar el panel
  useEffect(() => {
    if (openTaskId && !task) close();
  }, [openTaskId, task]);

  if (!task) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 animate-fade-in" onClick={close} />
      <aside className="relative flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl animate-slide-in" aria-label="Detalle de actividad">
        <TaskDetail task={task} onClose={close} />
      </aside>
    </div>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const p = usePlanner.getState();
  const members = usePlanner((s) => s.members);
  const sprints = usePlanner((s) => s.sprints);
  const meetings = usePlanner((s) => s.meetings);
  const weighting = usePlanner((s) => s.project.weightingMode);
  const allHistory = usePlanner((s) => s.history);
  const history = useMemo(() => allHistory.filter((h) => h.entityId === task.id).slice(0, 15), [allHistory, task.id]);
  const { toast, confirm } = useUI.getState();
  const today = useToday();

  const [newItem, setNewItem] = useState('');
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState<string>(task.assigneeId ?? members[0]?.id ?? '');
  const [link, setLink] = useState('');
  const [tab, setTab] = useState<'comments' | 'history'>('comments');

  const update = (patch: Partial<Task>) => p.updateTask(task.id, patch);
  const cp = checklistProgress(task);
  const overdue = isOverdue(task, today);
  const meeting = meetings.find((m) => m.id === task.meetingId);
  const memberById = (id: string | null) => members.find((m) => m.id === id);

  const toggleDone = () => {
    const done = task.status !== 'done';
    update({ status: done ? 'done' : 'in_progress' });
    toast(done ? 'Actividad completada · avance actualizado' : 'Actividad reabierta');
  };

  const remove = async () => {
    if (await confirm({ title: 'Eliminar actividad', message: `Se eliminará “${task.title}” con su checklist, comentarios y adjuntos. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })) {
      p.deleteTask(task.id);
      toast('Actividad eliminada');
      onClose();
    }
  };

  const onFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE) return toast(`“${f.name}” supera 750 KB. Adjunta un enlace (Drive, OneDrive…) en su lugar.`, 'error');
    const r = new FileReader();
    r.onload = () => {
      p.addAttachment(task.id, { name: f.name, url: String(r.result), size: f.size, mime: f.type });
      toast('Archivo adjuntado');
    };
    r.onerror = () => toast('No se pudo leer el archivo', 'error');
    r.readAsDataURL(f);
  };

  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      p.addAttachment(task.id, { name: u.hostname + u.pathname.replace(/\/$/, ''), url: u.toString() });
      setLink('');
    } catch {
      toast('Enlace no válido', 'error');
    }
  };

  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {overdue && <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Atrasada</span>}
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Duplicar" onClick={() => { const c = p.duplicateTask(task.id); if (c) { useUI.getState().openTask(c.id); toast('Actividad duplicada'); } }}><Copy size={16} /></IconButton>
          <IconButton label="Eliminar" onClick={remove} className="hover:!bg-red-50 hover:!text-red-600"><Trash2 size={16} /></IconButton>
          <IconButton label="Cerrar" onClick={onClose}><X size={18} /></IconButton>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <InlineText value={task.title} onCommit={(v) => update({ title: v.trim() })} required className="!h-auto !border-transparent !px-2 -mx-2 py-1 !text-lg font-semibold hover:!border-slate-200" />

        <div className="mt-3">
          <Button variant={task.status === 'done' ? 'secondary' : 'primary'} onClick={toggleDone}>
            {task.status === 'done' ? <><RotateCcw size={15} /> Reabrir actividad</> : <><CheckCircle2 size={15} /> Marcar como completada</>}
          </Button>
          {task.completedAt && <span className="ml-3 text-xs text-slate-500">Completada el {fmtDateTime(task.completedAt)}</span>}
        </div>

        <section className="mt-4 divide-y divide-slate-50 rounded-xl border border-slate-100 px-4 py-2">
          <Row label="Estado">
            <Select value={task.status} onChange={(e) => update({ status: e.target.value as Task['status'] })}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
          </Row>
          <Row label="Responsable">
            <div className="flex items-center gap-2">
              <Avatar member={memberById(task.assigneeId)} size={26} />
              <Select value={task.assigneeId ?? ''} onChange={(e) => update({ assigneeId: e.target.value || null, collaboratorIds: task.collaboratorIds.filter((c) => c !== e.target.value) })}>
                <option value="">Sin asignar</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
          </Row>
          <Row label="Colaboradores">
            <div className="flex flex-wrap gap-1.5">
              {members.filter((m) => m.id !== task.assigneeId).map((m) => {
                const on = task.collaboratorIds.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => update({ collaboratorIds: on ? task.collaboratorIds.filter((c) => c !== m.id) : [...task.collaboratorIds, m.id] })}
                    className={cx('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs ring-1 transition-colors', on ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'text-slate-500 ring-slate-200 hover:bg-slate-50')}>
                    <Avatar member={m} size={18} /> {m.name}
                  </button>
                );
              })}
              {members.length <= 1 && <span className="text-xs text-slate-400">Agrega integrantes en Equipo</span>}
            </div>
          </Row>
          <Row label="Prioridad">
            <div className="flex gap-1.5">
              {PRIORITIES.map((pr) => (
                <button key={pr} type="button" onClick={() => update({ priority: pr })}
                  className={cx('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition-colors', task.priority === pr ? PRIORITY_META[pr].badge + ' ring-2' : 'text-slate-500 ring-slate-200 hover:bg-slate-50')}>
                  {PRIORITY_META[pr].emoji} {PRIORITY_META[pr].label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Fechas">
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={task.startDate ?? ''} max={task.dueDate ?? undefined} onChange={(e) => update({ startDate: e.target.value || null })} className="!w-auto" aria-label="Fecha de inicio" />
              <span className="text-slate-400">→</span>
              <Input type="date" value={task.dueDate ?? ''} min={task.startDate ?? undefined} invalid={overdue}
                onChange={(e) => { const v = e.target.value || null; if (v && task.startDate && v < task.startDate) return toast('La fecha límite no puede ser anterior al inicio', 'error'); update({ dueDate: v }); }}
                className="!w-auto" aria-label="Fecha límite" />
              {task.dueDate && task.status !== 'done' && <span className={cx('text-xs', overdue ? 'font-medium text-red-600' : 'text-slate-500')}>{relativeDays(task.dueDate, today)}</span>}
            </div>
          </Row>
          <Row label="Sprint">
            <Select value={task.sprintId ?? ''} onChange={(e) => update({ sprintId: e.target.value || null })}>
              <option value="">Backlog (sin sprint)</option>
              {[...sprints].sort((a, b) => a.number - b.number).map((s) => <option key={s.id} value={s.id}>Sprint {s.number} · {s.name}</option>)}
            </Select>
          </Row>
          <Row label="Fase / etapa">
            <InlineText value={task.phase} onCommit={(v) => update({ phase: v.trim() })} placeholder="Ej. Diagnóstico, Propuesta…" />
          </Row>
          {weighting === 'weighted' && (
            <Row label="Complejidad">
              <Select value={task.weight} onChange={(e) => update({ weight: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
              </Select>
            </Row>
          )}
          {meeting && (
            <Row label="Origen">
              <button type="button" onClick={() => useUI.getState().openMeeting(meeting.id)} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                <CalendarClock size={13} /> Reunión: {meeting.title} ({fmtDate(meeting.date)})
              </button>
            </Row>
          )}
        </section>

        <section className="mt-5">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</h4>
          <InlineText multiline value={task.description} onCommit={(v) => update({ description: v })} placeholder="Describe el alcance, criterios de aceptación, notas…" />
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist {task.checklist.length > 0 && `· ${task.checklist.filter((c) => c.done).length}/${task.checklist.length}`}</h4>
            {cp !== null && <span className="text-xs font-medium text-slate-600">{cp}%</span>}
          </div>
          {cp !== null && <ProgressBar value={cp} className="mb-2" />}
          <ul className="space-y-0.5">
            {task.checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                <input type="checkbox" checked={c.done} onChange={(e) => p.updateChecklistItem(task.id, c.id, { done: e.target.checked })} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 accent-brand-600" />
                <ChecklistText text={c.text} done={c.done} onCommit={(text) => p.updateChecklistItem(task.id, c.id, { text })} />
                <IconButton label="Eliminar subtarea" onClick={() => p.removeChecklistItem(task.id, c.id)} className="!h-6 !w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"><X size={14} /></IconButton>
              </li>
            ))}
          </ul>
          <form className="mt-1.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); p.addChecklistItem(task.id, newItem); setNewItem(''); }}>
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Añadir subtarea…" maxLength={200} />
            <Button type="submit" disabled={!newItem.trim()}><Plus size={15} /></Button>
          </form>
        </section>

        <section className="mt-5">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Archivos adjuntos</h4>
          <ul className="space-y-1">
            {task.attachments.map((a) => (
              <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-sm">
                {a.url.startsWith('data:') ? <FileText size={15} className="text-slate-400" /> : <Link2 size={15} className="text-slate-400" />}
                <a href={a.url} target="_blank" rel="noreferrer" download={a.url.startsWith('data:') ? a.name : undefined} className="min-w-0 flex-1 truncate text-brand-700 hover:underline">{a.name}</a>
                {a.size && <span className="text-xs text-slate-400">{Math.ceil(a.size / 1024)} KB</span>}
                <ExternalLink size={13} className="text-slate-300" />
                <IconButton label="Quitar adjunto" onClick={() => p.removeAttachment(task.id, a.id)} className="!h-6 !w-6"><X size={14} /></IconButton>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            {!IS_ARTIFACT && (
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                <Paperclip size={15} /> Subir archivo
                <input type="file" className="sr-only" onChange={(e) => { onFile(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); addLink(); }}>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={IS_ARTIFACT ? "Pega un enlace (Drive, OneDrive, Docs…)" : "o pega un enlace (Drive, Docs…)"} />
              <Button type="submit" disabled={!link.trim()}>Añadir</Button>
            </form>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex gap-4 border-b border-slate-100 text-sm">
            {(['comments', 'history'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-2 font-medium', tab === t ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                {t === 'comments' ? `Comentarios (${task.comments.length})` : 'Historial'}
              </button>
            ))}
          </div>
          {tab === 'comments' ? (
            <>
              <ul className="space-y-3">
                {task.comments.map((c) => (
                  <li key={c.id} className="group flex gap-2.5">
                    <Avatar member={memberById(c.authorId)} size={28} />
                    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-700">{memberById(c.authorId)?.name ?? 'Anónimo'}</span>
                        <span className="text-slate-400">{fmtDateTime(c.createdAt)}</span>
                        <button type="button" onClick={() => p.removeComment(task.id, c.id)} className="ml-auto text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100">Eliminar</button>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.text}</p>
                    </div>
                  </li>
                ))}
                {task.comments.length === 0 && <li className="text-xs text-slate-400">Sin comentarios todavía.</li>}
              </ul>
              <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); p.addComment(task.id, comment, author || null); setComment(''); }}>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Escribe un comentario u observación…" maxLength={2000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Como</span>
                  <Select value={author} onChange={(e) => setAuthor(e.target.value)} className="!h-8 !w-auto text-xs">
                    <option value="">Anónimo</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                  <Button type="submit" variant="primary" size="sm" className="ml-auto" disabled={!comment.trim()}><Send size={13} /> Comentar</Button>
                </div>
              </form>
            </>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex gap-2 text-xs"><History size={13} className="mt-0.5 shrink-0 text-slate-400" /><span className="text-slate-600">{h.summary}</span><span className="ml-auto shrink-0 text-slate-400">{fmtDateTime(h.at)}</span></li>
              ))}
              {history.length === 0 && <li className="text-xs text-slate-400">Sin cambios registrados.</li>}
            </ul>
          )}
        </section>
      </div>
      <footer className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">Los cambios se guardan automáticamente · Actualizada {fmtDateTime(task.updatedAt)}</footer>
    </>
  );
}

function ChecklistText({ text, done, onCommit }: { text: string; done: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState(text);
  useEffect(() => setV(text), [text]);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => (v.trim() && v !== text ? onCommit(v.trim()) : setV(text))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={cx('min-w-0 flex-1 bg-transparent text-sm focus:outline-none', done && 'text-slate-400 line-through')} />
  );
}
