import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toDateKey, todayKey, compareEventsByTime } from "@/lib/dateUtils";
import type {
  SchoolTask,
  TaskPriority,
  SchoolEvent,
  EventScope,
  GoogleCalendarEvent,
} from "@/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 업무를 달력에서 알약 버튼으로 표시하기 위한 우선순위별 고정 색 */
const PRIORITY_BAR: Record<TaskPriority, string> = {
  낮음: "bg-slate-400 text-white",
  보통: "bg-blue-500 text-white",
  높음: "bg-amber-500 text-white",
  긴급: "bg-rose-500 text-white",
};

/** 업무/행사/개인을 달력에서 한눈에 구분하기 위한 종류별 고정 색 */
export const SCOPE_BAR: Record<EventScope, string> = {
  school: "bg-violet-500 text-white",
  personal: "bg-rose-500 text-white",
};
export const SCOPE_LABEL: Record<EventScope, string> = {
  school: "행사",
  personal: "개인",
};

/** 구글 캘린더에서 읽어온 일정(읽기 전용)의 고정 색 */
export const GOOGLE_BAR = "bg-teal-600 text-white";

const MAX_SHOWN = 4;
const MAX_EVENTS_SHOWN = 4;

/** 앱 일정과 구글 일정을 한 칸 안에서 시간순으로 섞어 보여주기 위한 공통 모양 */
type DayEventItem =
  | { src: "app"; ev: SchoolEvent; allDay: boolean; time?: string }
  | { src: "google"; ev: GoogleCalendarEvent; allDay: boolean; time?: string };

interface TaskCalendarProps {
  tasks: SchoolTask[];
  events?: SchoolEvent[];
  googleEvents?: GoogleCalendarEvent[];
  onTaskClick: (t: SchoolTask) => void;
  onEventClick?: (e: SchoolEvent) => void;
  onGoogleEventClick?: (e: GoogleCalendarEvent) => void;
  onDayClick?: (dateKey: string) => void;
  /** 화면에 보이는 날짜 범위(첫 칸~마지막 칸)가 바뀔 때 호출 */
  onRangeChange?: (from: string, to: string) => void;
}

export default function TaskCalendar({
  tasks,
  events = [],
  googleEvents = [],
  onTaskClick,
  onEventClick,
  onGoogleEventClick,
  onDayClick,
  onRangeChange,
}: TaskCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const byDate = useMemo(() => {
    const map = new Map<string, SchoolTask[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const arr = map.get(t.dueDate) ?? [];
      arr.push(t);
      map.set(t.dueDate, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.status === "완료" ? 1 : 0) - (b.status === "완료" ? 1 : 0));
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const lastRow = days.slice(35, 42);
    return lastRow.every((d) => d.getMonth() !== month) ? days.slice(0, 35) : days;
  }, [cursor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEventItem[]>();
    for (const d of cells) {
      const key = toDateKey(d);
      // 그날 안에서는 시간 순(빠른 일정이 위), 시간 없는 일정은 맨 아래
      const hits: DayEventItem[] = [
        ...events
          .filter((e) => e.startDate <= key && key <= e.endDate)
          .map((ev): DayEventItem => ({ src: "app", ev, allDay: ev.allDay, time: ev.time })),
        ...googleEvents
          .filter((e) => e.startDate <= key && key <= e.endDate)
          .map((ev): DayEventItem => ({ src: "google", ev, allDay: ev.allDay, time: ev.time })),
      ].sort(compareEventsByTime);
      if (hits.length) map.set(key, hits);
    }
    return map;
  }, [cells, events, googleEvents]);

  const rangeFrom = toDateKey(cells[0]);
  const rangeTo = toDateKey(cells[cells.length - 1]);
  const rangeCallback = useRef(onRangeChange);
  rangeCallback.current = onRangeChange;
  useEffect(() => {
    rangeCallback.current?.(rangeFrom, rangeTo);
  }, [rangeFrom, rangeTo]);

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const today = todayKey();

  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    setCursor(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={goPrev}>
          ‹
        </Button>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <Button variant="outline" size="sm" onClick={goNext}>
          ›
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="ml-1">
          오늘
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[640px] grid-cols-7 gap-px bg-border text-xs">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`bg-muted py-2 text-center font-medium ${
                i === 0 ? "text-rose-600" : i === 6 ? "text-blue-600" : "text-muted-foreground"
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = key === today;
            const dayTasks = byDate.get(key) ?? [];
            const shown = dayTasks.slice(0, MAX_SHOWN);
            const extra = dayTasks.length - shown.length;
            const dayEvents = eventsByDate.get(key) ?? [];
            const shownEvents = dayEvents.slice(0, MAX_EVENTS_SHOWN);
            const extraEvents = dayEvents.length - shownEvents.length;
            const dow = d.getDay();
            return (
              <div
                key={key}
                onClick={() => onDayClick?.(key)}
                className={`flex min-h-[136px] flex-col gap-1 p-1.5 ${
                  isToday ? "bg-emerald-100" : "bg-background"
                } ${inMonth ? "" : "opacity-40"} ${
                  onDayClick
                    ? `cursor-pointer ${isToday ? "hover:bg-emerald-200" : "hover:bg-muted/40"}`
                    : ""
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] font-semibold ${
                    isToday
                      ? "bg-emerald-600 text-white"
                      : dow === 0
                      ? "text-rose-500"
                      : dow === 6
                      ? "text-blue-500"
                      : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {shownEvents.map((item) =>
                    item.src === "app" ? (
                      <button
                        key={item.ev.id}
                        type="button"
                        title={item.ev.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(item.ev);
                        }}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-80 ${SCOPE_BAR[item.ev.scope]}`}
                      >
                        {item.ev.title}
                      </button>
                    ) : (
                      <button
                        key={`g-${item.ev.calendarId}-${item.ev.id}`}
                        type="button"
                        title={`${item.ev.title} · 구글 캘린더(${item.ev.calendarName})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGoogleEventClick?.(item.ev);
                        }}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-80 ${GOOGLE_BAR}`}
                      >
                        {item.ev.title}
                      </button>
                    )
                  )}
                  {extraEvents > 0 && (
                    <div className="px-1 text-[10px] text-muted-foreground">일정 +{extraEvents}개</div>
                  )}
                  {shown.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(t);
                      }}
                      className={`flex w-full items-center truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-80 ${
                        t.status === "완료"
                          ? "bg-slate-100 text-slate-400 line-through"
                          : PRIORITY_BAR[t.priority]
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <div className="px-1 text-[10px] text-muted-foreground">+{extra}개</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
