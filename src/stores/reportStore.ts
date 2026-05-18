import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { AIReport, ReportType } from '@/types';

interface ReportState {
  reports: AIReport[];
  loading: boolean;
  error: string | null;
  generating: boolean;

  loadAll: () => Promise<void>;
  loadByType: (type: ReportType) => Promise<void>;
  loadByTarget: (targetId: string) => Promise<void>;

  saveReport: (input: Omit<AIReport, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateReport: (id: string, patch: Partial<AIReport>) => Promise<void>;
  removeReport: (id: string) => Promise<void>;

  setGenerating: (v: boolean) => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  loading: false,
  error: null,
  generating: false,

  async loadAll() {
    set({ loading: true, error: null });
    try {
      const rows = await db.reports.orderBy('createdAt').reverse().toArray();
      set({ reports: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByType(type) {
    set({ loading: true, error: null });
    try {
      const rows = await db.reports.where('type').equals(type).reverse().sortBy('createdAt');
      set({ reports: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByTarget(targetId) {
    set({ loading: true, error: null });
    try {
      const rows = await db.reports
        .where('targetIds')
        .equals(targetId)
        .reverse()
        .sortBy('createdAt');
      set({ reports: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async saveReport(input) {
    const item: AIReport = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.reports.add(item);
    set((s) => ({ reports: [item, ...s.reports] }));
    return item.id;
  },

  async updateReport(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.reports.update(id, updated);
    set((s) => ({
      reports: s.reports.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    }));
  },

  async removeReport(id) {
    await db.reports.delete(id);
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
  },

  setGenerating(v) {
    set({ generating: v });
  },
}));
