import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toDateKey, todayKey } from "@/lib/dateUtils";
import type { SchoolTask, TaskPriority } from "@/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PRIORITY_DOT: Record<TaskPriority, string> = {
  낮음: "bg-slate-400",
  보통: "bg-blue-500",
  높음: "bg-amber-500",
  긴급: "bg-rose-500",
};

const MAX_SHOWN = 3;

interface TaskCalendarProps {
  tasks: SchoolTask[];
  onTaskClick: (t: SchoolTask) => void;
  onDayClick?: (dateKey: string) => void;
}

export default function TaskCalendar({ tasks, onTaskClick, onDayClick }: TaskCalendarProps) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goPrev}>
            ‹
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            ›
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            오늘
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <div className="w-[100px]" />
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
            const dow = d.getDay();
            return (
              <div
                key={key}
                onClick={() => onDayClick?.(key)}
                className={`flex min-h-[100px] flex-col gap-1 bg-background p-1.5 ${
                  inMonth ? "" : "opacity-40"
                } ${onDayClick ? "cursor-pointer hover:bg-muted/40" : ""}`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] font-semibold ${
                    isToday
                      ? "bg-primary text-primary-foreground"
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
                  {shown.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(t);
                      }}
                      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:opacity-80 ${
                        t.status === "완료"
                          ? "bg-slate-100 text-slate-400 line-through"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                      />
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
