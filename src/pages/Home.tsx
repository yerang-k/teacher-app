import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  useClassStore,
  useLessonStore,
  useTaskStore,
  useSettingsStore,
  useTimetableStore,
} from "@/stores";
import { todayKey } from "@/lib/dateUtils";
import { db } from "@/db";
import type { AttendanceRecord, Lesson, TimetableSlot } from "@/types";
export default function Home() {
  const settings = useSettingsStore((s) => s.settings);
  const classes = useClassStore((s) => s.classes);
  const students = useClassStore((s) => s.students);

  const loadTasks = useTaskStore((s) => s.loadAll);
  const overdue = useTaskStore((s) => s.overdue());
  const upcoming = useTaskStore((s) => s.upcoming(7));

  const today = todayKey();
  const slots = useTimetableStore((s) => s.slots);
  const loadByTerm = useTimetableStore((s) => s.loadByTerm);

  // 오늘 수업 / 오늘 출결은 DB에서 직접 가져옴
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    loadTasks();
    loadByTerm(settings.currentYear, settings.currentSemester);
  }, [loadTasks, loadByTerm, settings.currentYear, settings.currentSemester]);

  useEffect(() => {
    (async () => {
      const [lessons, attendance] = await Promise.all([
        db.lessons.where("date").equals(today).toArray(),
        db.attendance.where("date").equals(today).toArray(),
      ]);
      setTodayLessons(
        lessons.sort((a, b) => a.period - b.period)
      );
      setTodayAttendance(attendance);
    })();
  }, [today]);

  // 담임 학급 출결 입력 여부 체크
  const homeroom = classes.find((c) => c.homeroom && !c.archived);
  const homeroomStudents = useMemo(
    () => (homeroom ? students.filter((s) => s.classId === homeroom.id) : []),
    [homeroom, students]
  );
  const homeroomAttendance = useMemo(
    () =>
      homeroom
        ? todayAttendance.filter((r) => r.classId === homeroom.id)
        : [],
    [homeroom, todayAttendance]
  );
  const attendancePending =
    homeroom && homeroomAttendance.length === 0 && homeroomStudents.length > 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "이른 새벽";
    if (h < 12) return "오전";
    if (h < 18) return "오후";
    return "저녁";
  })();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            {greeting}이에요{settings.teacherName ? `, ${settings.teacherName} 선생님` : ""} 👋
          </h1>
          <p className="text-muted-foreground">
            {settings.schoolName && `${settings.schoolName} · `}
            {settings.currentYear}학년도 {settings.currentSemester}학기 ·{" "}
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/attendance">
            <Button variant="outline">출결 입력</Button>
          </Link>
          <Link href="/lessons">
            <Button>수업 보기</Button>
          </Link>
        </div>
      </div>
      {/* 빠른 메뉴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">빠른 메뉴</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <QuickLink href="/lessons" label="수업·진도" />
          <QuickLink href="/attendance" label="출결" />
          <QuickLink href="/behavior" label="행동특성" />
          <QuickLink href="/tasks" label="업무" />
          <QuickLink href="/ai-report" label="AI 보고서" />
          <QuickLink href="/settings" label="설정" />
        </CardContent>
      </Card>

      {/* 알림 카드 */}
      {(attendancePending || overdue.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attendancePending && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="pt-6 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-amber-900">
                    오늘 출결 입력이 비어 있습니다
                  </div>
                  <div className="text-sm text-amber-800">
                    {homeroom?.grade}-{homeroom?.classNumber} 담임 학급 ·{" "}
                    {homeroomStudents.length}명
                  </div>
                </div>
                <Link href="/attendance">
                  <Button size="sm">입력하기</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {overdue.length > 0 && (
            <Card className="border-rose-300 bg-rose-50">
              <CardContent className="pt-6 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-rose-900">
                    지연된 업무 {overdue.length}건
                  </div>
                  <div className="text-sm text-rose-800">
                    마감일이 지난 업무가 있습니다.
                  </div>
                </div>
                <Link href="/tasks">
                  <Button size="sm" variant="destructive">
                    확인
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 이번 주 시간표 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">이번 주 시간표</CardTitle>
            <Link href="/timetable">
              <Button variant="ghost" size="sm">전체 보기 →</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-3 overflow-x-auto">
          <WeekTimetable slots={slots} classes={classes} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 오늘 수업 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">오늘 수업</CardTitle>
            <CardDescription>
              {today} · {todayLessons.length}차시
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                오늘 등록된 수업이 없습니다.{" "}
                <Link href="/lessons">
                  <span className="underline cursor-pointer">수업 등록하기</span>
                </Link>
              </p>
            ) : (
              todayLessons.map((l) => {
                const k = classes.find((c) => c.id === l.classId);
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 border rounded p-2"
                  >
                    <div className="text-xs font-bold w-12 text-center text-muted-foreground">
                      {l.period}교시
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{l.topic}</div>
                      <div className="text-xs text-muted-foreground">
                        {k
                          ? `${k.grade}-${k.classNumber} ${
                              k.homeroom ? "(담임)" : `(${k.subject})`
                            }`
                          : ""}
                        {l.unit && ` · ${l.unit}`}
                      </div>
                    </div>
                    <Badge variant="outline">{l.status}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 이번 주 마감 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">이번 주 마감</CardTitle>
            <CardDescription>{upcoming.length}건</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                임박한 업무가 없습니다.
              </p>
            ) : (
              upcoming.slice(0, 6).map((t) => (
                <div key={t.id} className="text-sm border-l-2 border-amber-400 pl-2">
                  <div className="font-medium line-clamp-1">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.dueDate} · {t.category}
                  </div>
                </div>
              ))
            )}
            <Separator />
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="w-full">
                업무 전체 보기 →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function dateOfWeek(dayOfWeek: 1 | 2 | 3 | 4 | 5): string {
  const today = new Date();
  const todayDay = today.getDay() === 0 ? 7 : today.getDay();
  const diff = dayOfWeek - todayDay;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}
const WEEK_DAYS = [
  { value: 1 as const, label: "월" },
  { value: 2 as const, label: "화" },
  { value: 3 as const, label: "수" },
  { value: 4 as const, label: "목" },
  { value: 5 as const, label: "금" },
];
const WEEK_PERIODS = [1, 2, 3, 4, 5, 6, 7];
function WeekTimetable({
  slots,
  classes,
}: {
  slots: TimetableSlot[];
  classes: ReturnType<typeof useClassStore.getState>["classes"];
}) {
  const [popup, setPopup] = useState<{
    day: 1 | 2 | 3 | 4 | 5;
    period: number;
    klass: ReturnType<typeof useClassStore.getState>["classes"][0];
    room?: string;
    date: string;
  } | null>(null);
  return (
    <>
    <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-1 min-w-[360px] text-xs">
      <div />
      {WEEK_DAYS.map((d) => (
        <div key={d.value} className="text-center font-semibold py-1 bg-muted/40 rounded">
          {d.label}
        </div>
      ))}
      {WEEK_PERIODS.map((period) => (
        <div key={period} className="contents">
          <div className="text-center text-muted-foreground py-1.5 bg-muted/40 rounded font-medium">
            {period}
          </div>
          {WEEK_DAYS.map((d) => {
            const slot = slots.find(
              (s) => s.dayOfWeek === d.value && s.period === period
            );
            const klass = slot ? classes.find((c) => c.id === slot.classId) : null;
            return (
              <button
                key={d.value}
                type="button"
                disabled={!klass}
                onClick={() => {
                  if (klass) setPopup({ day: d.value, period, klass, room: slot?.room, date: dateOfWeek(d.value) });
                }}
                className={`border rounded p-1 min-h-[44px] flex flex-col items-center justify-center text-center transition-colors ${
                  klass ? "bg-card hover:bg-accent/40 cursor-pointer" : "bg-muted/20 cursor-default"
                }`}
              >
                {klass ? (
                  <>
                    <div className="font-semibold">
                      {klass.grade}-{klass.classNumber}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {klass.homeroom ? "담임" : klass.subject}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
      {popup && (
        <Dialog open={!!popup} onOpenChange={() => setPopup(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {WEEK_DAYS.find((d) => d.value === popup.day)?.label} {popup.period}교시 · {popup.klass.grade}-{popup.klass.classNumber}반
              </DialogTitle>
              <DialogDescription>
                {popup.date} · {popup.klass.homeroom ? "담임 학급" : popup.klass.subject}
                {popup.room ? ` · ${popup.room}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/timetable" onClick={() => setPopup(null)}>
                <Button className="w-full">출결·수업 바로 입력</Button>
              </Link>
              <Link href="/lessons" onClick={() => setPopup(null)}>
                <Button variant="outline" className="w-full">수업 진도 보기</Button>
              </Link>
              <Link href="/attendance" onClick={() => setPopup(null)}>
                <Button variant="outline" className="w-full">출결 현황 보기</Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Button variant="outline" className="w-full">
        {label}
      </Button>
    </Link>
  );
}
