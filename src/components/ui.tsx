import { useEffect, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import type { Member, Priority, SprintStatus, TaskStatus } from '../types';
import { PRIORITY_META, SPRINT_STATUS_META, STATUS_META, colorFor } from '../lib/constants';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm font-semibold',
  secondary: 'bg-white text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

export function Button({ variant = 'secondary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...p}
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500', className)}
    />
  );
}

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx('min-w-0 rounded-2xl border-2 border-dashed border-brand-300/80 bg-white', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h3 className="font-display text-[13px] font-extrabold uppercase tracking-wide text-brand-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const pill = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap';

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <span className={cx(pill, STATUS_META[status].badge)}>
    <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_META[status].dot)} />
    {STATUS_META[status].label}
  </span>
);

export const PriorityBadge = ({ priority, compact }: { priority: Priority; compact?: boolean }) => (
  <span className={cx(pill, PRIORITY_META[priority].badge)} title={`Prioridad ${PRIORITY_META[priority].label}`}>
    <span className={cx('h-1.5 w-1.5 rounded-full', PRIORITY_META[priority].bar)} />
    {!compact && PRIORITY_META[priority].label}
  </span>
);

export const SprintStatusBadge = ({ status }: { status: SprintStatus }) => <span className={cx(pill, SPRINT_STATUS_META[status].badge)}>{SPRINT_STATUS_META[status].label}</span>;

export const Tag = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx(pill, 'bg-slate-50 text-slate-600 ring-slate-200', className)}>{children}</span>
);

export function Avatar({ member, size = 24, ring }: { member?: Member | null; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, fontSize: Math.max(9, size * 0.42) };
  if (!member)
    return (
      <span style={style} title="Sin asignar" className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400', ring && 'ring-2 ring-white')}>
        ?
      </span>
    );
  if (member.avatarUrl)
    return <img src={member.avatarUrl} alt={member.name} title={member.name} style={style} className={cx('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-white')} />;
  const initials = member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span title={member.name} style={{ ...style, background: colorFor(member.colorIndex) }} className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', ring && 'ring-2 ring-white')}>
      {initials}
    </span>
  );
}

export function AvatarStack({ members, size = 22, max = 4 }: { members: Member[]; size?: number; max?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {members.slice(0, max).map((m) => <Avatar key={m.id} member={m} size={size} ring />)}
      {members.length > max && <span className="inline-flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white" style={{ width: size, height: size }}>+{members.length - max}</span>}
    </span>
  );
}

export function ProgressBar({ value, className, tone = 'brand', height = 6 }: { value: number; className?: string; tone?: 'brand' | 'green'; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-brand-50 ring-1 ring-inset ring-brand-100', className)} style={{ height }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out', v === 100 || tone === 'green' ? 'bg-brand-800' : 'bg-brand-600')} style={{ width: `${v}%` }} />
    </div>
  );
}

// ---------- Formularios ----------
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:bg-slate-50';

export function Input({ invalid, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...p} className={cx(inputBase, 'h-9', invalid ? 'border-red-400' : 'border-slate-200', className)} />;
}

export function Textarea({ invalid, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...p} className={cx(inputBase, 'py-2 leading-relaxed', invalid ? 'border-red-400' : 'border-slate-200', className)} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(inputBase, 'h-9 border-slate-200 pr-8 cursor-pointer', className)}>
      {children}
    </select>
  );
}

// ---------- Overlays ----------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl animate-fade-in sm:rounded-2xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-center justify-between rounded-t-2xl bg-brand-600 px-5 py-3.5">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-white">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose} className="!text-white/80 hover:!bg-white/15 hover:!text-white"><X size={18} /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-brand-700 sm:text-[28px]">{title}</h1>
        <span className="mt-1.5 block h-1 w-14 rounded-full bg-gold-500" aria-hidden />
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-full bg-brand-50 p-0.5 ring-1 ring-brand-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('rounded-full px-3 py-1 text-xs font-semibold transition-colors', value === o.value ? 'bg-brand-600 text-white shadow-sm' : 'text-brand-700 hover:bg-brand-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
