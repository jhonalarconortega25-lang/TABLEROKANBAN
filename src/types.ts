// Modelo de datos normalizado. Todas las entidades se relacionan por ID;
// ninguna vista guarda copias: todo se deriva de esta única fuente.

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string;

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type SprintStatus = 'planned' | 'active' | 'finished';
/** Preparado para ponderación futura: 'equal' = todas pesan 1. */
export type WeightingMode = 'equal' | 'weighted';

export interface Project {
  name: string;
  description: string;
  startDate: ISODate;
  endDate: ISODate;
  weightingMode: WeightingMode;
}

export interface Member {
  id: ID;
  name: string;
  role: string;
  email?: string;
  avatarUrl?: string;
  colorIndex: number; // posición fija en la paleta categórica
  createdAt: ISODateTime;
}

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Comment {
  id: ID;
  authorId: ID | null;
  text: string;
  createdAt: ISODateTime;
}

export interface Attachment {
  id: ID;
  name: string;
  url: string; // enlace externo o data URL (archivos pequeños)
  size?: number;
  mime?: string;
  addedAt: ISODateTime;
}

export interface Task {
  id: ID;
  title: string;
  description: string;
  assigneeId: ID | null;
  collaboratorIds: ID[];
  startDate: ISODate | null;
  dueDate: ISODate | null;
  status: TaskStatus;
  priority: Priority;
  sprintId: ID | null;
  phase: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  /** Peso por complejidad (1-5). Solo se usa con weightingMode = 'weighted'. */
  weight: number;
  meetingId: ID | null; // reunión de origen, si la hay
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface Sprint {
  id: ID;
  number: number;
  name: string;
  goal: string;
  startDate: ISODate;
  endDate: ISODate;
  ownerId: ID | null;
  status: SprintStatus;
  createdAt: ISODateTime;
}

export interface ActionItem {
  id: ID;
  text: string;
  assigneeId: ID | null;
  taskId: ID | null; // tarea generada a partir del acuerdo
}

export interface Meeting {
  id: ID;
  title: string;
  date: ISODate;
  time: string; // 'HH:mm'
  durationMin: number;
  participantIds: ID[];
  objective: string;
  agenda: string;
  agreements: string;
  actionItems: ActionItem[];
  sprintId: ID | null;
  createdAt: ISODateTime;
}

export interface Milestone {
  id: ID;
  title: string;
  date: ISODate;
  description: string;
  createdAt: ISODateTime;
}

export type EntityKind = 'task' | 'sprint' | 'meeting' | 'member' | 'milestone' | 'project';

export interface HistoryEntry {
  id: ID;
  at: ISODateTime;
  entity: EntityKind;
  entityId: ID | null;
  action: 'create' | 'update' | 'delete' | 'status' | 'move' | 'complete';
  summary: string;
}

export interface PlannerData {
  project: Project;
  members: Member[];
  sprints: Sprint[];
  tasks: Task[];
  meetings: Meeting[];
  milestones: Milestone[];
  history: HistoryEntry[];
}
