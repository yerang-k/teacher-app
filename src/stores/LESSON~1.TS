import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { Lesson, LessonStatus } from '@/types';

interface LessonState {
  lessons: Lesson[];
  loading: boolean;
  error: string | null;

  loadByClass: (classId: string) => Promise<void>;
  loadByDateRange: (from: string, to: string, classId?: string) => Promise<void>;
  getById: (id: string) => Lesson | undefined;
  getByClassAndDate: (classId: string, date: string) => Lesson[];

  addLesson: (input: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLesson: (id: string, patch: Partial<Lesson>) => Promise<void>;
  removeLesson: (id: string) => Promise<void>;
  setStatus: (id: string, status: LessonStatus) => Promise<void>;

  /** 한 주차 일괄 생성 */
  bulkAddWeekly: (
    classId: string,
    dates: string[],
    template: Omit<Lesson, 'id' | 'classId' | 'date' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: [],
  loading: false,
  error: null,

  async loadByClass(classId) {
    set({ loading: true, error: null });
    try {
      const rows = await db.lessons.where('classId').equals(classId).toArray();
      set({
        lessons: rows.sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.period - b.period
        ),
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByDateRange(from, to, classId) {
    set({ loading: true, error: null });
    try {
      let rows = await db.lessons
        .where('date')
        .between(from, to, true, true)
        .toArray();
      if (classId) rows = rows.filter((l) => l.classId === classId);
      set({
        lessons: rows.sort(
          (a, b) => a.date.localeCompare(b.date) || a.period - b.period
        ),
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  getById(id) {
    return get().lessons.find((l) => l.id === id);
  },

  getByClassAndDate(classId, date) {
    return get()
      .lessons.filter((l) => l.classId === classId && l.date === date)
      .sort((a, b) => a.period - b.period);
  },

  async addLesson(input) {
    const item: Lesson = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.lessons.add(item);
    set((s) => ({ lessons: [...s.lessons, item] }));
    return item.id;
  },

  async updateLesson(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.lessons.update(id, updated);
    set((s) => ({
      lessons: s.lessons.map((l) => (l.id === id ? { ...l, ...updated } : l)),
    }));
  },

  async removeLesson(id) {
    await db.lessons.delete(id);
    set((s) => ({ lessons: s.lessons.filter((l) => l.id !== id) }));
  },

  async setStatus(id, status) {
    await get().updateLesson(id, { status });
  },

  async bulkAddWeekly(classId, dates, template) {
    const items: Lesson[] = dates.map((date) => ({
      ...template,
      classId,
      date,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    }));
    await db.lessons.bulkAdd(items);
    set((s) => ({ lessons: [...s.lessons, ...items] }));
  },
}));
