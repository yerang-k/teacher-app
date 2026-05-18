import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useClassStore, useLessonStore } from "@/stores";
import { todayKey, weekdaysOfThisWeek } from "@/lib/dateUtils";
import type { Lesson, LessonStatus } from "@/types";

const STATUS_OPTIONS: LessonStatus[] = ["예정", "진행중", "완료", "취소"];

const STATUS_STYLE: Record<LessonStatus, string> = {
  예정: "bg-slate-100 text-slate-700 border-slate-200",
  진행중: "bg-amber-100 text-amber-800 border-amber-200",
  완료: "bg-emerald-100 text-emerald-800 border-emerald-200",
  취소: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function LessonsPage() {
  const classes = useClassStore((s) => s.classes);
  const lessons = useLessonStore((s) => s.lessons);
  const loadByDateRange = useLessonStore((s) => s.loadByDateRange);
  const addLesson = useLessonStore((s) => s.addLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const removeLesson = useLessonStore((s) => s.removeLesson);
  const bulkAddWeekly = useLessonStore((s) => s.bulkAddWeekly);

  const [classId, setClassId] = useState<string>("all");
  const [weekStart, setWeekStart] = useState<string>(
    () => weekdaysOfThisWeek()[0]
  );

  // 표시 중인 주의 평일 (월~금)
  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [weekStart]);

  // 주차 조회
  useEffect(() => {
    const from = weekDays[0];
    const to = weekDays[weekDays.length - 1];
    loadByDateRange(from, to, classId === "all" ? undefined : classId);
  }, [weekDays, classId, loadByDateRange]);

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const d of weekDays) map.set(d, []);
    for (const l of lessons) {
      if (classId !== "all" && l.classId !== classId) continue;
      const arr = map.get(l.date);
      if (arr) arr.push(l);
    }
    map.forEach((arr) => arr.sort((a, b) => a.period - b.period));
    return map;
  }, [lessons, weekDays, classId]);

  // 차시 추가/편집 다이얼로그 상태
  const [editing, setEditing] = useState<Partial<Lesson> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = (date: string) => {
    setEditing({
      classId: classId || classes[0]?.id || "",
      date,
      period: 1,
      unit: "",
      topic: "",
      status: "예정",
    });
    setDialogOpen(true);
  };

  const openEdit = (l: Lesson) => {
    setEditing(l);
    setDialogOpen(true);
  };

  const saveEditing = async () => {
    if (!editing?.classId || !editing.date || !editing.topic?.trim()) {
      toast.error("학급, 날짜, 차시 주제는 필수입니다.");
      return;
    }
    if (editing.id) {
      await updateLesson(editing.id, editing);
      toast.success("수업을 수정했습니다.");
    } else {
      await addLesson({
        classId: editing.classId!,
        date: editing.date!,
        period: editing.period ?? 1,
        unit: editing.unit ?? "",
        topic: editing.topic!,
        objectives: editing.objectives,
        materials: editing.materials,
        activities: editing.activities,
        homework: editing.homework,
        status: (editing.status as LessonStatus) ?? "예정",
        reflection: editing.reflection,
      });
      toast.success("수업을 추가했습니다.");
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const deleteEditing = async () => {
    if (!editing?.id) return;
    if (!confirm("이 차시를 삭제할까요?")) return;
    await removeLesson(editing.id);
    setDialogOpen(false);
    setEditing(null);
    toast.success("삭제했습니다.");
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  // 주간 일괄 등록 (단원/차시 주제 한 줄에 평일 5일 동일 적용)
  const [bulkUnit, setBulkUnit] = useState("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkPeriod, setBulkPeriod] = useState(1);

  const handleBulkWeekly = async () => {
    if (!classId) {
      toast.error("학급을 먼저 선택하세요.");
      return;
    }
    if (!bulkTopic.trim()) {
      toast.error("차시 주제를 입력하세요.");
      return;
    }
    await bulkAddWeekly(classId, weekDays, {
      period: bulkPeriod,
      unit: bulkUnit,
      topic: bulkTopic,
      status: "예정",
    });
    toast.success(`${weekDays[0]} ~ ${weekDays[4]} 평일에 차시를 일괄 등록했습니다.`);
    setBulkUnit("");
    setBulkTopic("");
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">수업·진도 관리</h1>
        <p className="text-muted-foreground">
          국어 수업 단원·차시·학습 활동을 주간 단위로 관리합니다.
        </p>
      </div>

      {/* 조회 조건 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">주차 보기</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>학급</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="전체 학급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학급</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.grade}-{c.classNumber}{" "}
                    {c.homeroom ? "(담임)" : `(${c.subject})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>주의 시작일 (월요일)</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => shiftWeek(-1)}>
              ← 지난 주
            </Button>
            <Button
              variant="outline"
              onClick={() => setWeekStart(weekdaysOfThisWeek()[0])}
            >
              이번 주
            </Button>
            <Button variant="outline" onClick={() => shiftWeek(1)}>
              다음 주 →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 주간 그리드 */}
      <div className="grid grid-cols-5 gap-3">
        {weekDays.map((d) => {
          const list = lessonsByDay.get(d) ?? [];
          const isToday = d === todayKey();
          return (
            <Card
              key={d}
              className={isToday ? "border-primary shadow-sm" : ""}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>
                    {new Date(d).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </span>
                  {isToday && (
                    <Badge variant="default" className="text-xs">
                      오늘
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[200px]">
                {list.map((l) => {
                  const klass = classes.find((c) => c.id === l.classId);
                  return (
                    <button
                      key={l.id}
                      onClick={() => openEdit(l)}
                      className={`w-full text-left border rounded p-2 text-xs hover:shadow-sm transition-shadow ${STATUS_STYLE[l.status]}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {l.period}교시
                          {klass ? ` · ${klass.grade}-${klass.classNumber}` : ""}
                        </span>
                        <span className="opacity-70">{l.status}</span>
                      </div>
                      <div className="font-medium mt-1 line-clamp-1">{l.topic}</div>
                      {l.unit && (
                        <div className="opacity-70 line-clamp-1">{l.unit}</div>
                      )}
                    </button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => openNew(d)}
                >
                  + 차시 추가
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 주간 일괄 등록 */}
      {classId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">이번 주 평일 일괄 등록</CardTitle>
            <CardDescription>
              월~금 5일 동일한 차시를 선택한 학급에 한 번에 추가합니다. (시간표 초안용)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>교시</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={bulkPeriod}
                onChange={(e) => setBulkPeriod(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>단원</Label>
              <Input
                value={bulkUnit}
                onChange={(e) => setBulkUnit(e.target.value)}
                placeholder="예) 2단원. 문학의 갈래"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>차시 주제</Label>
              <Input
                value={bulkTopic}
                onChange={(e) => setBulkTopic(e.target.value)}
                placeholder="예) 시의 운율과 표현"
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button onClick={handleBulkWeekly}>일괄 등록</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 차시 편집 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "차시 수정" : "차시 추가"}
            </DialogTitle>
            <DialogDescription>
              학습 목표·활동·과제·성찰까지 한번에 기록할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>학급</Label>
                  <Select
                    value={editing.classId}
                    onValueChange={(v) =>
                      setEditing((e) => ({ ...e, classId: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.grade}-{c.classNumber}{" "}
                          {c.homeroom ? "(담임)" : `(${c.subject})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>상태</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v) =>
                      setEditing((e) => ({
                        ...e,
                        status: v as LessonStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>날짜</Label>
                  <Input
                    type="date"
                    value={editing.date ?? ""}
                    onChange={(e) =>
                      setEditing((x) => ({ ...x, date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>교시</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={editing.period ?? 1}
                    onChange={(e) =>
                      setEditing((x) => ({
                        ...x,
                        period: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>단원</Label>
                <Input
                  value={editing.unit ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, unit: e.target.value }))
                  }
                  placeholder="예) 1단원. 문학의 이해"
                />
              </div>
              <div className="space-y-1.5">
                <Label>차시 주제 *</Label>
                <Input
                  value={editing.topic ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, topic: e.target.value }))
                  }
                  placeholder="예) 운율의 효과 이해하기"
                />
              </div>
              <div className="space-y-1.5">
                <Label>학습 목표</Label>
                <Textarea
                  rows={2}
                  value={editing.objectives ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, objectives: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>학습 활동</Label>
                  <Textarea
                    rows={3}
                    value={editing.activities ?? ""}
                    onChange={(e) =>
                      setEditing((x) => ({
                        ...x,
                        activities: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>수업 자료</Label>
                  <Textarea
                    rows={3}
                    value={editing.materials ?? ""}
                    onChange={(e) =>
                      setEditing((x) => ({
                        ...x,
                        materials: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>과제</Label>
                  <Textarea
                    rows={2}
                    value={editing.homework ?? ""}
                    onChange={(e) =>
                      setEditing((x) => ({ ...x, homework: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>수업 후 성찰</Label>
                  <Textarea
                    rows={2}
                    value={editing.reflection ?? ""}
                    onChange={(e) =>
                      setEditing((x) => ({
                        ...x,
                        reflection: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editing?.id && (
                <Button variant="destructive" onClick={deleteEditing}>
                  삭제
                </Button>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={saveEditing}>저장</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
