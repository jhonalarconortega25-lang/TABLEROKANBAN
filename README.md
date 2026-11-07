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

## Abrir sin cuenta e instalar como app (GitHub Pages + Supabase)

Enlace del equipo (cuando esté publicado): **https://jhonalarconortega25-lang.github.io/TABLEROKANBAN/**

- Cualquiera lo abre **sin iniciar sesión**. Los cambios se guardan en la base de datos del equipo (Supabase) y aparecen al instante a todos.
- Botón **Instalar app** en la barra superior: en Android, PC y Mac abre el diálogo de instalación; en iPhone muestra los pasos (Safari → Compartir → Agregar a inicio).
- Si no hay internet, la app abre igual y avisa que trabaja sin conexión.

### Configuración (una sola vez, la hace el dueño del repositorio)

1. **Publicar:** hacer merge del pull request y en GitHub ir a **Settings → Pages → Source: GitHub Actions**.
2. **Crear la base:** en [supabase.com](https://supabase.com) crear un proyecto gratis → **SQL Editor** → pegar y ejecutar todo `supabase/schema.sql`.
3. **Conectar:** en Supabase, **Project Settings → API**, copiar **Project URL** y la clave **anon public**. En GitHub, **Settings → Secrets and variables → Actions → Variables**, crear `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con esos valores.
4. **Publicar de nuevo:** **Actions → Publicar en GitHub Pages → Run workflow**.
5. Abrir el enlace primero desde un solo dispositivo: ese primer acceso carga el equipo y el plan de ejemplo en la base. Después compartir el enlace.

> La clave *anon* es pública por diseño (va dentro de la app). La política de acceso incluida deja leer y editar a cualquiera que tenga el enlace, que es lo pedido: abrir sin cuenta. No compartas la clave *service_role*.

## Versión en claude.ai (alternativa con inicio de sesión)

También existe una copia publicada como artefacto de claude.ai con base de datos compartida: https://claude.ai/artifact/4ZZmcZgq6dLGuRYBvvHLBM. Requiere que cada integrante inicie sesión en claude.ai y sea invitado como **Editor**. Se compila con `npm run build:artifact`.

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
