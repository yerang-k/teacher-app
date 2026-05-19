import Dexie, { type Table } from 'dexie';
import type {
  SchoolClass,
  Student,
  Lesson,
  AttendanceRecord,
  BehaviorNote,
  SchoolTask,
  AIReport,
  AppSettings,
  TimetableSlot,
  Assessment,
  AssessmentRecord,
} from '@/types';

/**
 * 교사용 수업/업무 관리 앱의 IndexedDB 스키마.
 * Dexie.js 기반.
 *
 * 버전 업그레이드 시 반드시 새 .version()을 추가하고 마이그레이션을 작성하세요.
 */
export class TeacherDB extends Dexie {
  classes!: Table<SchoolClass, string>;
  students!: Table<Student, string>;
  lessons!: Table<Lesson, string>;
  attendance!: Table<AttendanceRecord, string>;
  behaviorNotes!: Table<BehaviorNote, string>;
  tasks!: Table<SchoolTask, string>;
  reports!: Table<AIReport, string>;
  settings!: Table<AppSettings, string>;
  timetable!: Table<TimetableSlot, string>;
  assessments!: Table<Assessment, string>;
  assessmentRecords!: Table<AssessmentRecord, string>;
  constructor() {
    super('TeacherAppDB');

    // v1: 초기 스키마
    // - 복합 인덱스로 학급별/날짜별/학생별 조회 최적화
    this.version(1).stores({
      classes: 'id, year, grade, classNumber, [year+grade+classNumber], homeroom',
      students: 'id, classId, number, name, [classId+number]',
      lessons:
        'id, classId, date, period, status, [classId+date], [classId+date+period]',
      attendance:
        'id, studentId, classId, date, status, [studentId+date], [classId+date]',
      behaviorNotes:
        'id, studentId, classId, date, category, positive, [studentId+date], [classId+date]',
      tasks:
        'id, category, status, priority, dueDate, [status+dueDate], [category+status]',
      reports: 'id, type, createdAt, *targetIds',
      settings: 'id',
    });
    // v2: 시간표 테이블 추가
    this.version(2).stores({
      timetable:
        'id, [year+semester], [year+semester+dayOfWeek+period], classId',
    });
    // v3: 수행평가 테이블 추가
    this.version(3).stores({
      assessments: 'id, subject, [year+semester]',
      assessmentRecords: 'id, assessmentId, studentId, classId',
    });
  }

  /**
   * 모든 데이터를 삭제합니다. (개발/테스트용)
   */
  async resetAll() {
    await this.transaction(
      'rw',
      [
        this.classes,
        this.students,
        this.lessons,
        this.attendance,
        this.behaviorNotes,
        this.tasks,
        this.reports,
        this.settings,
        this.timetable,
        this.assessments,
        this.assessmentRecords,
      ],
      async () => {
        await Promise.all([
          this.classes.clear(),
          this.students.clear(),
          this.lessons.clear(),
          this.attendance.clear(),
          this.behaviorNotes.clear(),
          this.tasks.clear(),
          this.reports.clear(),
          this.settings.clear(),
          this.timetable.clear(),
          this.assessments.clear(),
          this.assessmentRecords.clear(),
        ]);
      }
    );
  }

  /**
   * 백업용 JSON 내보내기
   */
  async exportJSON() {
    const [
      classes,
      students,
      lessons,
      attendance,
      behaviorNotes,
      tasks,
      reports,
      settings,
    ] = await Promise.all([
      this.classes.toArray(),
      this.students.toArray(),
      this.lessons.toArray(),
      this.attendance.toArray(),
      this.behaviorNotes.toArray(),
      this.tasks.toArray(),
      this.reports.toArray(),
      this.settings.toArray(),
    ]);
    return {
      exportedAt: Date.now(),
      version: 1,
      data: {
        classes,
        students,
        lessons,
        attendance,
        behaviorNotes,
        tasks,
        reports,
        settings,
      },
    };
  }

  /**
   * JSON 백업 가져오기 (기존 데이터 덮어쓰기)
   */
  async importJSON(payload: Awaited<ReturnType<TeacherDB['exportJSON']>>) {
    const { data } = payload;
    await this.resetAll();
    await this.transaction(
      'rw',
      [
        this.classes,
        this.students,
        this.lessons,
        this.attendance,
        this.behaviorNotes,
        this.tasks,
        this.reports,
        this.settings,
      ],
      async () => {
        await Promise.all([
          this.classes.bulkAdd(data.classes),
          this.students.bulkAdd(data.students),
          this.lessons.bulkAdd(data.lessons),
          this.attendance.bulkAdd(data.attendance),
          this.behaviorNotes.bulkAdd(data.behaviorNotes),
          this.tasks.bulkAdd(data.tasks),
          this.reports.bulkAdd(data.reports),
          this.settings.bulkAdd(data.settings),
        ]);
      }
    );
  }
}

export const db = new TeacherDB();

/** 간단한 UUID 생성기 (crypto.randomUUID 미지원 환경 대비) */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 현재 타임스탬프 */
export const now = () => Date.now();
