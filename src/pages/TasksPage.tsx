import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useTaskStore } from "@/stores";
import { todayKey } from "@/lib/dateUtils";
import type {
  SchoolTask,
  TaskCategory,
  TaskPriority,
  TaskStatus,
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
  const overdue = useTaskStore((s) => s.overdue());
  const upcoming = useTaskStore((s) => s.upcoming(7));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SchoolTask> | null>(null);
  const [checklistInput, setChecklistInput] = useState("");

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const view = filtered();
  const byStatus: Record<TaskStatus, SchoolTask[]> = {
    대기: [],
    진행중: [],
    보류: [],
    완료: [],
  };
  view.forEach((t) => byStatus[t.status].push(t));

  // 다음 상태로 이동
  const nextStatus = (s: TaskStatus): TaskStatus | null => {
    if (s === "대기") return "진행중";
    if (s === "진행중") return "완료";
    return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">업무 관리</h1>
          <p className="text-muted-foreground">
            정보부장·AI디지털 선도학교·담임 업무를 한 곳에서 관리합니다.
          </p>
        </div>
        <Button onClick={openNew}>+ 새 업무</Button>
      </div>

      {/* 알림 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={overdue.length > 0 ? "border-rose-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-rose-600">⚠️</span>
              지연된 업무 ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {overdue.length === 0 ? (
              <p className="text-xs text-muted-foreground">지연 업무 없음</p>
            ) : (
              overdue.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="block w-full text-left text-xs hover:underline"
                >
                  {t.dueDate} — {t.title}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={upcoming.length > 0 ? "border-amber-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-amber-600">📅</span>
              이번 주 마감 ({upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">임박 업무 없음</p>
            ) : (
              upcoming.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="block w-full text-left text-xs hover:underline"
                >
                  {t.dueDate} — {t.title}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>분류</Label>
            <Select
              value={filters.category ?? ""}
              onValueChange={(v) =>
                setFilters({
                  category: (v || undefined) as TaskCategory | undefined,
                })
              }
            >
              <SelectTrigger className="w-[160px]">
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
                  priority: (v || undefined) as TaskPriority | undefined,
                })
              }
            >
              <SelectTrigger className="w-[140px]">
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
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label>검색</Label>
            <Input
              placeholder="제목·내용 검색"
              value={filters.keyword ?? ""}
              onChange={(e) => setFilters({ keyword: e.target.value })}
            />
          </div>
          <Button variant="ghost" onClick={clearFilters}>
            필터 초기화
          </Button>
        </CardContent>
      </Card>

      {/* 칸반 보드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <Card key={s} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{s}</span>
                <Badge variant="outline">{byStatus[s].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 min-h-[200px]">
              {byStatus[s].map((t) => {
                const isOverdue =
                  t.dueDate && t.dueDate < todayKey() && t.status !== "완료";
                return (
                  <div
                    key={t.id}
                    className={`bg-background border rounded p-2 space-y-1.5 ${
                      isOverdue ? "border-rose-300" : ""
                    }`}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => openEdit(t)}
                    >
                      <div className="font-medium text-sm line-clamp-2">
                        {t.title}
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        className={CATEGORY_COLOR[t.category]}
                        variant="outline"
                      >
                        {t.category}
                      </Badge>
                      <Badge className={PRIORITY_COLOR[t.priority]} variant="outline">
                        {t.priority}
                      </Badge>
                      {t.dueDate && (
                        <span
                          className={`text-xs ${
                            isOverdue
                              ? "text-rose-600 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t.dueDate}
                        </span>
                      )}
                    </div>
                    {t.checklist && t.checklist.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ☑ {t.checklist.filter((c) => c.done).length}/
                        {t.checklist.length}
                      </div>
                    )}
                    {nextStatus(t.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7"
                        onClick={() => setStatus(t.id, nextStatus(t.status)!)}
                      >
                        → {nextStatus(t.status)}로 이동
                      </Button>
                    )}
                  </div>
                );
              })}
              {byStatus[s].length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  업무 없음
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 추가/편집 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "업무 수정" : "새 업무"}
            </DialogTitle>
            <DialogDescription>
              제목과 분류, 마감일, 체크리스트를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
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
                <Label>설명</Label>
                <Textarea
                  rows={3}
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
                    placeholder="체크리스트 항목"
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
    </div>
  );
}
