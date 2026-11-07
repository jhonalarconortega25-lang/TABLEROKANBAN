import { beforeEach, describe, expect, it } from 'vitest';
import { usePlanner, selectData, STORAGE_KEY } from '../store/usePlanner';
import { countTasks, filterTasks, memberStats, progressOf, sprintStats, completedPerWeek, emptyFilters, isOverdue, checklistProgress } from '../lib/metrics';
import { shiftISO, todayISO } from '../lib/dates';
import { validateSprint, validateTask, validateMember } from '../lib/validation';

const S = () => usePlanner.getState();
const data = () => selectData(S());
const today = todayISO();

beforeEach(() => {
  S().clearAll();
});

describe('cálculo de avance', () => {
  it('avance = completadas / total × 100 con pesos iguales', () => {
    const a = S().addTask({ title: 'A' });
    S().addTask({ title: 'B' });
    S().addTask({ title: 'C' });
    S().addTask({ title: 'D' });
    expect(progressOf(S().tasks)).toBe(0);
    S().setTaskStatus(a.id, 'done');
    expect(progressOf(S().tasks)).toBe(25);
  });

  it('sin actividades el avance es 0 y la ponderación usa los pesos', () => {
    expect(progressOf([])).toBe(0);
    const a = S().addTask({ title: 'Grande', weight: 3 });
    S().addTask({ title: 'Pequeña', weight: 1 });
    S().setTaskStatus(a.id, 'done');
    expect(progressOf(S().tasks, 'equal')).toBe(50);
    expect(progressOf(S().tasks, 'weighted')).toBe(75);
  });
});

describe('flujos de actividades', () => {
  it('crear, editar, asignar, completar y eliminar actualiza los indicadores', () => {
    const m = S().addMember({ name: 'Ana', role: 'Dev' });
    const t = S().addTask({ title: 'Tarea 1', dueDate: shiftISO(today, 3) });
    expect(countTasks(S().tasks).total).toBe(1);

    S().updateTask(t.id, { assigneeId: m.id, priority: 'high' });
    let ms = memberStats(data())[0];
    expect(ms.assigned).toBe(1);
    expect(ms.open).toBe(1);

    S().updateTask(t.id, { status: 'done' });
    const done = S().tasks[0];
    expect(done.completedAt).not.toBeNull();
    ms = memberStats(data())[0];
    expect(ms.completed).toBe(1);
    expect(ms.progress).toBe(100);

    S().updateTask(t.id, { status: 'in_progress' });
    expect(S().tasks[0].completedAt).toBeNull();

    S().deleteTask(t.id);
    expect(countTasks(S().tasks).total).toBe(0);
    expect(memberStats(data())[0].assigned).toBe(0);
    expect(S().history[0].summary).toMatch(/eliminada/);
  });

  it('cambio de responsable mueve la carga de trabajo', () => {
    const a = S().addMember({ name: 'A', role: '' });
    const b = S().addMember({ name: 'B', role: '' });
    const t = S().addTask({ title: 'X', assigneeId: a.id });
    S().updateTask(t.id, { assigneeId: b.id });
    const stats = memberStats(data());
    expect(stats.find((s) => s.member.id === a.id)!.assigned).toBe(0);
    expect(stats.find((s) => s.member.id === b.id)!.assigned).toBe(1);
  });

  it('tarea vencida y no completada aparece como atrasada', () => {
    const t = S().addTask({ title: 'Vieja', dueDate: shiftISO(today, -2) });
    expect(countTasks(S().tasks).overdue).toBe(1);
    expect(isOverdue(S().tasks[0])).toBe(true);
    S().updateTask(t.id, { dueDate: shiftISO(today, 5) });
    expect(countTasks(S().tasks).overdue).toBe(0);
    S().updateTask(t.id, { dueDate: shiftISO(today, -1), status: 'done' });
    expect(countTasks(S().tasks).overdue).toBe(0);
  });

  it('checklist: añadir, completar y eliminar subtareas', () => {
    const t = S().addTask({ title: 'Con checklist' });
    S().addChecklistItem(t.id, 'uno');
    S().addChecklistItem(t.id, 'dos');
    const [i1, i2] = S().tasks[0].checklist;
    S().updateChecklistItem(t.id, i1.id, { done: true });
    expect(checklistProgress(S().tasks[0])).toBe(50);
    S().removeChecklistItem(t.id, i2.id);
    expect(checklistProgress(S().tasks[0])).toBe(100);
    S().addComment(t.id, 'Hola', null);
    expect(S().tasks[0].comments).toHaveLength(1);
  });
});

describe('sprints', () => {
  it('completar todas las tareas de un sprint lo lleva al 100%', () => {
    const sp = S().addSprint({ number: 1, name: 'S1', goal: '', startDate: today, endDate: shiftISO(today, 13), ownerId: null, status: 'active' });
    const a = S().addTask({ title: 'a', sprintId: sp.id });
    const b = S().addTask({ title: 'b', sprintId: sp.id });
    S().setTaskStatus(a.id, 'done');
    expect(sprintStats(data())[0].progress).toBe(50);
    S().setTaskStatus(b.id, 'done');
    expect(sprintStats(data())[0].progress).toBe(100);
  });

  it('mover tareas entre sprints y eliminar un sprint las devuelve al backlog', () => {
    const s1 = S().addSprint({ number: 1, name: 'S1', goal: '', startDate: today, endDate: today, ownerId: null, status: 'planned' });
    const s2 = S().addSprint({ number: 2, name: 'S2', goal: '', startDate: today, endDate: today, ownerId: null, status: 'planned' });
    const t = S().addTask({ title: 't', sprintId: s1.id });
    S().moveTasksToSprint([t.id], s2.id);
    expect(sprintStats(data()).find((x) => x.sprint.id === s2.id)!.tasks).toHaveLength(1);
    S().deleteSprint(s2.id);
    expect(S().tasks[0].sprintId).toBeNull();
  });
});

describe('reuniones', () => {
  it('genera tareas desde acuerdos y se convierte en actividad', () => {
    const m = S().addMeeting({ title: 'Review', date: today, time: '10:00', durationMin: 30, participantIds: [], objective: 'o', agenda: 'a', agreements: '', actionItems: [{ id: 'ai1', text: 'Enviar acta', assigneeId: null, taskId: null }], sprintId: null });
    const t = S().createTaskFromActionItem(m.id, 'ai1')!;
    expect(t.meetingId).toBe(m.id);
    expect(S().meetings[0].actionItems[0].taskId).toBe(t.id);
    expect(S().createTaskFromActionItem(m.id, 'ai1')).toBeUndefined(); // no duplica
    const conv = S().convertMeetingToTask(m.id)!;
    expect(conv.checklist).toHaveLength(1);
    expect(S().tasks).toHaveLength(2);
  });
});

describe('integridad referencial', () => {
  it('eliminar un integrante limpia sus referencias', () => {
    const a = S().addMember({ name: 'A', role: '' });
    const b = S().addMember({ name: 'B', role: '' });
    S().addTask({ title: 't', assigneeId: a.id, collaboratorIds: [a.id, b.id] });
    S().deleteMember(a.id);
    expect(S().tasks[0].assigneeId).toBeNull();
    expect(S().tasks[0].collaboratorIds).toEqual([b.id]);
  });
});

describe('filtros', () => {
  it('filtra por responsable, prioridad, sprint, estado y fecha', () => {
    const m = S().addMember({ name: 'Ana', role: '' });
    S().addTask({ title: 'Diseño de encuesta', assigneeId: m.id, priority: 'high', dueDate: shiftISO(today, 2) });
    S().addTask({ title: 'Otra', priority: 'low', dueDate: shiftISO(today, -3) });
    const tasks = S().tasks;
    expect(filterTasks(tasks, { ...emptyFilters, assigneeId: m.id })).toHaveLength(1);
    expect(filterTasks(tasks, { ...emptyFilters, assigneeId: 'none' })).toHaveLength(1);
    expect(filterTasks(tasks, { ...emptyFilters, priority: 'low' })).toHaveLength(1);
    expect(filterTasks(tasks, { ...emptyFilters, due: 'overdue' })[0].title).toBe('Otra');
    expect(filterTasks(tasks, { ...emptyFilters, due: 'week' })).toHaveLength(1);
    expect(filterTasks(tasks, { ...emptyFilters, query: 'diseno' })).toHaveLength(1); // ignora tildes
    expect(filterTasks(tasks, { ...emptyFilters, sprintId: 'none' })).toHaveLength(2);
  });
});

describe('estadísticas semanales y persistencia', () => {
  it('cuenta completadas por semana', () => {
    const t = S().addTask({ title: 'x' });
    S().setTaskStatus(t.id, 'done');
    const w = completedPerWeek(S().tasks, 4);
    expect(w).toHaveLength(4);
    expect(w[3].completed).toBe(1);
    expect(w[3].cumulative).toBe(1);
  });

  it('guarda automáticamente en el almacenamiento', () => {
    S().addTask({ title: 'Persistida' });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.tasks.map((t: { title: string }) => t.title)).toContain('Persistida');
  });

  it('los datos de ejemplo son coherentes', () => {
    S().loadDemo();
    const d = data();
    const ids = new Set(d.members.map((m) => m.id));
    expect(d.tasks.every((t) => !t.assigneeId || ids.has(t.assigneeId))).toBe(true);
    expect(d.sprints.filter((s) => s.status === 'active')).toHaveLength(1);
    expect(progressOf(d.tasks)).toBeGreaterThan(0);
  });
});

describe('validación', () => {
  it('rechaza datos inválidos', () => {
    expect(validateTask({ title: '  ' }).title).toBeDefined();
    expect(validateTask({ title: 'ok', startDate: '2026-05-10', dueDate: '2026-05-01' }).dueDate).toBeDefined();
    expect(validateSprint({ name: 'S', number: 1, startDate: '2026-01-01', endDate: '2026-01-02' }, [{ id: 'x', number: 1 } as never]).number).toBeDefined();
    expect(validateMember({ name: 'A', email: 'no-es-correo' }).email).toBeDefined();
  });
});
