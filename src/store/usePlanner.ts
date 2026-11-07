// Store central: ÚNICA fuente de datos de la aplicación.
// Toda modificación pasa por estas acciones; las vistas se suscriben y los
// indicadores se recalculan a partir del estado (ver lib/metrics.ts).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActionItem, Attachment, EntityKind, HistoryEntry, ID, Meeting, Member, Milestone, PlannerData, Project, Sprint, Task, TaskStatus,
} from '../types';
import { createEmptyData, createSeedData } from '../lib/seed';
import { nowISO, todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { STATUS_META } from '../lib/constants';
import { IS_ARTIFACT } from '../lib/backend';

const HISTORY_LIMIT = 500;
export const STORAGE_KEY = 'project-planner:v1';

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> & { title: string };

interface Actions {
  // Proyecto
  updateProject: (patch: Partial<Project>) => void;
  // Actividades
  addTask: (input: NewTask) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  setTaskStatus: (id: ID, status: TaskStatus) => void;
  deleteTask: (id: ID) => void;
  duplicateTask: (id: ID) => Task | undefined;
  addChecklistItem: (taskId: ID, text: string) => void;
  updateChecklistItem: (taskId: ID, itemId: ID, patch: { text?: string; done?: boolean }) => void;
  removeChecklistItem: (taskId: ID, itemId: ID) => void;
  addComment: (taskId: ID, text: string, authorId: ID | null) => void;
  removeComment: (taskId: ID, commentId: ID) => void;
  addAttachment: (taskId: ID, a: Omit<Attachment, 'id' | 'addedAt'>) => void;
  removeAttachment: (taskId: ID, attId: ID) => void;
  moveTasksToSprint: (taskIds: ID[], sprintId: ID | null) => void;
  // Sprints
  addSprint: (input: Omit<Sprint, 'id' | 'createdAt'>) => Sprint;
  updateSprint: (id: ID, patch: Partial<Sprint>) => void;
  deleteSprint: (id: ID, moveTasksTo?: ID | null) => void;
  // Reuniones
  addMeeting: (input: Omit<Meeting, 'id' | 'createdAt'>) => Meeting;
  updateMeeting: (id: ID, patch: Partial<Meeting>) => void;
  deleteMeeting: (id: ID) => void;
  convertMeetingToTask: (meetingId: ID) => Task | undefined;
  createTaskFromActionItem: (meetingId: ID, itemId: ID) => Task | undefined;
  // Equipo
  addMember: (input: Omit<Member, 'id' | 'createdAt' | 'colorIndex'> & { colorIndex?: number }) => Member;
  updateMember: (id: ID, patch: Partial<Member>) => void;
  deleteMember: (id: ID) => void;
  // Hitos
  addMilestone: (input: Omit<Milestone, 'id' | 'createdAt'>) => Milestone;
  updateMilestone: (id: ID, patch: Partial<Milestone>) => void;
  deleteMilestone: (id: ID) => void;
  // Datos
  loadDemo: () => void;
  clearAll: () => void;
  clearWork: () => void; // vacía actividades, sprints, reuniones e hitos; conserva equipo y proyecto
  importData: (data: PlannerData) => void;
  replaceAll: (data: PlannerData) => void; // usado por la sincronización remota (sin historial)
  clearHistory: () => void;
}

export type PlannerState = PlannerData & Actions;

const log = (entity: EntityKind, entityId: ID | null, action: HistoryEntry['action'], summary: string): HistoryEntry => ({
  id: uid(), at: nowISO(), entity, entityId, action, summary,
});

const withLog = (history: HistoryEntry[], entry: HistoryEntry) => [entry, ...history].slice(0, HISTORY_LIMIT);

/** Normaliza la transición de estado: registra/limpia completedAt. */
function applyStatus(t: Task, status: TaskStatus): Task {
  if (t.status === status) return t;
  return { ...t, status, completedAt: status === 'done' ? nowISO() : null };
}

function buildTask(input: NewTask): Task {
  const now = nowISO();
  const status = input.status ?? 'pending';
  return {
    id: uid(),
    title: input.title.trim(),
    description: input.description ?? '',
    assigneeId: input.assigneeId ?? null,
    collaboratorIds: input.collaboratorIds ?? [],
    startDate: input.startDate || null,
    dueDate: input.dueDate || null,
    status,
    priority: input.priority ?? 'medium',
    sprintId: input.sprintId ?? null,
    phase: input.phase ?? '',
    checklist: input.checklist ?? [],
    comments: input.comments ?? [],
    attachments: input.attachments ?? [],
    weight: input.weight ?? 1,
    meetingId: input.meetingId ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: status === 'done' ? input.completedAt ?? now : null,
  };
}

const FIELD_LABELS: Partial<Record<keyof Task, string>> = {
  title: 'nombre', description: 'descripción', assigneeId: 'responsable', collaboratorIds: 'colaboradores', startDate: 'fecha de inicio',
  dueDate: 'fecha límite', priority: 'prioridad', sprintId: 'sprint', phase: 'fase', weight: 'peso',
};

type SetFn = (partial: Partial<PlannerState> | ((s: PlannerState) => Partial<PlannerState>)) => void;

const creator = (set: SetFn, get: () => PlannerState): PlannerState => {
      const patchTask = (id: ID, fn: (t: Task) => Task, entry?: (t: Task) => HistoryEntry | null) =>
        set((s) => {
          const current = s.tasks.find((t) => t.id === id);
          if (!current) return {};
          const next = { ...fn(current), updatedAt: nowISO() };
          const e = entry?.(current);
          return { tasks: s.tasks.map((t) => (t.id === id ? next : t)), history: e ? withLog(s.history, e) : s.history };
        });

      const memberName = (id: ID | null) => get().members.find((m) => m.id === id)?.name ?? 'Sin asignar';
      const sprintName = (id: ID | null) => {
        const sp = get().sprints.find((x) => x.id === id);
        return sp ? `Sprint ${sp.number}` : 'Backlog';
      };

      return {
        // En modo compartido los datos llegan de la base del artefacto: se arranca vacío.
        ...(IS_ARTIFACT ? createEmptyData() : createSeedData()),

        updateProject: (patch) => set((s) => ({ project: { ...s.project, ...patch }, history: withLog(s.history, log('project', null, 'update', 'Datos del proyecto actualizados')) })),

        addTask: (input) => {
          const task = buildTask(input);
          set((s) => ({ tasks: [...s.tasks, task], history: withLog(s.history, log('task', task.id, 'create', `Actividad creada: “${task.title}”`)) }));
          return task;
        },

        updateTask: (id, patch) => {
          const { status, ...rest } = patch;
          patchTask(
            id,
            (t) => {
              let next = { ...t, ...rest };
              if (status) next = applyStatus(next, status);
              if (next.title) next.title = next.title.trimStart();
              return next;
            },
            (t) => {
              const changed = (Object.keys(rest) as (keyof typeof rest)[]).filter((k) => JSON.stringify(t[k]) !== JSON.stringify(rest[k]) && FIELD_LABELS[k]);
              if (status && status !== t.status) return log('task', id, status === 'done' ? 'complete' : 'status', `“${t.title}” → ${STATUS_META[status].label}`);
              if (changed.length === 0) return null;
              if (changed.includes('assigneeId')) return log('task', id, 'update', `“${t.title}”: responsable → ${memberName(rest.assigneeId ?? null)}`);
              if (changed.includes('sprintId')) return log('task', id, 'move', `“${t.title}” movida a ${sprintName(rest.sprintId ?? null)}`);
              return log('task', id, 'update', `“${t.title}”: ${changed.map((k) => FIELD_LABELS[k]).join(', ')} actualizado`);
            },
          );
        },

        setTaskStatus: (id, status) => get().updateTask(id, { status }),

        deleteTask: (id) =>
          set((s) => {
            const t = s.tasks.find((x) => x.id === id);
            if (!t) return {};
            return {
              tasks: s.tasks.filter((x) => x.id !== id),
              // Limpia referencias desde acuerdos de reuniones
              meetings: s.meetings.map((m) =>
                m.actionItems.some((a) => a.taskId === id) ? { ...m, actionItems: m.actionItems.map((a) => (a.taskId === id ? { ...a, taskId: null } : a)) } : m,
              ),
              history: withLog(s.history, log('task', id, 'delete', `Actividad eliminada: “${t.title}”`)),
            };
          }),

        duplicateTask: (id) => {
          const t = get().tasks.find((x) => x.id === id);
          if (!t) return undefined;
          return get().addTask({
            ...t,
            title: `${t.title} (copia)`,
            status: 'pending',
            completedAt: null,
            comments: [],
            checklist: t.checklist.map((c) => ({ ...c, id: uid(), done: false })),
            attachments: t.attachments.map((a) => ({ ...a, id: uid() })),
          });
        },

        addChecklistItem: (taskId, text) =>
          text.trim() && patchTask(taskId, (t) => ({ ...t, checklist: [...t.checklist, { id: uid(), text: text.trim(), done: false }] }), (t) => log('task', taskId, 'update', `“${t.title}”: subtarea añadida`)),
        updateChecklistItem: (taskId, itemId, patch) =>
          patchTask(taskId, (t) => ({ ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, ...patch } : c)) }), (t) => {
            const item = t.checklist.find((c) => c.id === itemId);
            return patch.done !== undefined && item ? log('task', taskId, 'update', `“${t.title}”: subtarea “${item.text}” ${patch.done ? 'completada' : 'reabierta'}`) : null;
          }),
        removeChecklistItem: (taskId, itemId) =>
          patchTask(taskId, (t) => ({ ...t, checklist: t.checklist.filter((c) => c.id !== itemId) }), (t) => log('task', taskId, 'update', `“${t.title}”: subtarea eliminada`)),

        addComment: (taskId, text, authorId) =>
          text.trim() &&
          patchTask(taskId, (t) => ({ ...t, comments: [...t.comments, { id: uid(), authorId, text: text.trim(), createdAt: nowISO() }] }), (t) => log('task', taskId, 'update', `${memberName(authorId)} comentó en “${t.title}”`)),
        removeComment: (taskId, commentId) => patchTask(taskId, (t) => ({ ...t, comments: t.comments.filter((c) => c.id !== commentId) })),

        addAttachment: (taskId, a) =>
          patchTask(taskId, (t) => ({ ...t, attachments: [...t.attachments, { ...a, id: uid(), addedAt: nowISO() }] }), (t) => log('task', taskId, 'update', `“${t.title}”: adjunto “${a.name}” añadido`)),
        removeAttachment: (taskId, attId) => patchTask(taskId, (t) => ({ ...t, attachments: t.attachments.filter((x) => x.id !== attId) })),

        moveTasksToSprint: (taskIds, sprintId) =>
          set((s) => ({
            tasks: s.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, sprintId, updatedAt: nowISO() } : t)),
            history: withLog(s.history, log('task', taskIds.length === 1 ? taskIds[0] : null, 'move', `${taskIds.length} actividad(es) movida(s) a ${sprintName(sprintId)}`)),
          })),

        addSprint: (input) => {
          const sprint: Sprint = { ...input, id: uid(), createdAt: nowISO() };
          set((s) => ({ sprints: [...s.sprints, sprint], history: withLog(s.history, log('sprint', sprint.id, 'create', `Sprint ${sprint.number} creado: “${sprint.name}”`)) }));
          return sprint;
        },
        updateSprint: (id, patch) =>
          set((s) => {
            const sp = s.sprints.find((x) => x.id === id);
            if (!sp) return {};
            return {
              sprints: s.sprints.map((x) => (x.id === id ? { ...x, ...patch } : x)),
              history: withLog(s.history, log('sprint', id, 'update', `Sprint ${patch.number ?? sp.number} actualizado`)),
            };
          }),
        deleteSprint: (id, moveTasksTo = null) =>
          set((s) => {
            const sp = s.sprints.find((x) => x.id === id);
            if (!sp) return {};
            return {
              sprints: s.sprints.filter((x) => x.id !== id),
              tasks: s.tasks.map((t) => (t.sprintId === id ? { ...t, sprintId: moveTasksTo, updatedAt: nowISO() } : t)),
              meetings: s.meetings.map((m) => (m.sprintId === id ? { ...m, sprintId: null } : m)),
              history: withLog(s.history, log('sprint', id, 'delete', `Sprint ${sp.number} eliminado`)),
            };
          }),

        addMeeting: (input) => {
          const meeting: Meeting = { ...input, id: uid(), createdAt: nowISO() };
          set((s) => ({ meetings: [...s.meetings, meeting], history: withLog(s.history, log('meeting', meeting.id, 'create', `Reunión programada: “${meeting.title}”`)) }));
          return meeting;
        },
        updateMeeting: (id, patch) =>
          set((s) => {
            const m = s.meetings.find((x) => x.id === id);
            if (!m) return {};
            return { meetings: s.meetings.map((x) => (x.id === id ? { ...x, ...patch } : x)), history: withLog(s.history, log('meeting', id, 'update', `Reunión actualizada: “${patch.title ?? m.title}”`)) };
          }),
        deleteMeeting: (id) =>
          set((s) => {
            const m = s.meetings.find((x) => x.id === id);
            if (!m) return {};
            return {
              meetings: s.meetings.filter((x) => x.id !== id),
              tasks: s.tasks.map((t) => (t.meetingId === id ? { ...t, meetingId: null } : t)),
              history: withLog(s.history, log('meeting', id, 'delete', `Reunión eliminada: “${m.title}”`)),
            };
          }),
        convertMeetingToTask: (meetingId) => {
          const m = get().meetings.find((x) => x.id === meetingId);
          if (!m) return undefined;
          return get().addTask({
            title: m.title,
            description: [m.objective && `Objetivo: ${m.objective}`, m.agenda && `Agenda:\n${m.agenda}`, m.agreements && `Acuerdos:\n${m.agreements}`].filter(Boolean).join('\n\n'),
            assigneeId: m.participantIds[0] ?? null,
            collaboratorIds: m.participantIds.slice(1),
            startDate: m.date,
            dueDate: m.date,
            sprintId: m.sprintId,
            phase: 'Reunión',
            meetingId: m.id,
            checklist: m.actionItems.map((a) => ({ id: uid(), text: a.text, done: false })),
          });
        },
        createTaskFromActionItem: (meetingId, itemId) => {
          const m = get().meetings.find((x) => x.id === meetingId);
          const item = m?.actionItems.find((a) => a.id === itemId);
          if (!m || !item || item.taskId) return undefined;
          const task = get().addTask({
            title: item.text,
            description: `Derivada de la reunión “${m.title}” (${m.date}).`,
            assigneeId: item.assigneeId,
            startDate: todayISO() > m.date ? todayISO() : m.date,
            sprintId: m.sprintId,
            meetingId: m.id,
          });
          set((s) => ({
            meetings: s.meetings.map((x) => (x.id === meetingId ? { ...x, actionItems: x.actionItems.map((a: ActionItem) => (a.id === itemId ? { ...a, taskId: task.id } : a)) } : x)),
          }));
          return task;
        },

        addMember: (input) => {
          const used = new Set(get().members.map((m) => m.colorIndex));
          let colorIndex = input.colorIndex ?? 0;
          if (input.colorIndex === undefined) while (used.has(colorIndex) && colorIndex < 8) colorIndex++;
          const member: Member = { ...input, colorIndex: colorIndex % 8, id: uid(), createdAt: nowISO() };
          set((s) => ({ members: [...s.members, member], history: withLog(s.history, log('member', member.id, 'create', `Integrante añadido: ${member.name}`)) }));
          return member;
        },
        updateMember: (id, patch) =>
          set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)), history: withLog(s.history, log('member', id, 'update', `Integrante actualizado: ${patch.name ?? memberName(id)}`)) })),
        deleteMember: (id) =>
          set((s) => {
            const m = s.members.find((x) => x.id === id);
            if (!m) return {};
            return {
              members: s.members.filter((x) => x.id !== id),
              tasks: s.tasks.map((t) =>
                t.assigneeId === id || t.collaboratorIds.includes(id)
                  ? { ...t, assigneeId: t.assigneeId === id ? null : t.assigneeId, collaboratorIds: t.collaboratorIds.filter((c) => c !== id), updatedAt: nowISO() }
                  : t,
              ),
              sprints: s.sprints.map((sp) => (sp.ownerId === id ? { ...sp, ownerId: null } : sp)),
              meetings: s.meetings.map((mt) => ({
                ...mt,
                participantIds: mt.participantIds.filter((p) => p !== id),
                actionItems: mt.actionItems.map((a) => (a.assigneeId === id ? { ...a, assigneeId: null } : a)),
              })),
              history: withLog(s.history, log('member', id, 'delete', `Integrante eliminado: ${m.name}`)),
            };
          }),

        addMilestone: (input) => {
          const ms: Milestone = { ...input, id: uid(), createdAt: nowISO() };
          set((s) => ({ milestones: [...s.milestones, ms], history: withLog(s.history, log('milestone', ms.id, 'create', `Hito creado: “${ms.title}”`)) }));
          return ms;
        },
        updateMilestone: (id, patch) =>
          set((s) => ({ milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)), history: withLog(s.history, log('milestone', id, 'update', 'Hito actualizado')) })),
        deleteMilestone: (id) =>
          set((s) => ({ milestones: s.milestones.filter((m) => m.id !== id), history: withLog(s.history, log('milestone', id, 'delete', 'Hito eliminado')) })),

        loadDemo: () => set(() => createSeedData()),
        clearAll: () => set(() => ({ ...createEmptyData(), history: [log('project', null, 'create', 'Proyecto reiniciado sin datos')] })),
        clearWork: () =>
          set((s) => ({ tasks: [], sprints: [], meetings: [], milestones: [], history: [log('project', null, 'delete', 'Se vaciaron actividades, sprints, reuniones e hitos (se conservó el equipo)')], members: s.members, project: s.project })),
        importData: (data) => set(() => ({ ...sanitize(data), history: withLog(sanitize(data).history, log('project', null, 'update', 'Datos importados desde archivo')) })),
        replaceAll: (data) => set(() => sanitize(data)),
        clearHistory: () => set(() => ({ history: [] })),
      };
};

const persistOptions = {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s: PlannerState): PlannerData => ({ project: s.project, members: s.members, sprints: s.sprints, tasks: s.tasks, meetings: s.meetings, milestones: s.milestones, history: s.history }),
      merge: (persisted: unknown, current: PlannerState) => ({ ...current, ...sanitize(persisted as PlannerData) }),
    };

export const usePlanner = IS_ARTIFACT
  ? create<PlannerState>()((set, get) => creator(set as SetFn, get))
  : create<PlannerState>()(persist((set, get) => creator(set as SetFn, get), persistOptions as never));

/** Valida/normaliza datos externos (importación, almacenamiento antiguo, remoto). */
export function sanitize(raw: Partial<PlannerData> | undefined | null): PlannerData {
  if (!raw || typeof raw !== 'object') return createSeedData();
  const base = createEmptyData();
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    project: { ...base.project, ...(raw.project ?? {}) },
    members: arr<Member>(raw.members).filter((m) => m && m.id && m.name),
    sprints: arr<Sprint>(raw.sprints).filter((s) => s && s.id),
    tasks: arr<Task>(raw.tasks)
      .filter((t) => t && t.id && t.title)
      .map((t) => ({ ...buildTask({ title: t.title }), ...t, checklist: arr(t.checklist), comments: arr(t.comments), attachments: arr(t.attachments), collaboratorIds: arr(t.collaboratorIds) })),
    meetings: arr<Meeting>(raw.meetings).filter((m) => m && m.id).map((m) => ({ ...m, participantIds: arr(m.participantIds), actionItems: arr(m.actionItems) })),
    milestones: arr<Milestone>(raw.milestones).filter((m) => m && m.id),
    history: arr<HistoryEntry>(raw.history),
  };
}

export const selectData = (s: PlannerState): PlannerData => ({
  project: s.project, members: s.members, sprints: s.sprints, tasks: s.tasks, meetings: s.meetings, milestones: s.milestones, history: s.history,
});
