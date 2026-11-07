import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TaskDrawer } from './components/TaskDrawer';
import { ConfirmDialog, MeetingModal, NewTaskModal, Toasts } from './components/Dialogs';
import { startSupabaseSync } from './lib/persistence/supabaseSync';
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
  useEffect(() => { void startSupabaseSync(); }, []);
  return (
    <HashRouter>
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
    </HashRouter>
  );
}
