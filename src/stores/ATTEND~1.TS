import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { AttendanceRecord, AttendanceStatus } from '@/types';

interface AttendanceState {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;

  loadByClassDate: (classId: string, date: string) => Promise<void>;
  loadByStudentRange: (studentId: string, from: string, to: string) => Promise<void>;
  loadByClassRange: (classId: string, from: string, to: string) => Promise<void>;

  /** 학급 전체에 대해 하루 출결을 한번에 저장 (있으면 업데이트) */
  upsertDaily: (
    classId: string,
    date: string,
    rows: Array<{ studentId: string; status: AttendanceStatus; reason?: string; period?: number }>
  ) => Promise<void>;

  setStatus: (id: string, status: AttendanceStatus, reason?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  /** 학생별 출결 통계 */
  statsForStudent: (studentId: string, from: string, to: string) => Promise<Record<AttendanceStatus, number>>;
}

const emptyStats = (): Record<AttendanceStatus, number> => ({
  출석: 0,
  결석: 0,
  지각: 0,
  조퇴: 0,
  결과: 0,
  인정결석: 0,
  질병결석: 0,
  미인정결석: 0,
  기타결석: 0,
});

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  async loadByClassDate(classId, date) {
    set({ loading: true, error: null });
    try {
      const rows = await db.attendance
        .where('[classId+date]')
        .equals([classId, date])
        .toArray();
      set({ records: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByStudentRange(studentId, from, to) {
    set({ loading: true, error: null });
    try {
      const rows = await db.attendance
        .where('studentId')
        .equals(studentId)
        .filter((r) => r.date >= from && r.date <= to)
        .toArray();
      set({ records: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadByClassRange(classId, from, to) {
    set({ loading: true, error: null });
    try {
      const rows = await db.attendance
        .where('classId')
        .equals(classId)
        .filter((r) => r.date >= from && r.date <= to)
        .toArray();
      set({ records: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async upsertDaily(classId, date, rows) {
    await db.transaction('rw', db.attendance, async () => {
      // 기존 기록 가져오기 (학생별 1건 기준)
      const existing = await db.attendance
        .where('[classId+date]')
        .equals([classId, date])
        .toArray();
      const byStudent = new Map(existing.map((r) => [r.studentId, r]));

      for (const row of rows) {
        const prev = byStudent.get(row.studentId);
        if (prev) {
          await db.attendance.update(prev.id, {
            status: row.status,
            reason: row.reason,
            period: row.period,
            updatedAt: now(),
          });
        } else {
          await db.attendance.add({
            id: uid(),
            classId,
            studentId: row.studentId,
            date,
            status: row.status,
            reason: row.reason,
            period: row.period,
            createdAt: now(),
            updatedAt: now(),
          });
        }
      }
    });
    await get().loadByClassDate(classId, date);
  },

  async setStatus(id, status, reason) {
    const patch = { status, reason, updatedAt: now() };
    await db.attendance.update(id, patch);
    set((s) => ({
      records: s.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  },

  async remove(id) {
    await db.attendance.delete(id);
    set((s) => ({ records: s.records.filter((r) => r.id !== id) }));
  },

  async statsForStudent(studentId, from, to) {
    const rows = await db.attendance
      .where('studentId')
      .equals(studentId)
      .filter((r) => r.date >= from && r.date <= to)
      .toArray();
    const stats = emptyStats();
    for (const r of rows) stats[r.status] += 1;
    return stats;
  },
}));
