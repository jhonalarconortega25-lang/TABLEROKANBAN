import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TaskDrawer } from './components/TaskDrawer';
import { ConfirmDialog, MeetingModal, NewTaskModal, Toasts } from './components/Dialogs';
import { startSupabaseSync, useSyncStatus } from './lib/persistence/supabaseSync';
import { startArtifactSync } from './lib/persistence/artifactDbSync';
import { IS_ARTIFACT } from './lib/backend';
import { todayISO } from './lib/dates';
import Dashboard from './pages/Dashboard';

const Activities = lazy(() => import('./pages/Activities'));
const Kanban = lazy(() => import('./pages/Kanban'));
const Sprints = lazy(() => import('./pages/Sprints'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Team = lazy(() => import('./pages/Team'));
const Stats = lazy(() => import('./pages/Stats'));
const Settings = lazy(() => import('./pages/Settings'));

/** Re-renderiza la app cuando cambia el día para recalcular atrasos. */
function useDayTick() {
  const [day, setDay] = useState(todayISO());
  useEffect(() => {
    const t = setInterval(() => todayISO() !== day && setDay(todayISO()), 60_000);
    return () => clearInterval(t);
  }, [day]);
  return day;
}

export default function App() {
  const day = useDayTick();
  useEffect(() => { void (IS_ARTIFACT ? startArtifactSync() : startSupabaseSync()); }, []);
  const sync = useSyncStatus();
  // Dentro de claude.ai solo un '#nombre' simple viaja con el enlace: se usa un router en memoria.
  const Router = IS_ARTIFACT ? MemoryRouter : HashRouter;
  if (IS_ARTIFACT && !sync.loaded) return <SharedLoading detail={sync.detail} />;
  return (
    <Router>
      {sync.readOnly && IS_ARTIFACT && <ReadOnlyBanner />}
      <Layout key={day}>
        <Suspense fallback={<div className="py-20 text-center text-sm text-slate-400">Cargando…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/actividades" element={<Activities />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/sprints" element={<Sprints />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/equipo" element={<Team />} />
            <Route path="/estadisticas" element={<Stats />} />
            <Route path="/configuracion" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <TaskDrawer />
      <NewTaskModal />
      <MeetingModal />
      <ConfirmDialog />
      <Toasts />
    </Router>
  );
}

function SharedLoading({ detail }: { detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
        <p className="text-sm font-medium text-slate-800">Project Planner</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="relative z-50 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 ring-1 ring-amber-200">
      Estás en modo solo lectura: tus cambios no se guardarán. Pide a Jhon que te invite al artefacto como <b>Editor</b>.
    </div>
  );
}
