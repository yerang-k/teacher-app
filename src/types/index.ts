// 공통 도메인 타입 정의
// 고등학교 국어 교사용 수업/업무 관리 앱

// ============ 학사 일정 ============
export type Semester = 1 | 2;

export interface SchoolYear {
  year: number; // 2026
  semester: Semester;
}

// ============ 학급/학생 ============
/** 학급 (예: 2학년 3반) */
export interface SchoolClass {
  id: string;
  year: number;            // 학년도 (2026)
  grade: 1 | 2 | 3;        // 학년
  classNumber: number;     // 반
  homeroom: boolean;       // 담임 학급 여부
  subject?: string;        // 교과 (예: '국어', '문학', '독서')
  createdAt: number;
  updatedAt: number;
}

/** 학생 */
export interface Student {
  id: string;
  classId: string;         // 소속 학급 id
  number: number;          // 출석번호
  name: string;
  gender?: '남' | '여';
  birthdate?: string;      // YYYY-MM-DD
  phone?: string;
  parentPhone?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 수업 계획/진도 ============
export type LessonStatus = '예정' | '진행중' | '완료' | '취소';

export interface Lesson {
  id: string;
  classId: string;
  date: string;            // YYYY-MM-DD
  period: number;          // 교시 (1~7)
  unit: string;            // 단원 (예: '1단원. 문학의 이해')
  topic: string;           // 차시 주제
  objectives?: string;     // 학습 목표
  materials?: string;      // 수업 자료/매체
  activities?: string;     // 학습 활동
  homework?: string;       // 과제
  status: LessonStatus;
  reflection?: string;     // 수업 후 성찰
  createdAt: number;
  updatedAt: number;
}

// ============ 출결 ============
export type AttendanceStatus =
  | '출석'
  | '결석'
  | '지각'
  | '조퇴'
  | '결과'
  | '인정결석'
  | '질병결석'
  | '미인정결석'
  | '기타결석';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;            // YYYY-MM-DD
  period?: number;         // 교시 (전체 결석이면 null)
  status: AttendanceStatus;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 행동특성 / 상담 기록 ============
export type BehaviorCategory =
  | '학습태도'
  | '교우관계'
  | '리더십'
  | '봉사'
  | '특기'
  | '진로'
  | '상담'
  | '기타';

export interface BehaviorNote {
  id: string;
  studentId: string;
  classId: string;
  date: string;            // YYYY-MM-DD
  category: BehaviorCategory;
  content: string;         // 관찰 내용
  positive: boolean;       // 긍정적/부정적
  tags?: string[];         // 검색용 태그
  followUp?: string;       // 후속조치
  createdAt: number;
  updatedAt: number;
}

// ============ 업무 (정보부장 / AI디지털 선도학교 등) ============
export type TaskPriority = '낮음' | '보통' | '높음' | '긴급';
export type TaskStatus = '대기' | '진행중' | '완료' | '보류';
export type TaskCategory =
  | '정보부'
  | 'AI디지털선도학교'
  | '수업'
  | '담임'
  | '교과'
  | '행정'
  | '연수'
  | '기타';

export interface SchoolTask {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;        // YYYY-MM-DD
  assignee?: string;       // 협업자
  attachments?: string[];  // 파일 경로/URL
  checklist?: { id: string; text: string; done: boolean }[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// ============ AI 보고서 ============
export type ReportType =
  | '학생개별'
  | '학급전체'
  | '수업분석'
  | '출결분석'
  | '행동특성요약'
  | '학기말종합';

export interface AIReport {
  id: string;
  type: ReportType;
  title: string;
  targetIds: string[];     // 학생/학급 id 목록
  period: { from: string; to: string }; // YYYY-MM-DD
  prompt?: string;         // 생성 시 사용한 프롬프트
  content: string;         // 생성된 본문(Markdown)
  modelInfo?: string;      // 사용한 모델/버전
  createdAt: number;
  updatedAt: number;
}
// ============ 시간표 ============
/** 학기별 주간 시간표의 한 칸 (요일 × 교시 → 학급) */
export interface TimetableSlot {
  id: string;
  year: number;
  semester: Semester;
  dayOfWeek: 1 | 2 | 3 | 4 | 5;
  period: number;
  classId: string;
  room?: string;
  createdAt: number;
  updatedAt: number;
}
// ============ 설정 ============
export interface AppSettings {
  id: 'singleton';
  currentYear: number;
  currentSemester: Semester;
  teacherName?: string;
  schoolName?: string;
  theme: 'light' | 'dark' | 'system';
  aiApiKey?: string;        // 로컬에만 저장
  updatedAt: number;
}
