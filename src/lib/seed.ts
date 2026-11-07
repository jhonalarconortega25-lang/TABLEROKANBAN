// Datos de prueba iniciales. Se cargan una sola vez en el almacenamiento y a partir
// de ahí son datos reales editables (se pueden borrar desde Configuración).
import type { ChecklistItem, Meeting, Member, PlannerData, Priority, Sprint, Task, TaskStatus } from '../types';
import { shiftISO, todayISO } from './dates';
import { uid } from './id';

const at = (iso: string, hour = 10) => `${iso}T${String(hour).padStart(2, '0')}:00:00.000Z`;

export function createSeedData(today = todayISO()): PlannerData {
  const d = (n: number) => shiftISO(today, n);
  const created = at(d(-28));

  const members: Member[] = [
    { id: uid(), name: 'Jhon', role: 'Project Manager (coordinador)', colorIndex: 0, createdAt: created },
    { id: uid(), name: 'Youssep', role: 'Alcance y EDT', colorIndex: 1, createdAt: created },
    { id: uid(), name: 'Mauricio', role: 'Cronograma y costos', colorIndex: 2, createdAt: created },
    { id: uid(), name: 'Gabriela', role: 'Riesgos y calidad', colorIndex: 3, createdAt: created },
    { id: uid(), name: 'Ashley', role: 'Interesados y comunicaciones', colorIndex: 4, createdAt: created },
  ];
  const [jhon, youssep, mauricio, gabriela, ashley] = members;
  const all = members.map((m) => m.id);

  const sprints: Sprint[] = [
    { id: uid(), number: 1, name: 'Inicio del proyecto', goal: 'Definir el proyecto y obtener la aprobación del acta de constitución.', startDate: d(-28), endDate: d(-15), ownerId: jhon.id, status: 'finished', createdAt: created },
    { id: uid(), number: 2, name: 'Planificación del alcance', goal: 'Recopilar requisitos y construir la EDT con su diccionario.', startDate: d(-14), endDate: d(-1), ownerId: youssep.id, status: 'finished', createdAt: created },
    { id: uid(), number: 3, name: 'Cronograma, costos y riesgos', goal: 'Completar la línea base de cronograma y costos y el plan de riesgos.', startDate: d(0), endDate: d(13), ownerId: mauricio.id, status: 'active', createdAt: created },
    { id: uid(), number: 4, name: 'Calidad, comunicaciones y recursos', goal: 'Cerrar los planes subsidiarios restantes.', startDate: d(14), endDate: d(27), ownerId: gabriela.id, status: 'planned', createdAt: created },
    { id: uid(), number: 5, name: 'Integración y entrega final', goal: 'Integrar el plan de dirección y preparar la exposición.', startDate: d(28), endDate: d(41), ownerId: jhon.id, status: 'planned', createdAt: created },
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
    mk('Elegir el proyecto a gestionar', { who: jhon, status: 'done', prio: 'high', sprint: s1, start: -28, due: -26, doneAt: -26, phase: 'Inicio', collab: [youssep, mauricio, gabriela, ashley], desc: 'Acordar en grupo el proyecto sobre el que se elaborará el plan de dirección.' }),
    mk('Acta de constitución del proyecto', { who: jhon, status: 'done', prio: 'high', sprint: s1, start: -26, due: -19, doneAt: -20, phase: 'Inicio', collab: [youssep], checklist: cl(['Justificación y objetivos', true], ['Supuestos y restricciones', true], ['Hitos principales', true], ['Firma del patrocinador', true]) }),
    mk('Registro de interesados', { who: ashley, status: 'done', prio: 'medium', sprint: s1, start: -24, due: -17, doneAt: -18, phase: 'Inicio', checklist: cl(['Identificar interesados', true], ['Matriz poder / interés', true]) }),
    mk('Recopilar requisitos (matriz de trazabilidad)', { who: youssep, status: 'done', prio: 'high', sprint: s2, start: -14, due: -9, doneAt: -9, phase: 'Alcance' }),
    mk('Enunciado del alcance', { who: youssep, status: 'done', prio: 'high', sprint: s2, start: -12, due: -6, doneAt: -6, phase: 'Alcance', collab: [jhon] }),
    mk('EDT y diccionario de la EDT', { who: youssep, status: 'review', prio: 'high', sprint: s2, start: -9, due: -2, phase: 'Alcance', weight: 3, collab: [mauricio], checklist: cl(['Descomposición hasta paquetes de trabajo', true], ['Diccionario de la EDT', true], ['Revisión del profesor', false]) }),
    mk('Lista de actividades y secuenciamiento (red)', { who: mauricio, status: 'in_progress', prio: 'high', sprint: s3, start: 0, due: 4, phase: 'Cronograma', checklist: cl(['Lista de actividades', true], ['Dependencias', false], ['Diagrama de red', false]) }),
    mk('Cronograma en MS Project y ruta crítica', { who: mauricio, status: 'pending', prio: 'high', sprint: s3, start: 3, due: 9, phase: 'Cronograma', weight: 3 }),
    mk('Estimación de costos y presupuesto (curva S)', { who: mauricio, status: 'pending', prio: 'medium', sprint: s3, start: 5, due: 12, phase: 'Costos', collab: [jhon], weight: 2 }),
    mk('Identificación de riesgos', { who: gabriela, status: 'in_progress', prio: 'high', sprint: s3, start: 0, due: 5, phase: 'Riesgos', checklist: cl(['Lluvia de ideas', true], ['Estructura de desglose de riesgos', false]) }),
    mk('Matriz de probabilidad e impacto y respuestas', { who: gabriela, status: 'pending', prio: 'medium', sprint: s3, start: 5, due: 12, phase: 'Riesgos' }),
    mk('Actualizar el registro de interesados', { who: ashley, status: 'pending', prio: 'low', sprint: s3, start: -1, due: -1, phase: 'Interesados', desc: 'Incluir a los nuevos interesados identificados en la revisión del alcance.' }),
    mk('Plan de gestión de la calidad', { who: gabriela, status: 'pending', prio: 'medium', sprint: s4, start: 14, due: 20, phase: 'Calidad' }),
    mk('Plan de comunicaciones', { who: ashley, status: 'pending', prio: 'medium', sprint: s4, start: 14, due: 21, phase: 'Comunicaciones' }),
    mk('Matriz RACI y plan de recursos', { who: jhon, status: 'pending', prio: 'medium', sprint: s4, start: 16, due: 24, phase: 'Recursos', collab: [ashley] }),
    mk('Plan de adquisiciones', { who: mauricio, status: 'pending', prio: 'low', sprint: s4, start: 18, due: 26, phase: 'Adquisiciones' }),
    mk('Integrar el plan para la dirección del proyecto', { who: jhon, status: 'pending', prio: 'high', sprint: s5, start: 28, due: 36, phase: 'Integración', collab: [youssep, mauricio, gabriela, ashley], weight: 3 }),
    mk('Preparar la exposición final', { who: ashley, status: 'pending', prio: 'high', sprint: s5, start: 34, due: 40, phase: 'Entrega', collab: [gabriela] }),
    mk('Revisar formato y referencias (APA 7)', { who: null, status: 'pending', prio: 'low', sprint: null, phase: 'Transversal' }),
  ];

  const meetings: Meeting[] = [
    { id: uid(), title: 'Revisión del alcance con el profesor', date: d(-3), time: '19:00', durationMin: 45, participantIds: all, objective: 'Validar la EDT antes de pasar al cronograma.', agenda: '1. Presentar la EDT\n2. Dudas sobre el diccionario\n3. Próximos entregables', agreements: 'Ajustar el nivel de detalle de los paquetes de trabajo.', actionItems: [], sprintId: s2.id, createdAt: created },
    { id: uid(), title: 'Reunión semanal del equipo', date: d(2), time: '20:00', durationMin: 30, participantIds: all, objective: 'Revisar avances del sprint 3.', agenda: '¿Qué avancé? ¿Qué haré? ¿Qué me bloquea?', agreements: '', actionItems: [], sprintId: s3.id, createdAt: created },
    { id: uid(), title: 'Sprint review – Sprint 3', date: d(13), time: '19:00', durationMin: 60, participantIds: all, objective: 'Revisar cronograma, presupuesto y riesgos, y planificar el sprint 4.', agenda: '1. Línea base de cronograma\n2. Curva S\n3. Matriz de riesgos\n4. Retrospectiva', agreements: '', actionItems: [{ id: uid(), text: 'Enviar avance al profesor', assigneeId: jhon.id, taskId: null }, { id: uid(), text: 'Subir los entregables a la carpeta compartida', assigneeId: ashley.id, taskId: null }], sprintId: s3.id, createdAt: created },
  ];

  return {
    project: {
      name: 'Proyecto – Gestión de Proyectos',
      description: 'Plan para la dirección del proyecto elaborado por el grupo: alcance, cronograma, costos, riesgos, calidad, comunicaciones y recursos.',
      startDate: d(-28),
      endDate: d(41),
      weightingMode: 'equal',
    },
    members,
    sprints,
    tasks,
    meetings,
    milestones: [
      { id: uid(), title: 'Entrega parcial: alcance y cronograma', date: d(10), description: 'Primera entrega del curso.', createdAt: created },
      { id: uid(), title: 'Exposición final', date: d(41), description: 'Presentación del plan de dirección del proyecto.', createdAt: created },
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
