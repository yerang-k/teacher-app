import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { TimetableSlot, Semester } from '@/types';

type DayOfWeek = 1 | 2 | 3 | 4 | 5;

interface TimetableState {
  slots: TimetableSlot[];
  loading: boolean;
  error: string | null;

  loadByTerm: (year: number, semester: Semester) => Promise<void>;

  /** 특정 칸의 학급 배정 (있으면 update, 없으면 insert) */
  setSlot: (params: {
    year: number;
    semester: Semester;
    dayOfWeek: DayOfWeek;
    period: number;
    classId: string;
    room?: string;
  }) => Promise<void>;

  /** 칸 비우기 */
  clearSlot: (
    year: number,
    semester: Semester,
    dayOfWeek: DayOfWeek,
    period: number
  ) => Promise<void>;

  /** 메모리 캐시에서 한 칸 찾기 */
  getSlot: (
    dayOfWeek: DayOfWeek,
    period: number
  ) => TimetableSlot | undefined;
}

export const useTimetableStore = create<TimetableState>((set, get) => ({
  slots: [],
  loading: false,
  error: null,

  async loadByTerm(year, semester) {
    set({ loading: true, error: null });
    try {
      const rows = await db.timetable
        .where('[year+semester]')
        .equals([year, semester])
        .toArray();
      set({ slots: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async setSlot({ year, semester, dayOfWeek, period, classId, room }) {
    // 기존 칸 있는지 확인
    const existing = await db.timetable
      .where('[year+semester+dayOfWeek+period]')
      .equals([year, semester, dayOfWeek, period])
      .first();

    if (existing) {
      const patch = {
        classId,
        room,
        updatedAt: now(),
      };
      await db.timetable.update(existing.id, patch);
      set((s) => ({
        slots: s.slots.map((x) =>
          x.id === existing.id ? { ...x, ...patch } : x
        ),
      }));
    } else {
      const item: TimetableSlot = {
        id: uid(),
        year,
        semester,
        dayOfWeek,
        period,
        classId,
        room,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.timetable.add(item);
      set((s) => ({ slots: [...s.slots, item] }));
    }
  },

  async clearSlot(year, semester, dayOfWeek, period) {
    const existing = await db.timetable
      .where('[year+semester+dayOfWeek+period]')
      .equals([year, semester, dayOfWeek, period])
      .first();
    if (!existing) return;
    await db.timetable.delete(existing.id);
    set((s) => ({ slots: s.slots.filter((x) => x.id !== existing.id) }));
  },

  getSlot(dayOfWeek, period) {
    return get().slots.find(
      (s) => s.dayOfWeek === dayOfWeek && s.period === period
    );
  },
}));
