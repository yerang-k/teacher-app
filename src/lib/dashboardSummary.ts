import { db } from "@/db";
import { toDateKey, compareEventsByTime } from "@/lib/dateUtils";
import { getPeriodTimes, addMinutes, PERIOD_COUNT } from "@/lib/periodTimes";
import { resolveCell } from "@/lib/timetableResolve";
import type { SchoolClass } from "@/types";

/**
 * 안드로이드 위젯이 읽는 "앞으로 14일 요약".
 * 클라우드 동기화(pushNow)가 백업 JSON에 `dashboardSummary` 필드로 함께 올린다.
 *
 * 개인정보 원칙: 학생 이름·출결·행동특성·업무 원문(sourceBody/description)은 담지 않는다.
 * 학급 이름, 일정·업무 제목, 시간, 차시 주제만 담는다.
 */
export const SUMMARY_DAYS = 14;
const MAX_OVERDUE = 10;

export interface SummaryClass {
  label: string;      // "3-6"
  subject?: string;   // "고전읽기"
  homeroom: boolean;
}

export interface SummaryPeriod {
  period: number;
  start: string;      // "08:30"
  end: string;        // "09:20"
  /** regular=정규 수업, substitute=오늘만 교체·대체, cancelled=오늘만 휴강 */
  kind: "regular" | "substitute" | "cancelled";
  class?: SummaryClass;
  replacedClass?: SummaryClass; // substitute일 때 원래 정규 학급
  topic?: string;               // 그날 기록된 차시 주제
}

export interface SummaryEvent {
  title: string;
  scope: "school" | "personal";
  category?: string;
  allDay: boolean;
  time?: string;
  location?: string;
  startDate: string;
  endDate: string;
}

export interface SummaryTask {
  title: string;
  priority: string;
  status: string;
  dueDate: string;
}

export interface SummaryDay {
  date: string;       // YYYY-MM-DD
  weekday: number;    // 0=일 ... 6=토
  periods: SummaryPeriod[];
  events: SummaryEvent[];
  tasks: SummaryTask[]; // 이 날짜가 마감인 업무(완료 포함, 위젯이 필터)
}

export interface DashboardSummary {
  version: 1;
  generatedAt: string;
  days: SummaryDay[];
  /** 생성 시점 기준 마감이 지났는데 끝나지 않은 업무 */
  overdueTasks: SummaryTask[];
}

function toSummaryClass(c: SchoolClass | undefined): SummaryClass | undefined {
  if (!c) return undefined;
  return {
    label: `${c.grade}-${c.classNumber}`,
    subject: c.subject || undefined,
    homeroom: c.homeroom,
  };
}

export async function buildDashboardSummary(base = new Date()): Promise<DashboardSummary> {
  const settings = await db.settings.get("singleton");
  const times = getPeriodTimes(settings ?? {});

  const dayDates: Date[] = [];
  for (let i = 0; i < SUMMARY_DAYS; i++) {
    dayDates.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }
  const keys = dayDates.map(toDateKey);
  const from = keys[0];
  const to = keys[keys.length - 1];

  const [classes, slots, lessons, tasks, events] = await Promise.all([
    db.classes.toArray(),
    settings
      ? db.timetable
          .where("[year+semester]")
          .equals([settings.currentYear, settings.currentSemester])
          .toArray()
      : Promise.resolve([]),
    db.lessons.where("date").between(from, to, true, true).toArray(),
    db.tasks.toArray(),
    db.events.toArray(),
  ]);

  const classById = new Map(classes.map((c) => [c.id, c]));

  const days: SummaryDay[] = dayDates.map((d, idx) => {
    const date = keys[idx];
    const weekday = d.getDay();

    const periods: SummaryPeriod[] = [];
    if (weekday >= 1 && weekday <= 5) {
      for (let period = 1; period <= PERIOD_COUNT; period++) {
        const slot = slots.find((s) => s.dayOfWeek === weekday && s.period === period);
        // 시간표 화면과 같이, 존재하는 학급만 정규 수업으로 인정한다
        const regularClass = slot ? classById.get(slot.classId) : undefined;
        const override = lessons.find((l) => l.date === date && l.period === period);
        const r = resolveCell(regularClass?.id, override);
        if (r.kind === "empty") continue;

        const start = times.starts[period - 1];
        const head: Pick<SummaryPeriod, "period" | "start" | "end"> = {
          period,
          start,
          end: addMinutes(start, times.minutes),
        };

        if (r.kind === "cancelled") {
          periods.push({ ...head, kind: "cancelled", class: toSummaryClass(regularClass) });
        } else if (r.kind === "substitute") {
          periods.push({
            ...head,
            kind: "substitute",
            class: toSummaryClass(classById.get(r.classId)),
            replacedClass: toSummaryClass(regularClass),
            topic: override?.topic || undefined,
          });
        } else {
          periods.push({
            ...head,
            kind: "regular",
            class: toSummaryClass(classById.get(r.classId)),
            topic: override && override.classId === r.classId ? override.topic || undefined : undefined,
          });
        }
      }
    }

    const dayEvents: SummaryEvent[] = events
      .filter((e) => e.startDate <= date && date <= e.endDate)
      .sort(compareEventsByTime)
      .map((e) => ({
        title: e.title,
        scope: e.scope,
        category: e.category,
        allDay: e.allDay,
        time: !e.allDay ? e.time : undefined,
        location: e.location || undefined,
        startDate: e.startDate,
        endDate: e.endDate,
      }));

    const dayTasks: SummaryTask[] = tasks
      .filter((t) => t.dueDate === date)
      .map((t) => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: date,
      }));

    return { date, weekday, periods, events: dayEvents, tasks: dayTasks };
  });

  const overdueTasks: SummaryTask[] = tasks
    .filter((t) => t.status !== "완료" && t.dueDate && t.dueDate < from)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))
    .slice(0, MAX_OVERDUE)
    .map((t) => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate as string,
    }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    days,
    overdueTasks,
  };
}
