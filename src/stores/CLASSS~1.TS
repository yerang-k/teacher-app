import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { SchoolClass, Student } from '@/types';

interface ClassState {
  classes: SchoolClass[];
  students: Student[];
  selectedClassId: string | null;
  loading: boolean;
  error: string | null;

  // -------- 조회 --------
  loadAll: () => Promise<void>;
  getClass: (id: string) => SchoolClass | undefined;
  getStudentsByClass: (classId: string) => Student[];
  getStudent: (id: string) => Student | undefined;

  // -------- 학급 CRUD --------
  addClass: (input: Omit<SchoolClass, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateClass: (id: string, patch: Partial<SchoolClass>) => Promise<void>;
  removeClass: (id: string) => Promise<void>;

  // -------- 학생 CRUD --------
  addStudent: (input: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateStudent: (id: string, patch: Partial<Student>) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
  bulkAddStudents: (
    classId: string,
    rows: Array<Pick<Student, 'number' | 'name'> & Partial<Student>>
  ) => Promise<void>;

  // -------- 선택 상태 --------
  selectClass: (id: string | null) => void;
}

export const useClassStore = create<ClassState>((set, get) => ({
  classes: [],
  students: [],
  selectedClassId: null,
  loading: false,
  error: null,

  async loadAll() {
    set({ loading: true, error: null });
    try {
      const [classes, students] = await Promise.all([
        db.classes.orderBy('classNumber').toArray(),
        db.students.toArray(),
      ]);
      set({ classes, students, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  getClass(id) {
    return get().classes.find((c) => c.id === id);
  },

  getStudentsByClass(classId) {
    return get()
      .students.filter((s) => s.classId === classId)
      .sort((a, b) => a.number - b.number);
  },

  getStudent(id) {
    return get().students.find((s) => s.id === id);
  },

  async addClass(input) {
    const item: SchoolClass = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.classes.add(item);
    set((s) => ({ classes: [...s.classes, item] }));
    return item.id;
  },

  async updateClass(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.classes.update(id, updated);
    set((s) => ({
      classes: s.classes.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
  },

  async removeClass(id) {
    // 학급 삭제 시 소속 학생/수업/출결/행동기록도 함께 삭제
    await db.transaction(
      'rw',
      [db.classes, db.students, db.lessons, db.attendance, db.behaviorNotes],
      async () => {
        await db.classes.delete(id);
        await db.students.where('classId').equals(id).delete();
        await db.lessons.where('classId').equals(id).delete();
        await db.attendance.where('classId').equals(id).delete();
        await db.behaviorNotes.where('classId').equals(id).delete();
      }
    );
    set((s) => ({
      classes: s.classes.filter((c) => c.id !== id),
      students: s.students.filter((st) => st.classId !== id),
      selectedClassId: s.selectedClassId === id ? null : s.selectedClassId,
    }));
  },

  async addStudent(input) {
    const item: Student = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.students.add(item);
    set((s) => ({ students: [...s.students, item] }));
    return item.id;
  },

  async updateStudent(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.students.update(id, updated);
    set((s) => ({
      students: s.students.map((st) =>
        st.id === id ? { ...st, ...updated } : st
      ),
    }));
  },

  async removeStudent(id) {
    await db.transaction(
      'rw',
      [db.students, db.attendance, db.behaviorNotes],
      async () => {
        await db.students.delete(id);
        await db.attendance.where('studentId').equals(id).delete();
        await db.behaviorNotes.where('studentId').equals(id).delete();
      }
    );
    set((s) => ({ students: s.students.filter((st) => st.id !== id) }));
  },

  async bulkAddStudents(classId, rows) {
    const items: Student[] = rows.map((r) => ({
      classId,
      number: r.number,
      name: r.name,
      gender: r.gender,
      birthdate: r.birthdate,
      phone: r.phone,
      parentPhone: r.parentPhone,
      notes: r.notes,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    }));
    await db.students.bulkAdd(items);
    set((s) => ({ students: [...s.students, ...items] }));
  },

  selectClass(id) {
    set({ selectedClassId: id });
  },
}));
