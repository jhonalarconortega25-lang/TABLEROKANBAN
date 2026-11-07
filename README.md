# Project Planner

Aplicación web para centralizar, organizar y monitorear todas las actividades de un proyecto: actividades, Kanban, sprints (Scrum), calendario y reuniones, equipo y estadísticas, todo conectado a una única fuente de datos.

## Inicio rápido

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de flujos y cálculos (Vitest)
npm run build      # compila a dist/ (sitio estático, desplegable en GitHub Pages, Netlify, Vercel…)
```

La primera vez se cargan **datos de ejemplo** (proyecto Capstone G09). Desde *Configuración* puedes borrarlos y empezar de cero, exportar/importar copias en JSON o restaurarlos.

## Publicar y compartir con el equipo (GitHub Pages)

1. En GitHub: **Settings → Pages → Build and deployment → Source: “GitHub Actions”** (solo una vez).
2. Cada push a `main` ejecuta las pruebas, compila y publica la app en
   **https://jhonalarconortega25-lang.github.io/TABLEROKANBAN/**
   (también se puede lanzar a mano desde **Actions → Publicar en GitHub Pages → Run workflow**).
3. Comparte ese enlace con el equipo.

> Sin Supabase, cada persona guarda sus datos en su propio navegador. Para que **todo el equipo vea y edite los mismos datos en tiempo real**, sigue la sección *Persistencia → Multiusuario* y guarda `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como **variables** del repositorio (*Settings → Secrets and variables → Actions → Variables*); luego vuelve a ejecutar el workflow.

## Arquitectura

```
src/
├─ types.ts                  Modelo de datos normalizado (Project, Member, Sprint, Task, Meeting, Milestone, History)
├─ store/usePlanner.ts       Store central (Zustand) = ÚNICA fuente de verdad + acciones + historial + autoguardado
├─ store/useUI.ts            Estado de interfaz (paneles, toasts, confirmaciones)
├─ lib/metrics.ts            Cálculos puros: avance, atrasos, por sprint, por responsable, semanal, burndown, filtros
├─ lib/validation.ts         Validación de formularios
├─ lib/seed.ts               Datos de ejemplo (fechas relativas a hoy)
├─ lib/persistence/
│  └─ supabaseSync.ts        Sincronización opcional con Supabase + Realtime
├─ components/               UI reutilizable (Layout, TaskDrawer, diálogos, filtros, gráficos)
└─ pages/                    Dashboard, Actividades, Kanban, Sprints, Calendario, Equipo, Estadísticas, Configuración
supabase/schema.sql          Esquema relacional (claves foráneas, índices, RLS, Realtime)
legacy/tablero-tesis.html    Tablero Kanban anterior (conservado como referencia)
```

**Sincronización automática.** Las vistas no guardan copias de datos: todas leen del mismo store y calculan los indicadores con `lib/metrics.ts` en cada render. Por eso, completar una tarea, moverla en el Kanban, cambiar su responsable o su fecha actualiza al instante el dashboard, el avance del sprint, la carga del equipo, el calendario y las estadísticas.

**Avance.** `Avance (%) = completadas / total × 100`. Cada tarea tiene un campo `weight` (1–5) y el proyecto un `weightingMode` (`equal` | `weighted`), por lo que la ponderación por complejidad ya está soportada (activable en *Configuración*, modo beta).

**Integridad referencial.** Al eliminar un integrante, sprint o reunión, sus referencias se limpian (tareas sin asignar, al backlog, etc.).

## Persistencia

- **Por defecto:** autoguardado en el navegador (`localStorage`). Los datos se mantienen al cerrar y volver a abrir.
- **Multiusuario en tiempo real (opcional):**
  1. Crea un proyecto en [Supabase](https://supabase.com) y ejecuta `supabase/schema.sql` en el SQL Editor.
  2. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
  3. `npm run build` (o, si usas GitHub Pages, guarda ambos valores como variables del repositorio y vuelve a ejecutar el workflow). La app sube los datos locales si la base está vacía y, desde entonces, replica cada cambio y recibe los del resto del equipo por Supabase Realtime.

  > La política RLS incluida es abierta (pensada para un equipo pequeño). Para producción, sustitúyela por políticas basadas en `auth.uid()`.

## Funcionalidades

- Dashboard con avance general vs. esperado, KPIs (total, completadas, en progreso, en revisión, pendientes, atrasadas), gráficos, sprint activo, próximas entregas, reuniones e hitos.
- Actividades: tabla ordenable/agrupable (sprint, fase, estado), filtros avanzados guardados en la URL, panel de detalle con autoguardado: responsable, colaboradores, fechas, prioridad, sprint, fase, checklist, comentarios, adjuntos (archivo ≤750 KB o enlace), historial, duplicar y eliminar.
- Kanban con drag & drop (ratón, táctil y teclado), creación rápida por columna y filtros.
- Sprints: CRUD, activar/finalizar, avance por sprint, traslado (individual o masivo) entre sprints y backlog, comparativa.
- Calendario mes/semana/día con entregas, inicio de actividades, sprints, reuniones e hitos; arrastrar para reprogramar.
- Reuniones con participantes, objetivo, agenda, acuerdos y tareas derivadas → “Crear tarea” o “Convertir en actividad”.
- Equipo con foto/avatar, rol, correo y carga de trabajo.
- Estadísticas: por estado, prioridad, sprint, responsable, completadas por semana, acumulado y burndown.
- Buscador global (Ctrl/⌘ + K), notificaciones (atrasos, vencimientos, reuniones, hitos), confirmación antes de eliminar, historial de cambios, diseño responsive.
