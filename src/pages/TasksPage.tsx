import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, CalendarDays, CircleUserRound } from "lucide-react";

import { useTaskStore, useEventStore } from "@/stores";
import { todayKey, daysBetween } from "@/lib/dateUtils";
import { linkifyText } from "@/lib/linkify";
import TaskCalendar, { SCOPE_BAR } from "@/components/TaskCalendar";
import type {
  SchoolTask,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  SchoolEvent,
  EventCategory,
  EventScope,
} from "@/types";

const CATEGORIES: TaskCategory[] = [
  "정보부",
  "AI디지털선도학교",
  "수업",
  "담임",
  "교과",
  "행정",
  "연수",
  "기타",
];
const PRIORITIES: TaskPriority[] = ["낮음", "보통", "높음", "긴급"];
const STATUSES: TaskStatus[] = ["대기", "진행중", "보류", "완료"];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  낮음: "bg-slate-100 text-slate-700",
  보통: "bg-blue-100 text-blue-700",
  높음: "bg-amber-100 text-amber-800",
  긴급: "bg-rose-100 text-rose-800",
};
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  긴급: 0,
  높음: 1,
  보통: 2,
  낮음: 3,
};

const CATEGORY_COLOR: Record<TaskCategory, string> = {
  정보부: "bg-indigo-50 text-indigo-700 border-indigo-200",
  AI디지털선도학교: "bg-purple-50 text-purple-700 border-purple-200",
  수업: "bg-blue-50 text-blue-700 border-blue-200",
  담임: "bg-emerald-50 text-emerald-700 border-emerald-200",
  교과: "bg-cyan-50 text-cyan-700 border-cyan-200",
  행정: "bg-slate-50 text-slate-700 border-slate-200",
  연수: "bg-amber-50 text-amber-700 border-amber-200",
  기타: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

const EVENT_CATEGORIES: EventCategory[] = ["학사일정", "교내행사", "방학", "대회·체육행사", "기타"];
const EVENT_CATEGORY_BADGE: Record<EventCategory, string> = {
  학사일정: "bg-violet-50 text-violet-700 border-violet-200",
  교내행사: "bg-teal-50 text-teal-700 border-teal-200",
  방학: "bg-sky-50 text-sky-700 border-sky-200",
  "대회·체육행사": "bg-orange-50 text-orange-700 border-orange-200",
  기타: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

// 마감일 기준 섹션 정의
type GroupKey = "지연" | "오늘" | "이번 주" | "앞으로" | "기한 없음" | "완료";
const GROUP_META: Record<GroupKey, { emoji: string; desc: string; accent: string }> = {
  지연: { emoji: "🔴", desc: "마감이 지났어요", accent: "text-rose-600" },
  오늘: { emoji: "☀️", desc: "오늘까지", accent: "text-orange-600" },
  "이번 주": { emoji: "📅", desc: "7일 이내", accent: "text-amber-600" },
  앞으로: { emoji: "🗓️", desc: "여유 있음", accent: "text-slate-600" },
  "기한 없음": { emoji: "⬜", desc: "마감일 미정", accent: "text-slate-500" },
  완료: { emoji: "✅", desc: "끝낸 업무", accent: "text-emerald-600" },
};
const GROUP_ORDER: GroupKey[] = ["지연", "오늘", "이번 주", "앞으로", "기한 없음", "완료"];

/** 마감일 → D-day 배지 정보 */
function dInfo(dueDate: string | undefined, done: boolean) {
  if (done) return { label: "완료", cls: "bg-emerald-100 text-emerald-700" };
  if (!dueDate) return { label: "기한없음", cls: "bg-slate-100 text-slate-500" };
  const d = daysBetween(todayKey(), dueDate);
  if (d < 0) return { label: `${-d}일 지남`, cls: "bg-rose-600 text-white" };
  if (d === 0) return { label: "D-DAY", cls: "bg-rose-500 text-white" };
  if (d <= 7) return { label: `D-${d}`, cls: "bg-amber-100 text-amber-800" };
  return { label: `D-${d}`, cls: "bg-slate-100 text-slate-600" };
}

/** 이 업무가 언제 요청/등록됐는지 (메신저 수신일 우선, 없으면 등록일) → 'M/D' */
function requestedLabel(t: SchoolTask): string {
  let iso = "";
  if (t.receivedAt) {
    iso = t.receivedAt.slice(0, 10);
  } else if (t.createdAt) {
    const d = new Date(t.createdAt);
    iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : "";
}

function groupOf(t: SchoolTask): GroupKey {
  if (t.status === "완료") return "완료";
  if (!t.dueDate) return "기한 없음";
  const d = daysBetween(todayKey(), t.dueDate);
  if (d < 0) return "지연";
  if (d === 0) return "오늘";
  if (d <= 7) return "이번 주";
  return "앞으로";
}

export default function TasksPage() {
  const tasks = useTaskStore((s) => s.tasks);
  const loadAll = useTaskStore((s) => s.loadAll);
  const filters = useTaskStore((s) => s.filters);
  const setFilters = useTaskStore((s) => s.setFilters);
  const clearFilters = useTaskStore((s) => s.clearFilters);
  const filtered = useTaskStore((s) => s.filtered);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const setStatus = useTaskStore((s) => s.setStatus);
  const toggleChecklist = useTaskStore((s) => s.toggleChecklistItem);
  const addChecklistItem = useTaskStore((s) => s.addChecklistItem);

  const loadAllEvents = useEventStore((s) => s.loadAll);
  const eventFilters = useEventStore((s) => s.filters);
  const setEventFilters = useEventStore((s) => s.setFilters);
  const clearEventFilters = useEventStore((s) => s.clearFilters);
  const filteredEvents = useEventStore((s) => s.filtered);
  const eventsByScope = useEventStore((s) => s.byScope);
  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const removeEvent = useEventStore((s) => s.removeEvent);
  const toggleEventChecklist = useEventStore((s) => s.toggleChecklistItem);
  const addEventChecklistItem = useEventStore((s) => s.addChecklistItem);

  const [itemType, setItemType] = useState<"task" | "event" | "personal">("task");
  const itemScope: EventScope = itemType === "personal" ? "personal" : "school";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SchoolTask> | null>(null);
  const [checklistInput, setChecklistInput] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showFilters, setShowFilters] = useState(true);

  const changeViewMode = (mode: "list" | "calendar") => {
    setViewMode(mode);
    setShowFilters(mode === "list");
  };

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<SchoolEvent> | null>(null);
  const [eventChecklistInput, setEventChecklistInput] = useState("");

  useEffect(() => {
    loadAll();
    loadAllEvents();
  }, [loadAll, loadAllEvents]);

  const openNew = () => {
    setEditing({
      title: "",
      description: "",
      category: "정보부",
      priority: "보통",
      status: "대기",
      dueDate: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (t: SchoolTask) => {
    setEditing(t);
    setShowSource(false);
    setDialogOpen(true);
  };

  const openNewOnDate = (dateKey: string) => {
    setEditing({
      title: "",
      description: "",
      category: "정보부",
      priority: "보통",
      status: "대기",
      dueDate: dateKey,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!editing?.title?.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    if (editing.id) {
      await updateTask(editing.id, editing);
      toast.success("업무를 수정했습니다.");
    } else {
      await addTask({
        title: editing.title!,
        description: editing.description,
        category: editing.category!,
        priority: editing.priority!,
        status: editing.status!,
        dueDate: editing.dueDate || undefined,
        checklist: editing.checklist,
      });
      toast.success("업무를 추가했습니다.");
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!confirm("이 업무를 삭제할까요?")) return;
    await removeTask(editing.id);
    setDialogOpen(false);
    setEditing(null);
  };

  const openNewEvent = () => {
    const t = todayKey();
    setEditingEvent({
      title: "",
      description: "",
      scope: itemScope,
      category: itemScope === "school" ? "학사일정" : undefined,
      startDate: t,
      endDate: t,
      allDay: true,
      location: "",
    });
    setEventDialogOpen(true);
  };

  const openEditEvent = (e: SchoolEvent) => {
    setEditingEvent(e);
    setEventDialogOpen(true);
  };

  const openNewEventOnDate = (dateKey: string) => {
    setEditingEvent({
      title: "",
      description: "",
      scope: itemScope,
      category: itemScope === "school" ? "학사일정" : undefined,
      startDate: dateKey,
      endDate: dateKey,
      allDay: true,
      location: "",
    });
    setEventDialogOpen(true);
  };

  const handleDayClick = (dateKey: string) =>
    itemType === "task" ? openNewOnDate(dateKey) : openNewEventOnDate(dateKey);

  const saveEvent = async () => {
    if (!editingEvent?.title?.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    if (!editingEvent.startDate) {
      toast.error("시작일을 입력하세요.");
      return;
    }
    const scope = editingEvent.scope ?? "school";
    const endDate = editingEvent.endDate && editingEvent.endDate >= editingEvent.startDate
      ? editingEvent.endDate
      : editingEvent.startDate;
    const label = scope === "school" ? "행사" : "개인 일정";
    if (editingEvent.id) {
      await updateEvent(editingEvent.id, {
        ...editingEvent,
        endDate,
        category: scope === "school" ? editingEvent.category : undefined,
      });
      toast.success(`${label}을 수정했습니다.`);
    } else {
      await addEvent({
        title: editingEvent.title!,
        description: editingEvent.description,
        scope,
        category: scope === "school" ? editingEvent.category : undefined,
        startDate: editingEvent.startDate,
        endDate,
        allDay: editingEvent.allDay ?? true,
        time: editingEvent.allDay ? undefined : editingEvent.time,
        location: editingEvent.location,
        checklist: editingEvent.checklist,
      });
      toast.success(`${label}을 추가했습니다.`);
    }
    setEventDialogOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
    const label = editingEvent.scope === "personal" ? "개인 일정" : "행사";
    if (!confirm(`이 ${label}을 삭제할까요?`)) return;
    await removeEvent(editingEvent.id);
    setEventDialogOpen(false);
    setEditingEvent(null);
  };

  // 필터 적용 후 마감일 섹션으로 묶기
  const view = filtered();
  const groups: Record<GroupKey, SchoolTask[]> = {
    지연: [],
    오늘: [],
    "이번 주": [],
    앞으로: [],
    "기한 없음": [],
    완료: [],
  };
  view.forEach((t) => groups[groupOf(t)].push(t));

  const byDue = (a: SchoolTask, b: SchoolTask) => {
    const c = (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
    if (c !== 0) return c;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  };
  groups["지연"].sort(byDue);
  groups["오늘"].sort(byDue);
  groups["이번 주"].sort(byDue);
  groups["앞으로"].sort(byDue);
  groups["기한 없음"].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.updatedAt - a.updatedAt
  );
  groups["완료"].sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));

  const activeCount =
    view.length - groups["완료"].length;

  const TaskRow = ({ t }: { t: SchoolTask }) => {
    const done = t.status === "완료";
    const dd = dInfo(t.dueDate, done);
    const checkDone = t.checklist?.filter((c) => c.done).length ?? 0;
    const checkTotal = t.checklist?.length ?? 0;
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 hover:bg-muted/40 transition-colors">
        {/* 완료 토글 */}
        <button
          title={done ? "완료 취소" : "완료 처리"}
          onClick={() => setStatus(t.id, done ? "대기" : "완료")}
          className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center text-[11px] ${
            done
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 text-transparent hover:border-emerald-400"
          }`}
        >
          ✓
        </button>

        {/* D-day */}
        <span
          className={`shrink-0 w-16 text-center text-xs font-bold rounded px-1.5 py-1 ${dd.cls}`}
        >
          {dd.label}
        </span>

        {/* 본문 (클릭 시 편집) */}
        <button
          onClick={() => openEdit(t)}
          className="flex-1 min-w-0 text-left"
        >
          <div
            className={`font-medium text-sm truncate flex items-center gap-1 ${
              done ? "line-through text-muted-foreground" : ""
            }`}
          >
            {t.source === "messenger" && (
              <span title="메신저에서 자동 등록됨" className="shrink-0">✉️</span>
            )}
            <span className="truncate">{t.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge className={CATEGORY_COLOR[t.category]} variant="outline">
              {t.category}
            </Badge>
            <Badge className={PRIORITY_COLOR[t.priority]} variant="outline">
              {t.priority}
            </Badge>
            {t.dueDate && (
              <span className="text-xs text-muted-foreground">{t.dueDate}</span>
            )}
            {checkTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                ☑ {checkDone}/{checkTotal}
              </span>
            )}
            {t.status !== "완료" && t.status !== "대기" && (
              <span className="text-xs text-muted-foreground">· {t.status}</span>
            )}
          </div>
        </button>

        {/* 요청일 (마감일이 없어도 언제 온 업무인지 오른쪽 끝에 표시) */}
        {requestedLabel(t) && (
          <div className="shrink-0 text-right leading-tight">
            <div className="text-[10px] text-muted-foreground">요청</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {requestedLabel(t)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const calendarEvents = filteredEvents();
  const eventView = eventsByScope(itemScope)
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const selectItemType = (t: "task" | "event" | "personal") => {
    setItemType(t);
    if (t !== "task") clearEventFilters();
  };

  return (
    <div
      className={`container mx-auto p-4 sm:p-6 space-y-5 ${
        viewMode === "calendar" ? "max-w-7xl" : "max-w-5xl"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">업무·행사·개인일정</h1>
          <p className="text-sm text-muted-foreground">
            {itemType === "task"
              ? `마감일 기준으로 정리했어요. 처리할 일이 ${activeCount}건 있습니다.`
              : itemType === "event"
              ? `학사일정·교내행사 등을 달력에 함께 표시합니다. 등록된 행사가 ${eventsByScope("school").length}건 있습니다.`
              : `개인 용무·약속을 달력에 함께 표시합니다. 등록된 일정이 ${eventsByScope("personal").length}건 있습니다.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-md border p-0.5">
            <Button
              variant={itemType === "task" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5"
              onClick={() => selectItemType("task")}
            >
              <ClipboardList className="h-3.5 w-3.5" /> 업무
            </Button>
            <Button
              variant={itemType === "event" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5"
              onClick={() => selectItemType("event")}
            >
              <CalendarDays className="h-3.5 w-3.5" /> 행사
            </Button>
            <Button
              variant={itemType === "personal" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 gap-1.5"
              onClick={() => selectItemType("personal")}
            >
              <CircleUserRound className="h-3.5 w-3.5" /> 개인
            </Button>
          </div>
          <div className="flex rounded-md border p-0.5">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => changeViewMode("list")}
            >
              목록
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => changeViewMode("calendar")}
            >
              달력
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-muted-foreground"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? "필터 접기 ▲" : "필터 펼치기 ▼"}
          </Button>
          <Button onClick={itemType === "task" ? openNew : openNewEvent} className="shrink-0">
            {itemType === "task" ? "+ 새 업무" : itemType === "event" ? "+ 새 행사" : "+ 새 일정"}
          </Button>
        </div>
      </div>

      {/* 필터 */}
      {showFilters && (
      itemType === "task" ? (
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>분류</Label>
            <Select
              value={filters.category ?? ""}
              onValueChange={(v) =>
                setFilters({
                  category: (v === "all" ? undefined : (v as TaskCategory)) || undefined,
                })
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>우선순위</Label>
            <Select
              value={filters.priority ?? ""}
              onValueChange={(v) =>
                setFilters({
                  priority: (v === "all" ? undefined : (v as TaskPriority)) || undefined,
                })
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <Label>검색</Label>
            <Input
              placeholder="제목·내용 검색"
              value={filters.keyword ?? ""}
              onChange={(e) => setFilters({ keyword: e.target.value })}
            />
          </div>
          <Button variant="ghost" onClick={clearFilters}>
            초기화
          </Button>
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          {itemType === "event" && (
          <div className="space-y-1.5">
            <Label>분류</Label>
            <Select
              value={eventFilters.category ?? ""}
              onValueChange={(v) =>
                setEventFilters({
                  category: (v === "all" ? undefined : (v as EventCategory)) || undefined,
                })
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {EVENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <Label>검색</Label>
            <Input
              placeholder="제목·장소 검색"
              value={eventFilters.keyword ?? ""}
              onChange={(e) => setEventFilters({ keyword: e.target.value })}
            />
          </div>
          <Button variant="ghost" onClick={clearEventFilters}>
            초기화
          </Button>
        </CardContent>
      </Card>
      )
      )}

      {viewMode === "calendar" ? (
        <TaskCalendar
          tasks={view}
          events={calendarEvents}
          onTaskClick={openEdit}
          onEventClick={openEditEvent}
          onDayClick={handleDayClick}
        />
      ) : itemType === "task" ? (
        view.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>표시할 업무가 없습니다.</p>
        </div>
        ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((key) => {
            const items = groups[key];
            if (items.length === 0) return null;
            const meta = GROUP_META[key];
            const collapsed = key === "완료" && !showDone;
            return (
              <section key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{meta.emoji}</span>
                  <h2 className={`font-semibold ${meta.accent}`}>{key}</h2>
                  <span className="text-xs text-muted-foreground">
                    {meta.desc} · {items.length}건
                  </span>
                  {key === "완료" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      onClick={() => setShowDone((v) => !v)}
                    >
                      {showDone ? "접기" : "펼치기"}
                    </Button>
                  )}
                </div>
                {!collapsed && (
                  <div className="space-y-2">
                    {items.map((t) => (
                      <TaskRow key={t.id} t={t} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        )
      ) : eventView.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          {itemType === "event" ? (
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
          ) : (
            <CircleUserRound className="h-10 w-10 mx-auto mb-2 opacity-40" />
          )}
          <p>{itemType === "event" ? "등록된 행사가 없습니다." : "등록된 개인 일정이 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventView.map((e) => {
            const checkDone = e.checklist?.filter((c) => c.done).length ?? 0;
            const checkTotal = e.checklist?.length ?? 0;
            const range = e.startDate === e.endDate ? e.startDate : `${e.startDate} ~ ${e.endDate}`;
            return (
              <button
                key={e.id}
                onClick={() => openEditEvent(e)}
                className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${SCOPE_BAR[e.scope].split(" ")[0]}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{e.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {e.category && (
                      <Badge className={EVENT_CATEGORY_BADGE[e.category]} variant="outline">
                        {e.category}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {range}
                      {!e.allDay && e.time ? ` · ${e.time}` : ""}
                    </span>
                    {e.location && (
                      <span className="text-xs text-muted-foreground">· 📍{e.location}</span>
                    )}
                    {checkTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ☑ {checkDone}/{checkTotal}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 추가/편집 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "업무 수정" : "새 업무"}</DialogTitle>
            <DialogDescription>
              제목과 분류, 마감일, 체크리스트를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              {editing.source === "messenger" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5 font-medium text-blue-800">
                    <span>✉️</span> 메신저에서 자동 등록된 업무
                  </div>
                  {editing.sender && (
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-blue-700/70">발신자</span>
                      <span className="text-slate-700">{editing.sender}</span>
                    </div>
                  )}
                  {editing.receivedAt && (
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-blue-700/70">수신시각</span>
                      <span className="text-slate-700">{editing.receivedAt}</span>
                    </div>
                  )}
                  {editing.attachments && editing.attachments.length > 0 && (
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-blue-700/70">첨부</span>
                      <div className="space-y-0.5">
                        {editing.attachments.map((a, i) => (
                          <div key={i} className="text-slate-700">📎 {a}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {editing.sourceBody && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSource((v) => !v)}
                        className="text-xs text-blue-700 underline"
                      >
                        {showSource ? "원문 접기" : "원문 보기"}
                      </button>
                      {showSource && (
                        <pre className="mt-1.5 max-h-60 overflow-auto whitespace-pre-wrap rounded border bg-white p-2 text-xs text-slate-700">
                          {linkifyText(editing.sourceBody)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>제목 *</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {editing.source === "messenger" ? "정리 내용 / 메모" : "상세 내용"}
                </Label>
                <Textarea
                  rows={4}
                  placeholder="업무의 구체적인 내용, 준비물, 메모 등을 자유롭게 적어두세요."
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>분류</Label>
                  <Select
                    value={editing.category}
                    onValueChange={(v) =>
                      setEditing((x) => ({ ...x, category: v as TaskCategory }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>우선순위</Label>
                  <Select
                    value={editing.priority}
                    onValueChange={(v) =>
                      setEditing((x) => ({ ...x, priority: v as TaskPriority }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
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
                      setEditing((x) => ({ ...x, status: v as TaskStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>마감일</Label>
                <Input
                  type="date"
                  value={editing.dueDate ?? ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, dueDate: e.target.value }))
                  }
                />
              </div>

              {/* 체크리스트 */}
              <div className="space-y-2">
                <Label>체크리스트</Label>
                {(editing.checklist ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() => {
                        if (editing.id) toggleChecklist(editing.id, c.id);
                        setEditing((x) => ({
                          ...x,
                          checklist: (x?.checklist ?? []).map((ci) =>
                            ci.id === c.id ? { ...ci, done: !ci.done } : ci
                          ),
                        }));
                      }}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        c.done ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {c.text}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing((x) => ({
                          ...x,
                          checklist: (x?.checklist ?? []).filter(
                            (ci) => ci.id !== c.id
                          ),
                        }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="체크리스트 항목 입력 후 Enter"
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!checklistInput.trim()) return;
                        if (editing.id) {
                          addChecklistItem(editing.id, checklistInput);
                        }
                        setEditing((x) => ({
                          ...x,
                          checklist: [
                            ...(x?.checklist ?? []),
                            {
                              id: Math.random().toString(36).slice(2),
                              text: checklistInput,
                              done: false,
                            },
                          ],
                        }));
                        setChecklistInput("");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editing?.id && (
                <Button variant="destructive" onClick={handleDelete}>
                  삭제
                </Button>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={save}>저장</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 행사/개인 일정 추가·편집 다이얼로그 */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingEvent?.scope === "personal"
                ? editingEvent?.id ? "개인 일정 수정" : "새 개인 일정"
                : editingEvent?.id ? "행사 수정" : "새 행사"}
            </DialogTitle>
            <DialogDescription>
              제목과 기간, 장소, 체크리스트를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          {editingEvent && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>제목 *</Label>
                <Input
                  value={editingEvent.title ?? ""}
                  onChange={(e) =>
                    setEditingEvent((x) => ({ ...x, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>메모</Label>
                <Textarea
                  rows={3}
                  placeholder="관련 안내, 유의사항 등을 자유롭게 적어두세요."
                  value={editingEvent.description ?? ""}
                  onChange={(e) =>
                    setEditingEvent((x) => ({ ...x, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {editingEvent.scope !== "personal" && (
                  <div className="space-y-1.5">
                    <Label>분류</Label>
                    <Select
                      value={editingEvent.category}
                      onValueChange={(v) =>
                        setEditingEvent((x) => ({ ...x, category: v as EventCategory }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={`space-y-1.5 ${editingEvent.scope === "personal" ? "col-span-2" : ""}`}>
                  <Label>장소</Label>
                  <Input
                    placeholder="예) 대강당, 운동장"
                    value={editingEvent.location ?? ""}
                    onChange={(e) =>
                      setEditingEvent((x) => ({ ...x, location: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>시작일</Label>
                  <Input
                    type="date"
                    value={editingEvent.startDate ?? ""}
                    onChange={(e) =>
                      setEditingEvent((x) => ({ ...x, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>종료일</Label>
                  <Input
                    type="date"
                    value={editingEvent.endDate ?? ""}
                    onChange={(e) =>
                      setEditingEvent((x) => ({ ...x, endDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editingEvent.allDay ?? true}
                    onChange={(e) =>
                      setEditingEvent((x) => ({ ...x, allDay: e.target.checked }))
                    }
                  />
                  종일
                </label>
                {!editingEvent.allDay && (
                  <Input
                    type="time"
                    className="w-32"
                    value={editingEvent.time ?? ""}
                    onChange={(e) =>
                      setEditingEvent((x) => ({ ...x, time: e.target.value }))
                    }
                  />
                )}
              </div>

              {/* 체크리스트 */}
              <div className="space-y-2">
                <Label>{editingEvent.scope === "personal" ? "할 일 체크리스트" : "준비물 체크리스트"}</Label>
                {(editingEvent.checklist ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() => {
                        if (editingEvent.id) toggleEventChecklist(editingEvent.id, c.id);
                        setEditingEvent((x) => ({
                          ...x,
                          checklist: (x?.checklist ?? []).map((ci) =>
                            ci.id === c.id ? { ...ci, done: !ci.done } : ci
                          ),
                        }));
                      }}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        c.done ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {c.text}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingEvent((x) => ({
                          ...x,
                          checklist: (x?.checklist ?? []).filter(
                            (ci) => ci.id !== c.id
                          ),
                        }));
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="체크리스트 항목 입력 후 Enter"
                    value={eventChecklistInput}
                    onChange={(e) => setEventChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!eventChecklistInput.trim()) return;
                        if (editingEvent.id) {
                          addEventChecklistItem(editingEvent.id, eventChecklistInput);
                        }
                        setEditingEvent((x) => ({
                          ...x,
                          checklist: [
                            ...(x?.checklist ?? []),
                            {
                              id: Math.random().toString(36).slice(2),
                              text: eventChecklistInput,
                              done: false,
                            },
                          ],
                        }));
                        setEventChecklistInput("");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editingEvent?.id && (
                <Button variant="destructive" onClick={handleDeleteEvent}>
                  삭제
                </Button>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={saveEvent}>저장</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
