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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { useClassStore, useBehaviorStore } from "@/stores";
import { todayKey } from "@/lib/dateUtils";
import type { BehaviorCategory, BehaviorNote } from "@/types";

const CATEGORIES: BehaviorCategory[] = [
  "학습태도",
  "교우관계",
  "리더십",
  "봉사",
  "특기",
  "진로",
  "상담",
  "기타",
];

const CATEGORY_COLOR: Record<BehaviorCategory, string> = {
  학습태도: "bg-blue-50 text-blue-700 border-blue-200",
  교우관계: "bg-pink-50 text-pink-700 border-pink-200",
  리더십: "bg-purple-50 text-purple-700 border-purple-200",
  봉사: "bg-emerald-50 text-emerald-700 border-emerald-200",
  특기: "bg-indigo-50 text-indigo-700 border-indigo-200",
  진로: "bg-amber-50 text-amber-700 border-amber-200",
  상담: "bg-slate-50 text-slate-700 border-slate-200",
  기타: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

export default function BehaviorNotesPage() {
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);

  const notes = useBehaviorStore((s) => s.notes);
  const loadByClass = useBehaviorStore((s) => s.loadByClass);
  const addNote = useBehaviorStore((s) => s.addNote);
  const updateNote = useBehaviorStore((s) => s.updateNote);
  const removeNote = useBehaviorStore((s) => s.removeNote);

  const [classId, setClassId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<BehaviorCategory | "전체">(
    "전체"
  );
  const [keyword, setKeyword] = useState<string>("");

  // 입력 폼
  const [draft, setDraft] = useState({
    date: todayKey(),
    category: "학습태도" as BehaviorCategory,
    positive: true,
    content: "",
    tags: "",
    followUp: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const students = useMemo(
    () => (classId ? getStudentsByClass(classId) : []),
    [classId, getStudentsByClass]
  );

  useEffect(() => {
    if (classId) loadByClass(classId);
  }, [classId, loadByClass]);

  // 학급 변경 시 학생 선택 초기화
  useEffect(() => {
    setStudentId("");
    setEditingId(null);
  }, [classId]);

  // 필터링
  const filtered = useMemo(() => {
    let list = notes;
    if (studentId) list = list.filter((n) => n.studentId === studentId);
    if (categoryFilter !== "전체")
      list = list.filter((n) => n.category === categoryFilter);
    if (keyword.trim()) {
      const k = keyword.toLowerCase();
      list = list.filter(
        (n) =>
          n.content.toLowerCase().includes(k) ||
          n.tags?.some((t) => t.toLowerCase().includes(k))
      );
    }
    return list;
  }, [notes, studentId, categoryFilter, keyword]);

  // 카테고리별 카운트 (선택된 학생 기준)
  const categoryCounts = useMemo(() => {
    const result: Record<BehaviorCategory, number> = {
      학습태도: 0,
      교우관계: 0,
      리더십: 0,
      봉사: 0,
      특기: 0,
      진로: 0,
      상담: 0,
      기타: 0,
    };
    notes
      .filter((n) => !studentId || n.studentId === studentId)
      .forEach((n) => (result[n.category] += 1));
    return result;
  }, [notes, studentId]);

  const resetForm = () => {
    setDraft({
      date: todayKey(),
      category: "학습태도",
      positive: true,
      content: "",
      tags: "",
      followUp: "",
    });
    setEditingId(null);
  };

  const startEdit = (n: BehaviorNote) => {
    setStudentId(n.studentId);
    setEditingId(n.id);
    setDraft({
      date: n.date,
      category: n.category,
      positive: n.positive,
      content: n.content,
      tags: (n.tags ?? []).join(", "),
      followUp: n.followUp ?? "",
    });
  };

  const save = async () => {
    if (!studentId) {
      toast.error("학생을 선택하세요.");
      return;
    }
    if (!draft.content.trim()) {
      toast.error("관찰 내용을 입력하세요.");
      return;
    }
    const tags = draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingId) {
      await updateNote(editingId, {
        date: draft.date,
        category: draft.category,
        positive: draft.positive,
        content: draft.content,
        tags,
        followUp: draft.followUp || undefined,
      });
      toast.success("기록을 수정했습니다.");
    } else {
      await addNote({
        studentId,
        classId,
        date: draft.date,
        category: draft.category,
        positive: draft.positive,
        content: draft.content,
        tags,
        followUp: draft.followUp || undefined,
      });
      toast.success("기록을 추가했습니다.");
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 기록을 삭제할까요?")) return;
    await removeNote(id);
    if (editingId === id) resetForm();
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">행동특성·상담 기록</h1>
        <p className="text-muted-foreground">
          평소 관찰을 모아 두면 학기말 종합의견 작성이 훨씬 수월해집니다.
        </p>
      </div>

      {/* 학급/학생 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">학급·학생 선택</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>학급</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="학급 선택" />
              </SelectTrigger>
              <SelectContent>
                {classes.filter((c) => !c.archived).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.grade}-{c.classNumber}{" "}
                    {c.homeroom ? "(담임)" : `(${c.subject})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>학생</Label>
            <Select
              value={studentId}
              onValueChange={(v) => {
                setStudentId(v);
                setEditingId(null);
              }}
              disabled={!classId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="학생 선택 (전체 보기는 비움)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— 학급 전체 보기 —</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.number}. {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) =>
                setCategoryFilter(v as BehaviorCategory | "전체")
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label>검색</Label>
            <Input
              placeholder="내용·태그 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 카테고리 분포 */}
      {classId && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() =>
                setCategoryFilter((cur) => (cur === c ? "전체" : c))
              }
              className={`border rounded p-2 text-xs hover:shadow-sm ${
                CATEGORY_COLOR[c]
              } ${categoryFilter === c ? "ring-2 ring-offset-1 ring-primary" : ""}`}
            >
              <div className="font-semibold">{c}</div>
              <div className="text-base font-bold">{categoryCounts[c]}</div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 입력 폼 */}
        {classId && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "기록 수정" : "새 관찰 기록"}
              </CardTitle>
              <CardDescription>
                {selectedStudent
                  ? `${selectedStudent.number}. ${selectedStudent.name}`
                  : "왼쪽에서 학생을 먼저 선택하세요."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>날짜</Label>
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>구분</Label>
                  <Select
                    value={draft.positive ? "positive" : "neutral"}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, positive: v === "positive" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">긍정적</SelectItem>
                      <SelectItem value="neutral">관찰/주의</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>카테고리</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, category: v as BehaviorCategory }))
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
                <Label>관찰 내용 *</Label>
                <Textarea
                  rows={4}
                  placeholder="구체적인 사실을 기록하세요. (예: 모둠 활동에서 자료를 정리해 발표를 주도함)"
                  value={draft.content}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, content: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>태그 (쉼표로 구분)</Label>
                <Input
                  placeholder="예) 발표, 협동"
                  value={draft.tags}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tags: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>후속 조치 (선택)</Label>
                <Textarea
                  rows={2}
                  value={draft.followUp}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, followUp: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                {editingId && (
                  <Button variant="outline" onClick={resetForm}>
                    취소
                  </Button>
                )}
                <Button onClick={save}>
                  {editingId ? "수정 저장" : "기록 추가"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 목록 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              관찰 기록 ({filtered.length})
            </CardTitle>
            <CardDescription>
              {studentId ? "선택한 학생" : "학급 전체"} · 최신순
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!classId && (
              <p className="text-sm text-muted-foreground">
                먼저 학급을 선택하세요.
              </p>
            )}
            {classId && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">
                조건에 맞는 기록이 없습니다.
              </p>
            )}
            {filtered.map((n) => {
              const stu = students.find((s) => s.id === n.studentId);
              return (
                <div
                  key={n.id}
                  className="border rounded p-3 space-y-2 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={CATEGORY_COLOR[n.category]} variant="outline">
                      {n.category}
                    </Badge>
                    <Badge variant={n.positive ? "default" : "secondary"}>
                      {n.positive ? "긍정" : "관찰"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {n.date}
                      {stu ? ` · ${stu.number}. ${stu.name}` : ""}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(n)}
                      >
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(n.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  {n.tags && n.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {n.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-2 py-0.5 rounded bg-muted"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {n.followUp && (
                    <>
                      <Separator />
                      <p className="text-xs text-muted-foreground">
                        <strong>후속 조치:</strong> {n.followUp}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
