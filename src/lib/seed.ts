import { db, now, uid } from '@/db';
import type { SchoolClass, Student, SchoolTask } from '@/types';

/**
 * 앱 첫 실행 시 호출하면 학급/학생/업무 시드 데이터를 생성합니다.
 * 이미 데이터가 있으면 아무 것도 하지 않습니다.
 */
export async function seedIfEmpty() {
  const classCount = await db.classes.count();
  if (classCount > 0) return false;

  // 예시: 담임 2학년 3반 + 국어 교과로 1학년 1반, 1학년 2반
  const homeroom: SchoolClass = {
    id: uid(),
    year: new Date().getFullYear(),
    grade: 2,
    classNumber: 3,
    homeroom: true,
    subject: '담임',
    createdAt: now(),
    updatedAt: now(),
  };
  const subjectClass1: SchoolClass = {
    id: uid(),
    year: new Date().getFullYear(),
    grade: 1,
    classNumber: 1,
    homeroom: false,
    subject: '국어',
    createdAt: now(),
    updatedAt: now(),
  };
  const subjectClass2: SchoolClass = {
    id: uid(),
    year: new Date().getFullYear(),
    grade: 1,
    classNumber: 2,
    homeroom: false,
    subject: '국어',
    createdAt: now(),
    updatedAt: now(),
  };

  await db.classes.bulkAdd([homeroom, subjectClass1, subjectClass2]);

  // 담임 학급 학생 25명 예시
  const sampleNames = [
    '김민준','이서연','박지호','최예린','정도현','강하윤','조시우','윤지아','임건우','한채원',
    '오은서','신유준','홍서윤','배현우','문가은','권시아','노지훈','구민서','전수아','송재훈',
    '장하은','류지환','백서아','심윤호','안서영',
  ];
  const students: Student[] = sampleNames.map((name, i) => ({
    id: uid(),
    classId: homeroom.id,
    number: i + 1,
    name,
    gender: i % 2 === 0 ? '남' : '여',
    createdAt: now(),
    updatedAt: now(),
  }));
  await db.students.bulkAdd(students);

  // 기본 업무 시드 (정보부 + AI디지털 선도학교)
  const baseTasks: SchoolTask[] = [
    {
      id: uid(),
      title: '정보부 월간 회의 자료 준비',
      description: '월말 정보부 정례 회의 자료 작성 및 공유',
      category: '정보부',
      priority: '보통',
      status: '대기',
      checklist: [
        { id: uid(), text: '안건 수합', done: false },
        { id: uid(), text: '자료 작성', done: false },
        { id: uid(), text: '회의록 양식 준비', done: false },
      ],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: uid(),
      title: 'AI디지털 선도학교 운영계획 수립',
      description: '연간 운영계획서 작성 및 결재',
      category: 'AI디지털선도학교',
      priority: '높음',
      status: '진행중',
      checklist: [
        { id: uid(), text: '교사 의견 수합', done: true },
        { id: uid(), text: '예산안 작성', done: false },
        { id: uid(), text: '결재 상신', done: false },
      ],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: uid(),
      title: '디지털 교과서 활용 연수 안내',
      category: '연수',
      priority: '보통',
      status: '대기',
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.tasks.bulkAdd(baseTasks);

  return true;
}
