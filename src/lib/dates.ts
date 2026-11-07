import { addDays, differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ISODate } from '../types';

export const toISODate = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const todayISO = (): ISODate => toISODate(new Date());
export const shiftISO = (base: ISODate, days: number): ISODate => toISODate(addDays(parseISO(base), days));
export const parse = (iso: string) => parseISO(iso);

export const isValidISO = (iso: string | null | undefined): iso is string => !!iso && isValid(parseISO(iso));

export const daysBetween = (from: ISODate, to: ISODate) => differenceInCalendarDays(parseISO(to), parseISO(from));

export const fmtDate = (iso: string | null | undefined, pattern = 'd MMM yyyy') =>
  isValidISO(iso) ? format(parseISO(iso), pattern, { locale: es }) : '—';

export const fmtShort = (iso: string | null | undefined) => fmtDate(iso, 'd MMM');

export const fmtDateTime = (iso: string) => (isValidISO(iso) ? format(parseISO(iso), "d MMM, HH:mm", { locale: es }) : '—');

export const relativeDays = (iso: ISODate, today = todayISO()) => {
  const d = daysBetween(today, iso);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  return d > 0 ? `en ${d} días` : `hace ${-d} días`;
};

export const nowISO = () => new Date().toISOString();
