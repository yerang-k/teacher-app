import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import {
  useClassStore,
  useTimetableStore,
  useLessonStore,
  useAttendanceStore,
  useSettingsStore,
} from "@/stores";
import { todayKey, toDateKey } from "@/lib/dateUtils";
import type {
  Semester,
  AttendanceStatus,
  Lesson,
  LessonStatus,
  TimetableSlot,
} from "@/types";

const DAYS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const STATUS_OPTIONS: AttendanceStatus[] = [
  "출석",
  "지각",
  "조퇴",
  "결과",
  "인정결석",
  "질병결석",
  "미인정결석",
  "기타결석",
  "결석",
];

const LESSON_STATUS_OPTIONS: LessonStatus[] = ["예정", "진행중", "완료", "취소"];

function dateOfThisWeek(dayOfWeek: 1 | 2 | 3 | 4 | 5): string {
  const today = new Date();
  const todayDay = today.getDay() === 0 ? 7 : today.getDay();
  const diff = dayOfWeek - todayDay;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  // toISOString()은 UTC 기준이라 한국(UTC+9) 자정~오전9시 사이에 날짜가 하루 밀림
  // toDateKey()는 로컬 날짜를 그대로 사용하므로 안전
  return toDateKey(target);
}

export default function TimetablePage() {
  const settings = useSettingsStore((s) => s.settings);
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);

  const slots = useTimetableStore((s) => s.slots);
  const loadByTerm = useTimetableStore((s) => s.loadByTerm);
  const setSlot = useTimetableStore((s) => s.setSlot);
  const clearSlot = useTimetableStore((s) => s.clearSlot);

  const [year, setYear] = useState<number>(settings.currentYear);
  const [semester, setSemester] = useState<Semester>(settings.currentSemester);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<{
    day: 1 | 2 | 3 | 4 | 5;
    period: number;
  } | null>(null);

  useEffect(() => {
    loadByTerm(year, semester);
  }, [year, semester, loadByTerm]);

  const slotAt = (day: 1 | 2 | 3 | 4 | 5, period: number) =>
    slots.find((s) => s.dayOfWeek === day && s.period === period);

  const selectedSlot = selected ? slotAt(selected.day, selected.period) : null;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">시간표</h1>
          <p className="text-muted-foreground text-sm">
            학기별 시간표를 입력하고, 칸을 클릭해 그 자리에서 바로 출결·수업을 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">학년도</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">학기</Label>
            <Select
              value={String(semester)}
              onValueChange={(v) => setSemester(Number(v) as Semester)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1학기</SelectItem>
                <SelectItem value="2">2학기</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "✓ 편집 종료" : "✎ 시간표 편집"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-[44px_repeat(5,1fr)] gap-1">
              <div className="text-xs text-center text-muted-foreground py-2"></div>
              {DAYS.map((d) => (
                <div
                  key={d.value}
                  className="text-xs text-center font-semibold py-2 bg-muted/40 rounded"
                >
                  {d.label}
                </div>
              ))}

              {PERIODS.map((period) => (
                <Row
                  key={period}
                  period={period}
                  classes={classes}
                  slots={slots}
                  selected={selected}
                  editMode={editMode}
                  year={year}
                  semester={semester}
                  setSlot={setSlot}
                  clearSlot={clearSlot}
                  onSelectCell={(day) => {
                    if (editMode) return;
                    setSelected({ day, period });
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {!selected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">시간표 사용법</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>
                  <strong className="text-foreground">처음 사용시:</strong> 우상단의 "시간표 편집" 버튼을 누르고, 각 칸의 드롭다운에서 학급을 선택해 시간표를 만드세요.
                </p>
                <p>
                  <strong className="text-foreground">평소 사용시:</strong> 편집 모드를 끄고, 시간표의 한 칸을 클릭하면 여기에 그 학급의 출결·수업·진도 입력 영역이 나타납니다.
                </p>
                <p>
                  <strong className="text-foreground">학급명 클릭:</strong> 그 학급의 전체 진도 목록을 볼 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}

          {selected && (
            <SidePanel
              day={selected.day}
              period={selected.period}
              slot={selectedSlot}
              year={year}
              semester={semester}
              classes={classes}
              getStudentsByClass={getStudentsByClass}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  period,
  classes,
  slots,
  selected,
  editMode,
  year,
  semester,
  setSlot,
  clearSlot,
  onSelectCell,
}: {
  period: number;
  classes: ReturnType<typeof useClassStore.getState>["classes"];
  slots: TimetableSlot[];
  selected: { day: 1 | 2 | 3 | 4 | 5; period: number } | null;
  editMode: boolean;
  year: number;
  semester: Semester;
  setSlot: ReturnType<typeof useTimetableStore.getState>["setSlot"];
  clearSlot: ReturnType<typeof useTimetableStore.getState>["clearSlot"];
  onSelectCell: (day: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <>
      <div className="text-xs text-center text-muted-foreground py-2 bg-muted/40 rounded font-medium">
        {period}교시
      </div>
      {DAYS.map((d) => {
        const slot = slots.find(
          (s) => s.dayOfWeek === d.value && s.period === period
        );
        const klass = slot ? classes.find((c) => c.id === slot.classId) : null;
        const isSelected =
          selected && selected.day === d.value && selected.period === period;

        if (editMode) {
          return (
            <div
              key={d.value}
              className="border rounded p-1.5 min-h-[60px] flex flex-col gap-1"
            >
              <Select
                value={slot?.classId ?? "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    clearSlot(year, semester, d.value, period);
                  } else {
                    setSlot({
                      year,
                      semester,
                      dayOfWeek: d.value,
                      period,
                      classId: v,
                      room: slot?.room,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— 비움 —</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade}-{c.classNumber}{" "}
                      {c.homeroom ? "(담임)" : `(${c.subject})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="교실"
                value={slot?.room ?? ""}
                onChange={(e) => {
                  if (slot) {
                    setSlot({
                      year,
                      semester,
                      dayOfWeek: d.value,
                      period,
                      classId: slot.classId,
                      room: e.target.value,
                    });
                  }
                }}
                disabled={!slot}
                className="h-6 text-xs"
              />
            </div>
          );
        }

        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onSelectCell(d.value)}
            className={`border rounded p-1.5 min-h-[60px] text-left transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : klass
                ? "bg-card hover:bg-accent/40"
                : "bg-muted/20 hover:bg-muted/40"
            }`}
          >
            {klass ? (
              <div className="text-xs">
                <div className="font-semibold">
                  {klass.grade}-{klass.classNumber}
                </div>
                <div className={isSelected ? "opacity-90" : "text-muted-foreground"}>
                  {klass.homeroom ? "담임" : klass.subject}
                </div>
                {slot?.room && (
                  <div className="text-[10px] opacity-70">{slot.room}</div>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </button>
        );
      })}
    </>
  );
}

function SidePanel({
  day,
  period,
  slot,
  classes,
  getStudentsByClass,
  onClose,
}: {
  day: 1 | 2 | 3 | 4 | 5;
  period: number;
  slot: TimetableSlot | null | undefined;
  year: number;
  semester: Semester;
  classes: ReturnType<typeof useClassStore.getState>["classes"];
  getStudentsByClass: (id: string) => ReturnType<
    typeof useClassStore.getState
  >["students"];
  onClose: () => void;
}) {
  const klass = slot ? classes.find((c) => c.id === slot.classId) : null;
  const dayLabel = DAYS.find((d) => d.value === day)?.label ?? "";
  const date = dateOfThisWeek(day);
  const [classProgressOpen, setClassProgressOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">
                {dayLabel} {period}교시
              </CardTitle>
              <CardDescription className="text-xs">{date}</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!klass && (
            <p className="text-sm text-muted-foreground">
              이 칸에 배정된 학급이 없습니다. 우상단 "시간표 편집"으로 학급을 추가하세요.
            </p>
          )}
          {klass && (
            <>
              <div className="flex items-center justify-between">
                <button
                  className="font-semibold hover:underline text-left"
                  onClick={() => setClassProgressOpen(true)}
                >
                  {klass.grade}학년 {klass.classNumber}반
                  <span className="text-xs ml-1 text-muted-foreground">
                    ({klass.homeroom ? "담임" : klass.subject})
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClassProgressOpen(true)}
                >
                  진도 전체보기
                </Button>
              </div>
              {slot?.room && (
                <div className="text-xs text-muted-foreground">
                  교실: {slot.room}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {klass && (
        <>
          <LessonQuickEdit classId={klass.id} date={date} period={period} />
          <AttendanceQuickEdit
            classId={klass.id}
            date={date}
            students={getStudentsByClass(klass.id)}
          />
        </>
      )}

      {klass && (
        <ClassProgressDialog
          open={classProgressOpen}
          onOpenChange={setClassProgressOpen}
          classId={klass.id}
          className={`${klass.grade}-${klass.classNumber} ${
            klass.homeroom ? "(담임)" : `(${klass.subject})`
          }`}
        />
      )}
    </>
  );
}

function LessonQuickEdit({
  classId,
  date,
  period,
}: {
  classId: string;
  date: string;
  period: number;
}) {
  const lessons = useLessonStore((s) => s.lessons);
  const loadByDateRange = useLessonStore((s) => s.loadByDateRange);
  const addLesson = useLessonStore((s) => s.addLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);

  useEffect(() => {
    loadByDateRange(date, date);
  }, [classId, date, loadByDateRange]);

  const existing = lessons.find(
    (l) => l.classId === classId && l.date === date && l.period === period
  );

  const [draft, setDraft] = useState({
    unit: "",
    topic: "",
    status: "예정" as LessonStatus,
    reflection: "",
  });

  useEffect(() => {
    if (existing) {
      setDraft({
        unit: existing.unit,
        topic: existing.topic,
        status: existing.status,
        reflection: existing.reflection ?? "",
      });
    } else {
      setDraft({ unit: "", topic: "", status: "예정", reflection: "" });
    }
  }, [existing?.id]);

  const save = async () => {
    if (!draft.topic.trim()) {
      toast.error("차시 주제를 입력하세요.");
      return;
    }
    if (existing) {
      await updateLesson(existing.id, {
        unit: draft.unit,
        topic: draft.topic,
        status: draft.status,
        reflection: draft.reflection || undefined,
      });
      toast.success("수업을 수정했습니다.");
    } else {
      await addLesson({
        classId,
        date,
        period,
        unit: draft.unit,
        topic: draft.topic,
        status: draft.status,
        reflection: draft.reflection || undefined,
      });
      toast.success("수업을 추가했습니다.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">수업 기록</CardTitle>
        <CardDescription className="text-xs">
          {existing ? "기록된 수업을 수정합니다." : "이 차시의 새 수업 기록"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          placeholder="단원"
          value={draft.unit}
          onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
        />
        <Input
          placeholder="차시 주제 *"
          value={draft.topic}
          onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={draft.status}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, status: v as LessonStatus }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LESSON_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={save}>저장</Button>
        </div>
        <Textarea
          placeholder="수업 후 성찰 (선택)"
          rows={2}
          value={draft.reflection}
          onChange={(e) =>
            setDraft((d) => ({ ...d, reflection: e.target.value }))
          }
        />
      </CardContent>
    </Card>
  );
}

function AttendanceQuickEdit({
  classId,
  date,
  students,
}: {
  classId: string;
  date: string;
  students: ReturnType<typeof useClassStore.getState>["students"];
}) {
  const records = useAttendanceStore((s) => s.records);
  const loadByClassDate = useAttendanceStore((s) => s.loadByClassDate);
  const upsertDaily = useAttendanceStore((s) => s.upsertDaily);

  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadByClassDate(classId, date);
  }, [classId, date, loadByClassDate]);

  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      const rec = records.find((r) => r.studentId === s.id);
      next[s.id] = rec?.status ?? "출석";
    });
    setDraft(next);
  }, [records, students]);

  const stats = useMemo(() => {
    const r: Record<AttendanceStatus, number> = {
      출석: 0, 결석: 0, 지각: 0, 조퇴: 0, 결과: 0,
      인정결석: 0, 질병결석: 0, 미인정결석: 0, 기타결석: 0,
    };
    Object.values(draft).forEach((s) => (r[s] += 1));
    return r;
  }, [draft]);

  const absent = students.length - stats.출석;

  const save = async () => {
    const rows = students.map((s) => ({
      studentId: s.id,
      status: draft[s.id] ?? "출석",
    }));
    await upsertDaily(classId, date, rows);
    toast.success(`${date} 출결 저장 완료`);
  };

  const visible = showAll
    ? students
    : students.filter((s) => (draft[s.id] ?? "출석") !== "출석");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">출결</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={absent > 0 ? "destructive" : "outline"}>
              결석 외 {absent}명
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "결석만" : "전체"}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          기본값은 출석. 변경할 학생만 드롭다운으로 바꾸세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {students.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            이 학급에 등록된 학생이 없습니다.
          </p>
        ) : (
          <>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {visible.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-xs w-16 truncate">
                    {s.number}. {s.name}
                  </span>
                  <Select
                    value={draft[s.id] ?? "출석"}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, [s.id]: v as AttendanceStatus }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {visible.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  결석한 학생이 없습니다.
                </p>
              )}
            </div>
            <Button onClick={save} className="w-full mt-2" size="sm">
              출결 저장
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClassProgressDialog({
  open,
  onOpenChange,
  classId,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
}) {
  const lessons = useLessonStore((s) => s.lessons);
  const loadByClass = useLessonStore((s) => s.loadByClass);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const removeLesson = useLessonStore((s) => s.removeLesson);

  const [editing, setEditing] = useState<Lesson | null>(null);

  useEffect(() => {
    if (open) loadByClass(classId);
  }, [open, classId, loadByClass]);

  const filtered = lessons
    .filter((l) => l.classId === classId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{className} 진도</DialogTitle>
          <DialogDescription>
            등록된 모든 수업이 날짜 순으로 표시됩니다. 항목을 클릭해 수정하세요.
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                아직 기록된 수업이 없습니다.
              </p>
            ) : (
              filtered.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setEditing(l)}
                  className="w-full text-left border rounded p-2 hover:bg-accent/40 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {l.date} · {l.period}교시
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {l.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {l.unit && `${l.unit} · `}
                    {l.topic}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {editing.date} · {editing.period}교시
            </div>
            <Input
              value={editing.unit ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, unit: e.target.value } as Lesson)
              }
              placeholder="단원"
            />
            <Input
              value={editing.topic}
              onChange={(e) =>
                setEditing({ ...editing, topic: e.target.value } as Lesson)
              }
              placeholder="차시 주제"
            />
            <Select
              value={editing.status}
              onValueChange={(v) =>
                setEditing({ ...editing, status: v as LessonStatus } as Lesson)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={editing.reflection ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, reflection: e.target.value } as Lesson)
              }
              placeholder="수업 후 성찰"
              rows={3}
            />
            <Separator />
            <div className="flex justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!confirm("이 수업을 삭제할까요?")) return;
                  await removeLesson(editing.id);
                  setEditing(null);
                  toast.success("삭제했습니다.");
                }}
              >
                삭제
              </Button>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await updateLesson(editing.id, {
                      unit: editing.unit,
                      topic: editing.topic,
                      status: editing.status,
                      reflection: editing.reflection,
                    });
                    setEditing(null);
                    toast.success("수정 완료");
                  }}
                >
                  저장
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
