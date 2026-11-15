import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Mail, Pencil, Plus, Trash2, Users, AlertTriangle, Upload } from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useData, useToday } from '../hooks/useData';
import { memberStats } from '../lib/metrics';
import { CATEGORICAL, STATUS_META } from '../lib/constants';
import { hasErrors, validateMember, type Errors } from '../lib/validation';
import type { Member } from '../types';
import { Avatar, Button, Card, CardHeader, EmptyState, Field, IconButton, Input, Modal, PageHeader, ProgressBar, cx } from '../components/ui';
import { AXIS, ChartTooltip, GRID, Legend } from '../components/charts';
import { TaskLine } from '../components/TaskLine';

export default function Team() {
  const data = useData();
  const today = useToday();
  const stats = useMemo(() => memberStats(data, today), [data, today]);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const unassigned = data.tasks.filter((t) => !t.assigneeId && t.status !== 'done').length;
  const maxOpen = Math.max(1, ...stats.map((s) => s.open));
  const avgOpen = stats.length ? stats.reduce((s, x) => s + x.open, 0) / stats.length : 0;

  const remove = async (m: Member, count: number) => {
    if (await useUI.getState().confirm({ title: `Eliminar a ${m.name}`, message: count ? `Sus ${count} actividades quedarán “Sin asignar”.` : `¿Eliminar a ${m.name} del equipo?`, confirmLabel: 'Eliminar', danger: true })) {
      usePlanner.getState().deleteMember(m.id);
      useUI.getState().toast('Integrante eliminado');
    }
  };

  const chart = stats.map((s) => ({ name: s.member.name, Completadas: s.completed, 'En curso': s.inProgress, Pendientes: s.open - s.inProgress }));
  const sel = stats.find((s) => s.member.id === selected);

  return (
    <div className="space-y-5">
      <PageHeader title="Equipo" subtitle="Integrantes, responsabilidades y carga de trabajo." actions={<Button variant="primary" onClick={() => setEditing('new')}><Plus size={16} /> Añadir integrante</Button>} />

      {stats.length === 0 ? (
        <Card><EmptyState icon={<Users size={20} />} title="Aún no hay integrantes" text="Añade a las personas del equipo para asignarles actividades." action={<Button variant="primary" onClick={() => setEditing('new')}><Plus size={15} /> Añadir integrante</Button>} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((s) => {
              const overloaded = s.open > avgOpen * 1.5 && s.open >= 3;
              return (
                <Card key={s.member.id} className={cx('p-4 transition-shadow', selected === s.member.id && 'ring-2 ring-brand-300')}>
                  <div className="flex items-start gap-3">
                    <Avatar member={s.member} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-extrabold uppercase tracking-wide text-brand-700">{s.member.name}</p>
                      <p className="truncate text-xs text-slate-500">{s.member.role || 'Sin rol definido'}</p>
                      {s.member.email && <a href={`mailto:${s.member.email}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"><Mail size={11} />{s.member.email}</a>}
                    </div>
                    <div className="flex">
                      <IconButton label="Editar" onClick={() => setEditing(s.member)}><Pencil size={15} /></IconButton>
                      <IconButton label="Eliminar" onClick={() => remove(s.member, s.assigned)} className="hover:!text-red-600"><Trash2 size={15} /></IconButton>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[['Asignadas', s.assigned, 'text-slate-900'], ['Completadas', s.completed, 'text-brand-700'], ['Pendientes', s.open, 'text-slate-900'], ['Atrasadas', s.overdue, s.overdue ? 'text-red-600' : 'text-slate-400']].map(([l, v, c]) => (
                      <div key={l as string} className="rounded-lg border-2 border-brand-100 py-2"><p className={cx('text-lg font-semibold', c as string)}>{v}</p><p className="text-[10px] text-slate-500">{l}</p></div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Carga abierta</span><span className="text-slate-600">{s.open} act.{s.collaborating > 0 && ` · colabora en ${s.collaborating}`}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', overloaded ? 'bg-gold-500' : 'bg-brand-400')} style={{ width: `${(s.open / maxOpen) * 100}%` }} /></div>
                    {overloaded && <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle size={11} /> Carga superior al promedio del equipo</p>}
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Avance personal</span><span className="font-semibold text-slate-900">{s.progress}%</span></div>
                    <ProgressBar value={s.progress} />
                  </div>
                  <div className="mt-3 flex gap-3 text-xs">
                    <button type="button" onClick={() => setSelected(selected === s.member.id ? null : s.member.id)} className="font-medium text-brand-700 hover:underline">{selected === s.member.id ? 'Ocultar actividades' : 'Ver actividades'}</button>
                    <Link to={`/kanban?assignee=${s.member.id}`} className="text-slate-500 hover:underline">Kanban</Link>
                  </div>
                </Card>
              );
            })}
          </div>

          {sel && (
            <Card>
              <CardHeader title={`Actividades de ${sel.member.name}`} subtitle={`${sel.assigned} asignadas`} />
              <div className="px-3 pb-3">
                {data.tasks.filter((t) => t.assigneeId === sel.member.id).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')).map((t) => (
                  <TaskLine key={t.id} task={t} right={<span className="w-24 text-right text-[11px] text-slate-500">{STATUS_META[t.status].label}</span>} />
                ))}
                {sel.assigned === 0 && <p className="px-2 py-3 text-xs text-slate-400">Sin actividades asignadas.</p>}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Distribución de la carga de trabajo" subtitle={unassigned ? `${unassigned} actividad(es) abiertas sin responsable` : 'Actividades por integrante y estado'}
              action={<Legend items={[{ label: 'Completadas', color: '#3f7a22' }, { label: 'En curso', color: '#dfa020' }, { label: 'Pendientes', color: '#a8a99a' }]} />} />
            <div className="px-2 pb-4" style={{ height: Math.max(160, stats.length * 52 + 40) }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" barCategoryGap="28%" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid {...GRID} horizontal={false} vertical />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis type="category" dataKey="name" {...AXIS} width={84} />
                  <Tooltip cursor={{ fill: '#f1f6ec' }} content={<ChartTooltip />} />
                  <Bar dataKey="Completadas" stackId="a" fill="#3f7a22" stroke="#fff" strokeWidth={1} />
                  <Bar dataKey="En curso" stackId="a" fill="#dfa020" stroke="#fff" strokeWidth={1} />
                  <Bar dataKey="Pendientes" stackId="a" fill="#a8a99a" stroke="#fff" strokeWidth={1} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <MemberModal value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function MemberModal({ value, onClose }: { value: Member | 'new' | null; onClose: () => void }) {
  const members = usePlanner((s) => s.members);
  const [form, setForm] = useState({ name: '', role: '', email: '', avatarUrl: '', colorIndex: 0 });
  const [errors, setErrors] = useState<Errors<Member>>({});
  const [last, setLast] = useState<typeof value>(null);
  if (value !== last) {
    setLast(value);
    setErrors({});
    if (value === 'new') {
      const used = new Set(members.map((m) => m.colorIndex));
      setForm({ name: '', role: '', email: '', avatarUrl: '', colorIndex: [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i)) ?? 0 });
    } else if (value) setForm({ name: value.name, role: value.role, email: value.email ?? '', avatarUrl: value.avatarUrl ?? '', colorIndex: value.colorIndex });
  }
  if (!value) return null;

  const onPhoto = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return useUI.getState().toast('El archivo debe ser una imagen', 'error');
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        // Redimensionar a 128px para no sobrecargar el almacenamiento
        const c = document.createElement('canvas');
        const size = 128;
        c.width = c.height = size;
        const ctx = c.getContext('2d')!;
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        setForm((x) => ({ ...x, avatarUrl: c.toDataURL('image/jpeg', 0.85) }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const save = () => {
    const payload = { name: form.name.trim(), role: form.role.trim(), email: form.email.trim() || undefined, avatarUrl: form.avatarUrl || undefined, colorIndex: form.colorIndex };
    const e = validateMember({ ...payload, id: value === 'new' ? undefined : value.id }, members);
    setErrors(e);
    if (hasErrors(e)) return;
    const st = usePlanner.getState();
    value === 'new' ? st.addMember(payload) : st.updateMember(value.id, payload);
    useUI.getState().toast(value === 'new' ? 'Integrante añadido' : 'Integrante actualizado');
    onClose();
  };

  const preview: Member = { id: 'preview', name: form.name || '?', role: '', colorIndex: form.colorIndex, avatarUrl: form.avatarUrl || undefined, createdAt: '' };
  return (
    <Modal open size="sm" onClose={onClose} title={value === 'new' ? 'Añadir integrante' : 'Editar integrante'} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}>
      <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex items-center gap-4">
          <Avatar member={preview} size={56} />
          <div className="space-y-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              <Upload size={13} /> Subir foto
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            {form.avatarUrl && <button type="button" onClick={() => setForm({ ...form, avatarUrl: '' })} className="ml-2 text-xs text-slate-500 hover:underline">Quitar</button>}
            <div className="flex gap-1">
              {CATEGORICAL.map((c, i) => <button key={c} type="button" aria-label={`Color ${i + 1}`} onClick={() => setForm({ ...form, colorIndex: i })} className={cx('h-5 w-5 rounded-full', form.colorIndex === i && 'ring-2 ring-slate-800 ring-offset-1')} style={{ background: c }} />)}
            </div>
          </div>
        </div>
        <Field label="Nombre *" error={errors.name}><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} /></Field>
        <Field label="Rol en el proyecto" error={errors.role}><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ej. Analista, Coordinador…" /></Field>
        <Field label="Correo electrónico (opcional)" error={errors.email}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!errors.email} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
