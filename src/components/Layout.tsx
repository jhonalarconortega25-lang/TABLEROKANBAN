import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, KanbanSquare, Rocket, CalendarDays, Users, BarChart3, Settings, Search, Bell, Menu, Plus, X, AlertTriangle, Clock, CalendarClock, Flag, CloudOff, Cloud,
} from 'lucide-react';
import { usePlanner } from '../store/usePlanner';
import { useUI } from '../store/useUI';
import { useData, useToday } from '../hooks/useData';
import { matchesText, progressOf } from '../lib/metrics';
import { daysBetween, fmtDateTime, fmtShort, relativeDays } from '../lib/dates';
import { useSyncStatus } from '../lib/persistence/supabaseSync';
import { Avatar, IconButton, StatusBadge, cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/actividades', label: 'Actividades', icon: ListTodo },
  { to: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { to: '/sprints', label: 'Sprints', icon: Rocket },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/equipo', label: 'Equipo', icon: Users },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const open = useUI((s) => s.sidebarOpen);
  const setOpen = useUI((s) => s.setSidebar);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname, setOpen]);

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}
      <Sidebar open={open} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const project = usePlanner((s) => s.project);
  const tasks = usePlanner((s) => s.tasks);
  const progress = progressOf(tasks, project.weightingMode);
  const sync = useSyncStatus();
  return (
    <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand-700 text-white transition-transform duration-200 lg:translate-x-0', open ? 'translate-x-0 shadow-xl' : '-translate-x-full')}>
      <div className="px-4 pb-5 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 text-brand-900">
            <svg viewBox="0 0 32 32" width="18" height="18"><path d="M8 9h16M8 16h11M8 23h6" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /></svg>
          </div>
          <p className="font-display text-[15px] font-extrabold uppercase leading-tight tracking-wide">Project<br />Planner</p>
        </div>
        <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-brand-100" title={project.name}>{project.name}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon }, i) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => cx('group flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold transition-colors', isActive ? 'bg-white text-brand-700' : 'text-brand-50/90 hover:bg-white/10 hover:text-white')}>
            {({ isActive }) => (
              <>
                <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold', isActive ? 'bg-brand-600 text-white' : 'border-2 border-white/60 text-white group-hover:border-white')}>
                  {i + 1}
                </span>
                <Icon size={16} strokeWidth={2} className="opacity-80" /> {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border-2 border-dashed border-white/30 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-display font-bold uppercase tracking-wide text-brand-100">Avance</span>
          <span className="font-display text-base font-extrabold text-gold-300">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gold-500 transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-brand-100" title={sync.detail}>
          {sync.mode === 'local' ? <CloudOff size={12} /> : <Cloud size={12} className={sync.ok ? 'text-gold-300' : 'text-red-300'} />}
          {sync.mode === 'local' ? 'Guardado local automático' : sync.readOnly ? 'Solo lectura' : sync.ok ? 'Guardado para todo el equipo' : 'Reconectando…'}
        </p>
      </div>
    </aside>
  );
}

function Topbar() {
  const setOpen = useUI((s) => s.setSidebar);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b-4 border-brand-600 bg-white/95 px-3 backdrop-blur sm:px-6 lg:px-8">
      <IconButton label="Menú" className="lg:hidden" onClick={() => setOpen(true)}><Menu size={19} /></IconButton>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Notifications />
        <button type="button" onClick={() => useUI.getState().openNewTask()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-500 px-4 text-sm font-bold text-brand-900 shadow-sm hover:bg-gold-400">
          <Plus size={16} /> <span className="hidden sm:inline">Nueva actividad</span>
        </button>
      </div>
    </header>
  );
}

function useClickOutside(ref: RefObject<HTMLElement>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { tasks, meetings, members, sprints } = useData();
  const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) return null;
    return {
      tasks: tasks.filter((t) => matchesText(`${t.title} ${t.description} ${t.phase}`, q)).slice(0, 7),
      meetings: meetings.filter((m) => matchesText(`${m.title} ${m.objective} ${m.agenda}`, q)).slice(0, 4),
      members: members.filter((m) => matchesText(`${m.name} ${m.role}`, q)).slice(0, 3),
      sprints: sprints.filter((s) => matchesText(`${s.name} ${s.goal} sprint ${s.number}`, q)).slice(0, 3),
    };
  }, [q, tasks, meetings, members, sprints]);

  const pick = (fn: () => void) => { fn(); setOpen(false); setQ(''); };
  const total = results ? results.tasks.length + results.meetings.length + results.members.length + results.sprints.length : 0;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Buscar actividades, reuniones, personas…"
        className="h-9 w-full rounded-full border border-brand-200 bg-brand-50/50 pl-9 pr-14 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400 sm:block">Ctrl K</kbd>
      {open && results && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in sm:min-w-[420px]">
          {total === 0 && <p className="px-3 py-4 text-center text-sm text-slate-500">Sin resultados para “{q}”</p>}
          {results.tasks.length > 0 && <SearchGroup title="Actividades">{results.tasks.map((t) => (
            <SearchItem key={t.id} onClick={() => pick(() => useUI.getState().openTask(t.id))}>
              <span className="min-w-0 flex-1 truncate">{t.title}</span><StatusBadge status={t.status} />
            </SearchItem>))}</SearchGroup>}
          {results.meetings.length > 0 && <SearchGroup title="Reuniones">{results.meetings.map((m) => (
            <SearchItem key={m.id} onClick={() => pick(() => useUI.getState().openMeeting(m.id))}>
              <CalendarClock size={14} className="text-slate-400" /><span className="flex-1 truncate">{m.title}</span><span className="text-xs text-slate-400">{fmtShort(m.date)} {m.time}</span>
            </SearchItem>))}</SearchGroup>}
          {results.members.length > 0 && <SearchGroup title="Equipo">{results.members.map((m) => (
            <SearchItem key={m.id} onClick={() => pick(() => nav(`/actividades?assignee=${m.id}`))}>
              <Avatar member={m} size={20} /><span className="flex-1 truncate">{m.name}</span><span className="text-xs text-slate-400">{m.role}</span>
            </SearchItem>))}</SearchGroup>}
          {results.sprints.length > 0 && <SearchGroup title="Sprints">{results.sprints.map((s) => (
            <SearchItem key={s.id} onClick={() => pick(() => nav(`/sprints#${s.id}`))}>
              <Rocket size={14} className="text-slate-400" /><span className="flex-1 truncate">Sprint {s.number} · {s.name}</span>
            </SearchItem>))}</SearchGroup>}
        </div>
      )}
    </div>
  );
}

const SearchGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="py-1"><p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>{children}</div>
);
const SearchItem = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">{children}</button>
);

// ---------- Notificaciones (derivadas del estado real) ----------
interface Alert { id: string; kind: 'overdue' | 'due' | 'meeting' | 'sprint' | 'milestone'; text: string; sub: string; onClick: () => void }

const SEEN_KEY = 'project-planner:seen-alerts';
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };

function Notifications() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'alerts' | 'activity'>('alerts');
  const [seen, setSeen] = useState<string[]>(readSeen);
  const ref = useRef<HTMLDivElement>(null);
  const { tasks, meetings, sprints, milestones, history } = useData();
  const today = useToday();
  const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    for (const t of tasks) {
      if (t.status === 'done' || !t.dueDate) continue;
      const d = daysBetween(today, t.dueDate);
      if (d < 0) out.push({ id: `od:${t.id}:${t.dueDate}`, kind: 'overdue', text: t.title, sub: `Atrasada · venció ${relativeDays(t.dueDate, today)}`, onClick: () => useUI.getState().openTask(t.id) });
      else if (d <= 2) out.push({ id: `due:${t.id}:${t.dueDate}`, kind: 'due', text: t.title, sub: `Vence ${relativeDays(t.dueDate, today)}`, onClick: () => useUI.getState().openTask(t.id) });
    }
    for (const m of meetings) {
      const d = daysBetween(today, m.date);
      if (d >= 0 && d <= 1) out.push({ id: `mt:${m.id}:${m.date}${m.time}`, kind: 'meeting', text: m.title, sub: `Reunión ${relativeDays(m.date, today)} a las ${m.time}`, onClick: () => useUI.getState().openMeeting(m.id) });
    }
    for (const s of sprints) {
      const d = daysBetween(today, s.endDate);
      if (s.status === 'active' && d >= 0 && d <= 3) out.push({ id: `sp:${s.id}:${s.endDate}`, kind: 'sprint', text: `Sprint ${s.number} · ${s.name}`, sub: `Finaliza ${relativeDays(s.endDate, today)}`, onClick: () => nav(`/sprints#${s.id}`) });
      if (s.status === 'active' && d < 0) out.push({ id: `spod:${s.id}:${s.endDate}`, kind: 'sprint', text: `Sprint ${s.number} sigue activo`, sub: `Su fecha de fin pasó ${relativeDays(s.endDate, today)}. ¿Finalizarlo?`, onClick: () => nav(`/sprints#${s.id}`) });
    }
    for (const m of milestones) {
      const d = daysBetween(today, m.date);
      if (d >= 0 && d <= 7) out.push({ id: `ms:${m.id}:${m.date}`, kind: 'milestone', text: m.title, sub: `Hito ${relativeDays(m.date, today)}`, onClick: () => nav('/calendario') });
    }
    const order = { overdue: 0, meeting: 1, due: 2, sprint: 3, milestone: 4 };
    return out.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [tasks, meetings, sprints, milestones, today, nav]);

  const unread = alerts.filter((a) => !seen.includes(a.id)).length;
  const markAll = () => {
    const ids = alerts.map((a) => a.id);
    setSeen(ids);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* almacenamiento no disponible */ }
  };
  const icon = (k: Alert['kind']) =>
    k === 'overdue' ? <AlertTriangle size={15} className="text-red-600" /> : k === 'meeting' ? <CalendarClock size={15} className="text-brand-600" /> : k === 'milestone' ? <Flag size={15} className="text-bark-600" /> : <Clock size={15} className="text-amber-600" />;

  return (
    <div ref={ref} className="relative">
      <IconButton label="Notificaciones" onClick={() => setOpen((o) => !o)} className="relative !h-9 !w-9">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </IconButton>
      {open && (
        <div className="fixed left-3 right-3 top-14 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-fade-in sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 pt-3">
            {(['alerts', 'activity'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-2 text-sm font-medium', tab === t ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500')}>
                {t === 'alerts' ? `Alertas (${alerts.length})` : 'Actividad reciente'}
              </button>
            ))}
            <IconButton label="Cerrar" onClick={() => setOpen(false)} className="ml-auto -mt-2"><X size={16} /></IconButton>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {tab === 'alerts' ? (
              alerts.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">Todo al día 🎉</p> :
                alerts.map((a) => (
                  <button key={a.id} type="button" onClick={() => { a.onClick(); setOpen(false); }} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">
                    <span className="mt-0.5">{icon(a.kind)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-800">{a.text}</span><span className="block text-xs text-slate-500">{a.sub}</span></span>
                    {!seen.includes(a.id) && <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-600" />}
                  </button>
                ))
            ) : (
              history.slice(0, 25).map((h) => (
                <div key={h.id} className="flex gap-2 px-2.5 py-1.5 text-xs"><span className="flex-1 text-slate-600">{h.summary}</span><span className="shrink-0 text-slate-400">{fmtDateTime(h.at)}</span></div>
              ))
            )}
          </div>
          {tab === 'alerts' && alerts.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-right"><button type="button" onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">Marcar todo como leído</button></div>
          )}
        </div>
      )}
    </div>
  );
}

