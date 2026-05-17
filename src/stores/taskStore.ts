import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { SchoolTask, TaskStatus, TaskCategory, TaskPriority } from '@/types';

interface TaskFilters {
  category?: TaskCategory;
  status?: TaskStatus;
  priority?: TaskPriority;
  keyword?: string;
}

interface TaskState {
  tasks: SchoolTask[];
  loading: boolean;
  error: string | null;
  filters: TaskFilters;

  loadAll: () => Promise<void>;
  setFilters: (patch: Partial<TaskFilters>) => void;
  clearFilters: () => void;
  filtered: () => SchoolTask[];

  addTask: (input: Omit<SchoolTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (id: string, patch: Partial<SchoolTask>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  setStatus: (id: string, status: TaskStatus) => Promise<void>;

  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  addChecklistItem: (taskId: string, text: string) => Promise<void>;
  removeChecklistItem: (taskId: string, itemId: string) => Promise<void>;

  /** 오늘 기준 임박/지연 업무 */
  upcoming: (days?: number) => SchoolTask[];
  overdue: () => SchoolTask[];
}

const today = () => new Date().toISOString().slice(0, 10);

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  filters: {},

  async loadAll() {
    set({ loading: true, error: null });
    try {
      const rows = await db.tasks.toArray();
      rows.sort((a, b) => {
        // 우선순위: 진행중 > 대기 > 보류 > 완료, 그 다음 마감일 오름차순
        const statusOrder: Record<TaskStatus, number> = {
          진행중: 0,
          대기: 1,
          보류: 2,
          완료: 3,
        };
        const so = statusOrder[a.status] - statusOrder[b.status];
        if (so !== 0) return so;
        return (a.dueDate ?? '9999-12-31').localeCompare(
          b.dueDate ?? '9999-12-31'
        );
      });
      set({ tasks: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
  clearFilters() {
    set({ filters: {} });
  },

  filtered() {
    const { tasks, filters } = get();
    const k = filters.keyword?.toLowerCase().trim();
    return tasks.filter((t) => {
      if (filters.category && t.category !== filters.category) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (k) {
        const hay = (t.title + ' ' + (t.description ?? '')).toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  },

  async addTask(input) {
    const item: SchoolTask = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.tasks.add(item);
    set((s) => ({ tasks: [item, ...s.tasks] }));
    return item.id;
  },

  async updateTask(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.tasks.update(id, updated);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
    }));
  },

  async removeTask(id) {
    await db.tasks.delete(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  async setStatus(id, status) {
    const completedAt = status === '완료' ? now() : undefined;
    await get().updateTask(id, { status, completedAt });
  },

  async toggleChecklistItem(taskId, itemId) {
    const t = get().tasks.find((x) => x.id === taskId);
    if (!t?.checklist) return;
    const next = t.checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c
    );
    await get().updateTask(taskId, { checklist: next });
  },

  async addChecklistItem(taskId, text) {
    const t = get().tasks.find((x) => x.id === taskId);
    if (!t) return;
    const next = [
      ...(t.checklist ?? []),
      { id: uid(), text, done: false },
    ];
    await get().updateTask(taskId, { checklist: next });
  },

  async removeChecklistItem(taskId, itemId) {
    const t = get().tasks.find((x) => x.id === taskId);
    if (!t?.checklist) return;
    const next = t.checklist.filter((c) => c.id !== itemId);
    await get().updateTask(taskId, { checklist: next });
  },

  upcoming(days = 7) {
    const from = today();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + days);
    const to = toDate.toISOString().slice(0, 10);
    return get().tasks.filter(
      (t) =>
        t.status !== '완료' &&
        t.dueDate &&
        t.dueDate >= from &&
        t.dueDate <= to
    );
  },

  overdue() {
    const t = today();
    return get().tasks.filter(
      (x) => x.status !== '완료' && x.dueDate && x.dueDate < t
    );
  },
}));
