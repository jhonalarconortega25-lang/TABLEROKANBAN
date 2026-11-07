import { create } from 'zustand';
import type { ID, ISODate, TaskStatus } from '../types';
import { uid } from '../lib/id';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: string; kind: ToastKind; text: string }

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export interface TaskDraftDefaults { status?: TaskStatus; sprintId?: ID | null; dueDate?: ISODate; assigneeId?: ID | null }

interface UIState {
  toasts: Toast[];
  confirmReq: ConfirmRequest | null;
  openTaskId: ID | null;
  newTask: TaskDraftDefaults | null;
  meetingEditor: { id: ID | null; date?: ISODate } | null;
  sidebarOpen: boolean;
  toast: (text: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
  confirm: (req: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
  openTask: (id: ID | null) => void;
  openNewTask: (defaults?: TaskDraftDefaults) => void;
  closeNewTask: () => void;
  openMeeting: (id: ID | null, date?: ISODate) => void;
  closeMeeting: () => void;
  setSidebar: (open: boolean) => void;
}

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  confirmReq: null,
  openTaskId: null,
  newTask: null,
  meetingEditor: null,
  sidebarOpen: false,
  toast: (text, kind = 'success') => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  confirm: (req) => new Promise<boolean>((resolve) => set({ confirmReq: { ...req, resolve } })),
  resolveConfirm: (ok) => {
    get().confirmReq?.resolve(ok);
    set({ confirmReq: null });
  },
  openTask: (id) => set({ openTaskId: id }),
  openNewTask: (defaults = {}) => set({ newTask: defaults }),
  closeNewTask: () => set({ newTask: null }),
  openMeeting: (id, date) => set({ meetingEditor: { id, date } }),
  closeMeeting: () => set({ meetingEditor: null }),
  setSidebar: (open) => set({ sidebarOpen: open }),
}));
