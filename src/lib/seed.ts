// Datos de prueba iniciales. Se cargan una sola vez en el almacenamiento y a partir
// de ahí son datos reales editables (se pueden borrar desde Configuración).
import type { ChecklistItem, Meeting, Member, PlannerData, Priority, Sprint, Task, TaskStatus } from '../types';
import { shiftISO, todayISO } from './dates';
import { uid } from './id';

const at = (iso: string, hour = 10) => `${iso}T${String(hour).padStart(2, '0')}:00:00.000Z`;

export function createSeedData(today = todayISO()): PlannerData {
  const d = (n: number) => shiftISO(today, n);
  const created = at(d(-35));

  const members: Member[] = [
    { id: uid(), name: 'Jhon', role: 'Coordinador del proyecto', email: 'jhon@example.com', colorIndex: 0, createdAt: created },
    { id: uid(), name: 'Jeniffer', role: 'Analista de demanda e inventarios', colorIndex: 1, createdAt: created },
    { id: uid(), name: 'Franco', role: 'Especialista en procesos (SMED)', colorIndex: 2, createdAt: created },
  ];
  const [jhon, jen, franco] = members;

  const sprints: Sprint[] = [
    { id: uid(), number: 1, name: 'Diagnóstico inicial', goal: 'Entender la situación actual de la planta y definir el problema.', startDate: d(-35), endDate: d(-22), ownerId: jhon.id, status: 'finished', createdAt: created },
    { id: uid(), number: 2, name: 'Marco teórico y metodología', goal: 'Sustentar SMED, pronóstico de demanda y gestión de inventarios.', startDate: d(-21), endDate: d(-8), ownerId: jen.id, status: 'finished', createdAt: created },
    { id: uid(), number: 3, name: 'Recolección y análisis de datos', goal: 'Medir tiempos de setup y construir la base histórica de demanda.', startDate: d(-7), endDate: d(6), ownerId: franco.id, status: 'active', createdAt: created },
    { id: uid(), number: 4, name: 'Propuesta de mejora', goal: 'Diseñar la propuesta SMED y la política de inventarios.', startDate: d(7), endDate: d(20), ownerId: jhon.id, status: 'planned', createdAt: created },
    { id: uid(), number: 5, name: 'Validación y entrega final', goal: 'Evaluar impacto económico y preparar la sustentación.', startDate: d(21), endDate: d(42), ownerId: jen.id, status: 'planned', createdAt: created },
  ];
  const [s1, s2, s3, s4, s5] = sprints;

  const cl = (...items: [string, boolean][]): ChecklistItem[] => items.map(([text, done]) => ({ id: uid(), text, done }));

  const mk = (
    title: string,
    o: { desc?: string; who: Member | null; status: TaskStatus; prio: Priority; sprint: Sprint | null; start?: number; due?: number; doneAt?: number; phase: string; checklist?: ChecklistItem[]; collab?: Member[]; weight?: number },
  ): Task => ({
    id: uid(),
    title,
    description: o.desc ?? '',
    assigneeId: o.who?.id ?? null,
    collaboratorIds: (o.collab ?? []).map((m) => m.id),
    startDate: o.start !== undefined ? d(o.start) : null,
    dueDate: o.due !== undefined ? d(o.due) : null,
    status: o.status,
    priority: o.prio,
    sprintId: o.sprint?.id ?? null,
    phase: o.phase,
    checklist: o.checklist ?? [],
    comments: [],
    attachments: [],
    weight: o.weight ?? 1,
    meetingId: null,
    createdAt: created,
    updatedAt: created,
    completedAt: o.status === 'done' ? at(d(o.doneAt ?? o.due ?? 0), 16) : null,
  });

  const tasks: Task[] = [
    mk('Aprobación del título del proyecto', { who: franco, status: 'done', prio: 'medium', sprint: s1, start: -35, due: -32, doneAt: -33, phase: 'Planteamiento', desc: 'Título aprobado por el comité del curso Capstone.' }),
    mk('Visita diagnóstica a la planta', { who: jhon, status: 'done', prio: 'high', sprint: s1, start: -33, due: -29, doneAt: -30, phase: 'Diagnóstico', collab: [franco], desc: 'Recorrido por la línea de bastidores de madera de roble y entrevista con el jefe de producción.', checklist: cl(['Coordinar fecha con la empresa', true], ['Guía de entrevista', true], ['Registro fotográfico', true]) }),
    mk('Definir planteamiento del problema', { who: jhon, status: 'done', prio: 'high', sprint: s1, start: -30, due: -24, doneAt: -25, phase: 'Planteamiento', desc: 'Redactar y consensuar el problema, objetivos e hipótesis.', checklist: cl(['Árbol de problemas', true], ['Objetivo general y específicos', true]) }),
    mk('Levantamiento de antecedentes', { who: jen, status: 'done', prio: 'medium', sprint: s2, start: -21, due: -15, doneAt: -16, phase: 'Marco teórico', desc: 'Buscar tesis y papers sobre SMED y pronóstico de demanda en manufactura de madera.' }),
    mk('Marco teórico – Capítulo 2', { who: jhon, status: 'done', prio: 'high', sprint: s2, start: -20, due: -9, doneAt: -10, phase: 'Marco teórico', collab: [jen], checklist: cl(['SMED', true], ['Pronóstico de demanda', true], ['Modelos de inventario (EOQ, punto de reorden)', true]) }),
    mk('Diseño de la metodología', { who: jen, status: 'review', prio: 'high', sprint: s2, start: -14, due: -6, phase: 'Metodología', desc: 'Enfoque, diseño de investigación, población y muestra.', checklist: cl(['Matriz de consistencia', true], ['Operacionalización de variables', true], ['Validar con asesor', false]) }),
    mk('Medición de tiempos de setup (cambio de formato)', { who: franco, status: 'in_progress', prio: 'high', sprint: s3, start: -6, due: 2, phase: 'Recolección de datos', collab: [jhon], desc: 'Grabar y cronometrar los cambios de formato en la cortadora y la cepilladora.', checklist: cl(['Plantilla de toma de tiempos', true], ['Grabación turno mañana', true], ['Grabación turno tarde', false], ['Consolidar en Excel', false]) }),
    mk('Base histórica de ventas (24 meses)', { who: jen, status: 'in_progress', prio: 'high', sprint: s3, start: -5, due: 1, phase: 'Recolección de datos', checklist: cl(['Solicitar data al área comercial', true], ['Limpieza de datos', false], ['Gráfica de estacionalidad', false]) }),
    mk('Inventario físico de materia prima', { who: jhon, status: 'pending', prio: 'medium', sprint: s3, start: -2, due: -1, phase: 'Recolección de datos', desc: 'Conteo de tablones de roble por medida y calidad.' }),
    mk('Clasificación ABC de productos', { who: jen, status: 'pending', prio: 'medium', sprint: s3, start: 1, due: 5, phase: 'Análisis' }),
    mk('Diagrama de operaciones (DOP) actual', { who: franco, status: 'review', prio: 'low', sprint: s3, start: -4, due: 3, phase: 'Análisis' }),
    mk('Separar actividades internas y externas (SMED)', { who: franco, status: 'pending', prio: 'high', sprint: s4, start: 7, due: 12, phase: 'Propuesta', weight: 3 }),
    mk('Modelo de pronóstico de demanda', { who: jen, status: 'pending', prio: 'high', sprint: s4, start: 7, due: 15, phase: 'Propuesta', weight: 3, checklist: cl(['Promedio móvil', false], ['Suavizamiento exponencial', false], ['Holt-Winters', false], ['Comparar MAPE', false]) }),
    mk('Política de inventarios (EOQ + stock de seguridad)', { who: jhon, status: 'pending', prio: 'medium', sprint: s4, start: 12, due: 19, phase: 'Propuesta', weight: 2 }),
    mk('Evaluación económica de la propuesta', { who: jhon, status: 'pending', prio: 'medium', sprint: s5, start: 21, due: 30, phase: 'Validación', collab: [jen] }),
    mk('Redacción del informe final', { who: jen, status: 'pending', prio: 'high', sprint: s5, start: 25, due: 38, phase: 'Entrega' }),
    mk('Preparar presentación de sustentación', { who: franco, status: 'pending', prio: 'low', sprint: s5, start: 35, due: 41, phase: 'Entrega' }),
    mk('Actualizar bibliografía en formato APA 7', { who: null, status: 'pending', prio: 'low', sprint: null, phase: 'Transversal' }),
  ];

  const meetings: Meeting[] = [
    { id: uid(), title: 'Revisión con el asesor', date: d(-8), time: '18:00', durationMin: 60, participantIds: members.map((m) => m.id), objective: 'Revisar el capítulo 2 y la metodología.', agenda: '1. Observaciones al marco teórico\n2. Matriz de consistencia\n3. Próximos pasos', agreements: 'Ajustar la operacionalización de variables. Iniciar recolección de datos.', actionItems: [], sprintId: s2.id, createdAt: created },
    { id: uid(), title: 'Daily del equipo', date: d(1), time: '20:00', durationMin: 20, participantIds: members.map((m) => m.id), objective: 'Sincronizar avances del sprint 3.', agenda: '¿Qué hice? ¿Qué haré? ¿Bloqueos?', agreements: '', actionItems: [], sprintId: s3.id, createdAt: created },
    { id: uid(), title: 'Sprint review – Sprint 3', date: d(6), time: '19:00', durationMin: 60, participantIds: members.map((m) => m.id), objective: 'Presentar datos recolectados y cerrar el sprint.', agenda: '1. Demo de resultados\n2. Retrospectiva\n3. Planificación del sprint 4', agreements: '', actionItems: [{ id: uid(), text: 'Enviar acta al asesor', assigneeId: jhon.id, taskId: null }, { id: uid(), text: 'Validar data de ventas con el área comercial', assigneeId: jen.id, taskId: null }], sprintId: s3.id, createdAt: created },
    { id: uid(), title: 'Visita de validación en planta', date: d(14), time: '09:00', durationMin: 120, participantIds: [jhon.id, franco.id], objective: 'Validar la propuesta SMED con el jefe de producción.', agenda: '', agreements: '', actionItems: [], sprintId: s4.id, createdAt: created },
  ];

  return {
    project: {
      name: 'Capstone G09 – SMED e inventarios',
      description: 'Aplicación de SMED, planificación de la demanda y gestión de inventarios en la fabricación de bastidores de madera de roble.',
      startDate: d(-35),
      endDate: d(42),
      weightingMode: 'equal',
    },
    members,
    sprints,
    tasks,
    meetings,
    milestones: [
      { id: uid(), title: 'Entrega parcial (capítulos 1-3)', date: d(4), description: 'Entrega formal al curso.', createdAt: created },
      { id: uid(), title: 'Sustentación final', date: d(42), description: 'Presentación ante el jurado.', createdAt: created },
    ],
    history: [{ id: uid(), at: created, entity: 'project', entityId: null, action: 'create', summary: 'Proyecto creado con datos de ejemplo' }],
  };
}

export function createEmptyData(today = todayISO()): PlannerData {
  return {
    project: { name: 'Mi proyecto', description: '', startDate: today, endDate: shiftISO(today, 60), weightingMode: 'equal' },
    members: [],
    sprints: [],
    tasks: [],
    meetings: [],
    milestones: [],
    history: [],
  };
}
