// 사용 예시 — Home 페이지에서 대시보드처럼 데이터 보여주기
// (실제 페이지에 그대로 옮겨 쓰셔도 됩니다)
import { useEffect } from 'react';
import { useClassStore, useTaskStore } from '@/stores';
import { todayKey } from '@/lib/dateUtils';

export default function HomeExample() {
  const classes = useClassStore((s) => s.classes);
  const tasks = useTaskStore((s) => s.tasks);
  const overdue = useTaskStore((s) => s.overdue());
  const upcoming = useTaskStore((s) => s.upcoming(7));

  // 페이지 진입 시 한 번 더 로드 (App에서 이미 로드했지만 안전망)
  const loadTasks = useTaskStore((s) => s.loadAll);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">오늘 ({todayKey()})</h1>
        <p className="text-muted-foreground">담당 학급 {classes.length}개</p>
      </header>

      <section>
        <h2 className="font-semibold mb-2">⚠️ 지연된 업무 ({overdue.length})</h2>
        <ul className="space-y-1">
          {overdue.map((t) => (
            <li key={t.id} className="text-sm">
              [{t.category}] {t.title} — 마감 {t.dueDate}
            </li>
          ))}
          {overdue.length === 0 && (
            <li className="text-sm text-muted-foreground">지연된 업무가 없습니다.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">🗓 이번 주 마감 ({upcoming.length})</h2>
        <ul className="space-y-1">
          {upcoming.map((t) => (
            <li key={t.id} className="text-sm">
              {t.dueDate} — {t.title}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">📚 학급 목록</h2>
        <ul className="space-y-1">
          {classes.map((c) => (
            <li key={c.id} className="text-sm">
              {c.year}학년도 {c.grade}-{c.classNumber}
              {c.homeroom ? ' (담임)' : ` (${c.subject})`}
            </li>
          ))}
        </ul>
      </section>

      <section className="text-sm text-muted-foreground">
        전체 업무: {tasks.length}건
      </section>
    </div>
  );
}
