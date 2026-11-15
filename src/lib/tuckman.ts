// Interpretación de la etapa del equipo según el modelo de Tuckman
// (Formación → Conflicto → Normalización → Desempeño → Disolución),
// calculada a partir de los datos reales del planner. Es orientativa:
// usa indicadores de avance, cumplimiento de plazos y reparto del trabajo.
import type { ISODate, PlannerData } from '../types';
import { expectedProgress, memberStats, progressOf } from './metrics';
import { todayISO } from './dates';

export type TuckmanStage = 'forming' | 'storming' | 'norming' | 'performing' | 'adjourning';

export const TUCKMAN_STAGES: { key: TuckmanStage; name: string; en: string; summary: string; tip: string }[] = [
  {
    key: 'forming',
    name: 'Formación',
    en: 'Forming',
    summary: 'El equipo se está conociendo: se definen objetivos, roles y forma de trabajo, y todavía hay pocas entregas.',
    tip: 'Acordar roles y responsabilidades (matriz RACI), normas de trabajo y canales de comunicación.',
  },
  {
    key: 'storming',
    name: 'Conflicto',
    en: 'Storming',
    summary: 'Aparecen tensiones: el trabajo está desbalanceado o se acumulan atrasos, señal de diferencias en prioridades o métodos.',
    tip: 'Hacer una retrospectiva honesta, redistribuir actividades y renegociar fechas con el responsable de cada una.',
  },
  {
    key: 'norming',
    name: 'Normalización',
    en: 'Norming',
    summary: 'El equipo ya tiene reglas y ritmo: cumple la mayoría de plazos y el trabajo está razonablemente repartido.',
    tip: 'Mantener las reuniones de seguimiento y reforzar la colaboración para acelerar el avance.',
  },
  {
    key: 'performing',
    name: 'Desempeño',
    en: 'Performing',
    summary: 'El equipo trabaja de forma autónoma y coordinada: cumple sus plazos, reparte bien la carga y el avance es alto.',
    tip: 'Sostener el ritmo, cerrar a tiempo las actividades en revisión y preparar la integración final.',
  },
  {
    key: 'adjourning',
    name: 'Disolución',
    en: 'Adjourning',
    summary: 'El proyecto está prácticamente terminado: se cierran entregables y se recogen lecciones aprendidas.',
    tip: 'Documentar lecciones aprendidas, reconocer el trabajo de cada integrante y cerrar formalmente el proyecto.',
  },
];

export interface TuckmanIndicators {
  progress: number; // % avance del proyecto
  expected: number; // % esperado por tiempo transcurrido
  onTime: number | null; // % de actividades ya vencidas que se completaron
  dueCount: number;
  balance: number | null; // menor / mayor nº de completadas entre integrantes con tareas (0-1)
  minDone: number;
  maxDone: number;
  overdue: number;
  activeMembers: number;
  collaboration: number; // % de actividades con colaboradores
}

export interface TuckmanResult {
  stage: TuckmanStage;
  indicators: TuckmanIndicators;
  reasons: string[];
  behind: { name: string; overdue: number }[];
}

export function tuckmanStage(data: PlannerData, today: ISODate = todayISO()): TuckmanResult {
  const { tasks, project } = data;
  const progress = progressOf(tasks, project.weightingMode);
  const expected = expectedProgress(project.startDate, project.endDate, today);
  const due = tasks.filter((t) => t.dueDate && t.dueDate < today);
  const onTime = due.length ? Math.round((due.filter((t) => t.status === 'done').length / due.length) * 100) : null;
  const people = memberStats(data, today).filter((m) => m.assigned > 0);
  const done = people.map((m) => m.completed);
  const maxDone = done.length ? Math.max(...done) : 0;
  const minDone = done.length ? Math.min(...done) : 0;
  const balance = people.length >= 2 && maxDone > 0 ? Math.round((minDone / maxDone) * 100) / 100 : null;
  const overdue = people.reduce((s, m) => s + m.overdue, 0) + tasks.filter((t) => !t.assigneeId && t.status !== 'done' && t.dueDate && t.dueDate < today).length;
  const open = tasks.filter((t) => t.status !== 'done').length;
  const collaboration = tasks.length ? Math.round((tasks.filter((t) => t.collaboratorIds.length > 0).length / tasks.length) * 100) : 0;
  const indicators: TuckmanIndicators = { progress, expected, onTime, dueCount: due.length, balance, minDone, maxDone, overdue, activeMembers: people.length, collaboration };
  const behind = people.filter((m) => m.overdue > 0).map((m) => ({ name: m.member.name, overdue: m.overdue })).sort((a, b) => b.overdue - a.overdue);

  const reasons: string[] = [];
  const pushBase = () => {
    reasons.push(`Avance del proyecto: ${progress}% (esperado por el tiempo transcurrido: ${expected}%).`);
    if (onTime !== null) reasons.push(`Se completó el ${onTime}% de las actividades cuya fecha límite ya pasó (${due.filter((t) => t.status === 'done').length} de ${due.length}).`);
    if (balance !== null) reasons.push(`Reparto del trabajo: cada integrante completó entre ${minDone} y ${maxDone} actividades (equilibrio ${Math.round(balance * 100)}%).`);
    reasons.push(overdue === 0 ? 'No hay actividades atrasadas.' : `Hay ${overdue} actividad${overdue === 1 ? '' : 'es'} atrasada${overdue === 1 ? '' : 's'}.`);
  };

  let stage: TuckmanStage;
  const finished = progress >= 95 || (data.sprints.length > 0 && data.sprints.every((s) => s.status === 'finished')) || today > project.endDate;
  const overdueShare = open ? overdue / open : 0;
  if (finished) {
    stage = 'adjourning';
    reasons.push(today > project.endDate ? 'La fecha estimada de fin del proyecto ya pasó.' : 'Casi todas las actividades y sprints están cerrados.');
    pushBase();
  } else if (tasks.length === 0 || progress < 15 || expected < 15 || maxDone === 0) {
    stage = 'forming';
    reasons.push(tasks.length === 0 ? 'Todavía no hay actividades registradas.' : 'El proyecto está en su etapa inicial y hay pocas actividades completadas.');
    pushBase();
  } else if ((onTime !== null && onTime < 70) || (balance !== null && balance < 0.4) || overdueShare > 0.25) {
    stage = 'storming';
    if (onTime !== null && onTime < 70) reasons.push('Menos del 70% de lo que ya venció está terminado: los plazos no se están cumpliendo.');
    if (balance !== null && balance < 0.4) reasons.push('La carga completada está muy desbalanceada entre integrantes.');
    if (overdueShare > 0.25) reasons.push('Más de un cuarto de las actividades abiertas está atrasado.');
    pushBase();
  } else if (progress >= 50 && (onTime === null || onTime >= 85) && (balance === null || balance >= 0.6)) {
    stage = 'performing';
    pushBase();
  } else {
    stage = 'norming';
    pushBase();
  }
  return { stage, indicators, reasons, behind };
}
