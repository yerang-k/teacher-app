// 출결 페이지 예시 — 학급 선택 → 오늘 출결 일괄 저장
import { useEffect, useState } from 'react';
import { useClassStore, useAttendanceStore } from '@/stores';
import { todayKey } from '@/lib/dateUtils';
import type { AttendanceStatus } from '@/types';

export default function AttendanceExample() {
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);
  const [classId, setClassId] = useState<string>('');
  const date = todayKey();

  const records = useAttendanceStore((s) => s.records);
  const loadByClassDate = useAttendanceStore((s) => s.loadByClassDate);
  const upsertDaily = useAttendanceStore((s) => s.upsertDaily);

  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (classId) loadByClassDate(classId, date);
  }, [classId, date, loadByClassDate]);

  // 기존 기록을 draft에 반영
  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    records.forEach((r) => (next[r.studentId] = r.status));
    setDraft(next);
  }, [records]);

  const students = classId ? getStudentsByClass(classId) : [];

  const save = async () => {
    if (!classId) return;
    const rows = students.map((s) => ({
      studentId: s.id,
      status: draft[s.id] ?? ('출석' as AttendanceStatus),
    }));
    await upsertDaily(classId, date, rows);
    alert('출결 저장 완료');
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">출결 입력 ({date})</h1>

      <select
        className="border rounded px-2 py-1"
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
      >
        <option value="">학급 선택</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.grade}-{c.classNumber} {c.homeroom ? '(담임)' : ''}
          </option>
        ))}
      </select>

      {classId && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">번호</th>
                <th className="p-2">이름</th>
                <th className="p-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-2">{s.number}</td>
                  <td className="p-2">{s.name}</td>
                  <td className="p-2">
                    <select
                      value={draft[s.id] ?? '출석'}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [s.id]: e.target.value as AttendanceStatus,
                        }))
                      }
                    >
                      {['출석','결석','지각','조퇴','결과','인정결석','질병결석','미인정결석','기타결석'].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={save}
            className="px-4 py-2 rounded bg-primary text-primary-foreground"
          >
            저장
          </button>
        </>
      )}
    </div>
  );
}
