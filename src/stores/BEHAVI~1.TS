import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { BehaviorNote, BehaviorCategory } from '@/types';

interface BehaviorState {
  notes: BehaviorNote[];
  loading: boolean;
  error: string | null;

  loadByStudent: (studentId: string) => Promise<void>;
  loadByClass: (classId: string, from?: string, to?: string) => Promise<void>;
  search: (keyword: string) => BehaviorNote[];

  addNote: (input: Omit<BehaviorNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNote: (id: string, patch: Partial<BehaviorNote>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  byCategory: (studentId: string) => Record<BehaviorCategory, BehaviorNote[]>;
}

export const useBehaviorStore = create<BehaviorState>((set, get) => ({
  notes: [],
  loading: false,
  error: null,

  async loadByStudent(studentId) {
    set({ loading: true, error: null });
    try {
      const rows = await db.behaviorNotes
        .where('studentId')
        .equals(studentId)
        .reverse()
        .sortBy('date');
      set({ notes: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByClass(classId, from, to) {
    set({ loading: true, error: null });
    try {
      let rows = await db.behaviorNotes
        .where('classId')
        .equals(classId)
        .toArray();
      if (from) rows = rows.filter((r) => r.date >= from);
      if (to) rows = rows.filter((r) => r.date <= to);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      set({ notes: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  search(keyword) {
    const k = keyword.toLowerCase().trim();
    if (!k) return get().notes;
    return get().notes.filter(
      (n) =>
        n.content.toLowerCase().includes(k) ||
        n.tags?.some((t) => t.toLowerCase().includes(k)) ||
        n.category.toLowerCase().includes(k)
    );
  },

  async addNote(input) {
    const item: BehaviorNote = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.behaviorNotes.add(item);
    set((s) => ({ notes: [item, ...s.notes] }));
    return item.id;
  },

  async updateNote(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.behaviorNotes.update(id, updated);
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updated } : n)),
    }));
  },

  async removeNote(id) {
    await db.behaviorNotes.delete(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  byCategory(studentId) {
    const result: Record<BehaviorCategory, BehaviorNote[]> = {
      학습태도: [],
      교우관계: [],
      리더십: [],
      봉사: [],
      특기: [],
      진로: [],
      상담: [],
      기타: [],
    };
    for (const n of get().notes) {
      if (n.studentId === studentId) result[n.category].push(n);
    }
    return result;
  },
}));
