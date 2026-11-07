import type { Meeting, Member, Milestone, Project, Sprint, Task } from '../types';
import { isValidISO } from './dates';

export type Errors<T> = Partial<Record<keyof T, string>>;

const required = (v: string | undefined | null, label: string, max = 120) => {
  if (!v || !v.trim()) return `${label} es obligatorio`;
  if (v.trim().length > max) return `Máximo ${max} caracteres`;
  return undefined;
};

const dateOrder = (start?: string | null, end?: string | null, msg = 'La fecha final no puede ser anterior a la inicial') =>
  start && end && isValidISO(start) && isValidISO(end) && end < start ? msg : undefined;

const clean = <T,>(e: Errors<T>): Errors<T> => {
  Object.keys(e).forEach((k) => e[k as keyof T] === undefined && delete e[k as keyof T]);
  return e;
};

export const hasErrors = (e: object) => Object.keys(e).length > 0;

export function validateTask(t: Partial<Task>): Errors<Task> {
  return clean<Task>({
    title: required(t.title, 'El nombre'),
    description: t.description && t.description.length > 5000 ? 'Máximo 5000 caracteres' : undefined,
    dueDate: dateOrder(t.startDate, t.dueDate, 'La fecha límite no puede ser anterior al inicio'),
    weight: t.weight !== undefined && (t.weight < 1 || t.weight > 5) ? 'El peso debe estar entre 1 y 5' : undefined,
  });
}

export function validateSprint(s: Partial<Sprint>, others: Sprint[] = []): Errors<Sprint> {
  return clean<Sprint>({
    name: required(s.name, 'El nombre', 80),
    number:
      !s.number || s.number < 1
        ? 'Número inválido'
        : others.some((o) => o.number === s.number && o.id !== s.id)
          ? 'Ya existe un sprint con ese número'
          : undefined,
    startDate: !isValidISO(s.startDate) ? 'Fecha de inicio obligatoria' : undefined,
    endDate: !isValidISO(s.endDate) ? 'Fecha de fin obligatoria' : dateOrder(s.startDate, s.endDate),
  });
}

export function validateMeeting(m: Partial<Meeting>): Errors<Meeting> {
  return clean<Meeting>({
    title: required(m.title, 'El nombre'),
    date: !isValidISO(m.date) ? 'La fecha es obligatoria' : undefined,
    time: !m.time || !/^\d{2}:\d{2}$/.test(m.time) ? 'La hora es obligatoria' : undefined,
    durationMin: m.durationMin !== undefined && (m.durationMin < 5 || m.durationMin > 600) ? 'Entre 5 y 600 minutos' : undefined,
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMember(m: Partial<Member>, others: Member[] = []): Errors<Member> {
  return clean<Member>({
    name:
      required(m.name, 'El nombre', 60) ??
      (others.some((o) => o.id !== m.id && o.name.trim().toLowerCase() === m.name!.trim().toLowerCase()) ? 'Ya existe un integrante con ese nombre' : undefined),
    role: m.role && m.role.length > 80 ? 'Máximo 80 caracteres' : undefined,
    email: m.email && !EMAIL.test(m.email) ? 'Correo no válido' : undefined,
  });
}

export function validateMilestone(m: Partial<Milestone>): Errors<Milestone> {
  return clean<Milestone>({ title: required(m.title, 'El nombre'), date: !isValidISO(m.date) ? 'La fecha es obligatoria' : undefined });
}

export function validateProject(p: Partial<Project>): Errors<Project> {
  return clean<Project>({
    name: required(p.name, 'El nombre', 100),
    startDate: !isValidISO(p.startDate) ? 'Fecha obligatoria' : undefined,
    endDate: !isValidISO(p.endDate) ? 'Fecha obligatoria' : dateOrder(p.startDate, p.endDate),
  });
}
