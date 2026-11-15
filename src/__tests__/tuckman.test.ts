import { describe, expect, it } from 'vitest';
import { tuckmanStage } from '../lib/tuckman';
import { createEmptyData } from '../lib/seed';
import type { PlannerData, Task, TaskStatus } from '../types';

const today = '2026-11-15';
let n = 0;
const task = (assigneeId: string, status: TaskStatus, dueDate: string | null): Task => ({
  id: `t${++n}`, title: `T${n}`, description: '', assigneeId, collaboratorIds: [], startDate: null, dueDate, status, priority: 'medium',
  sprintId: null, phase: '', checklist: [], comments: [], attachments: [], weight: 1, meetingId: null,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', completedAt: status === 'done' ? '2026-10-01T00:00:00Z' : null,
});
const base = (start = '2026-09-21', end = '2026-11-29'): PlannerData => {
  const d = createEmptyData(today);
  d.project = { ...d.project, startDate: start, endDate: end };
  d.members = ['a', 'b', 'c'].map((id, i) => ({ id, name: id.toUpperCase(), role: '', colorIndex: i, createdAt: '' }));
  return d;
};

describe('etapa de Tuckman', () => {
  it('Formación: inicio del proyecto, casi nada terminado', () => {
    const d = base('2026-11-10', '2027-02-01');
    d.tasks = [task('a', 'pending', '2026-12-01'), task('b', 'in_progress', '2026-12-05'), task('c', 'pending', null)];
    expect(tuckmanStage(d, today).stage).toBe('forming');
  });

  it('Conflicto: plazos incumplidos y atrasos acumulados', () => {
    const d = base();
    d.tasks = [task('a', 'done', '2026-10-01'), task('a', 'done', '2026-10-05'), task('b', 'pending', '2026-10-10'), task('c', 'pending', '2026-10-20'), task('b', 'pending', '2026-11-01'), task('c', 'done', '2026-10-02')];
    const r = tuckmanStage(d, today);
    expect(r.stage).toBe('storming');
    expect(r.behind.map((x) => x.name)).toEqual(expect.arrayContaining(['B', 'C']));
  });

  it('Normalización: cumple plazos pero el avance aún es medio', () => {
    const d = base();
    d.tasks = [task('a', 'done', '2026-10-01'), task('b', 'done', '2026-10-05'), task('c', 'done', '2026-10-08'), task('a', 'pending', '2026-11-20'), task('b', 'pending', '2026-11-22'), task('c', 'pending', '2026-11-25'), task('a', 'pending', '2026-11-26'), task('b', 'pending', '2026-11-27')];
    expect(tuckmanStage(d, today).stage).toBe('norming');
  });

  it('Desempeño: avance alto, plazos cumplidos y carga equilibrada', () => {
    const d = base();
    d.tasks = [task('a', 'done', '2026-10-01'), task('a', 'done', '2026-10-09'), task('b', 'done', '2026-10-05'), task('b', 'done', '2026-10-15'), task('c', 'done', '2026-10-08'), task('c', 'done', '2026-10-20'), task('c', 'review', '2026-11-20'), task('a', 'pending', '2026-11-25')];
    expect(tuckmanStage(d, today).stage).toBe('performing');
  });

  it('Disolución: proyecto terminado', () => {
    const d = base();
    d.tasks = [task('a', 'done', '2026-10-01'), task('b', 'done', '2026-10-05'), task('c', 'done', '2026-10-08')];
    expect(tuckmanStage(d, today).stage).toBe('adjourning');
  });

  it('las razones citan cifras reales', () => {
    const d = base();
    d.tasks = [task('a', 'done', '2026-10-01'), task('b', 'done', '2026-10-05'), task('c', 'pending', '2026-10-08')];
    const r = tuckmanStage(d, today);
    expect(r.reasons.join(' ')).toMatch(/67%/);
    expect(r.indicators.overdue).toBe(1);
  });
});
