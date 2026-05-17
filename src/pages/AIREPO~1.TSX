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
import { toast } from "sonner";

import {
  useClassStore,
  useReportStore,
  useSettingsStore,
} from "@/stores";
import { todayKey } from "@/lib/dateUtils";
import { callClaude } from "@/lib/claudeClient";
import {
  buildReportMessages,
  REPORT_TYPE_LABEL,
} from "@/lib/reportPrompts";
import type { ReportType } from "@/types";

const REPORT_TYPES: ReportType[] = [
  "학생개별",
  "행동특성요약",
  "학급전체",
  "수업분석",
  "출결분석",
  "학기말종합",
];

export default function AIReportPage() {
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);

  const reports = useReportStore((s) => s.reports);
  const loadAll = useReportStore((s) => s.loadAll);
  const saveReport = useReportStore((s) => s.saveReport);
  const removeReport = useReportStore((s) => s.removeReport);
  const generating = useReportStore((s) => s.generating);
  const setGenerating = useReportStore((s) => s.setGenerating);

  const apiKey = useSettingsStore((s) => s.settings.aiApiKey);

  const [type, setType] = useState<ReportType>("학생개별");
  const [classId, setClassId] = useState<string>("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(todayKey());
  const [title, setTitle] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [previewModel, setPreviewModel] = useState<string>("");

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const students = useMemo(
    () => (classId ? getStudentsByClass(classId) : []),
    [classId, getStudentsByClass]
  );

  // 보고서 유형에 따라 대상 선택 UI가 달라짐
  const needsStudentPick =
    type === "학생개별" || type === "행동특성요약" || type === "출결분석" || type === "학기말종합";
  const needsClassPick = !needsStudentPick;

  const toggleStudent = (id: string) => {
    setStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const generate = async () => {
    if (!apiKey) {
      toast.error("설정 페이지에서 Claude API 키를 먼저 입력해주세요.");
      return;
    }
    const targetIds = needsClassPick ? (classId ? [classId] : []) : studentIds;
    if (targetIds.length === 0) {
      toast.error("대상을 선택해주세요.");
      return;
    }

    const reqTitle =
      title.trim() ||
      `${REPORT_TYPE_LABEL[type]} (${from} ~ ${to})`;

    setGenerating(true);
    setPreviewText("");
    try {
      const { system, userPrompt } = await buildReportMessages({
        type,
        title: reqTitle,
        targetIds,
        period: { from, to },
        userInstruction: instruction,
      });

      const result = await callClaude({
        apiKey,
        model: "claude-sonnet-4-6",
        system,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 3000,
        temperature: 0.5,
      });

      setPreviewText(result.text);
      setPreviewModel(result.model);

      await saveReport({
        type,
        title: reqTitle,
        targetIds,
        period: { from, to },
        prompt: userPrompt,
        content: result.text,
        modelInfo: result.model,
      });
      toast.success("보고서를 생성하고 저장했습니다.");
    } catch (e) {
      toast.error("생성 실패: " + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("클립보드에 복사했습니다."),
      () => toast.error("복사 실패")
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">AI 보고서</h1>
        <p className="text-muted-foreground">
          학생·학급 데이터를 바탕으로 학기말 종합의견, 행동특성, 수업 분석 등을 자동 생성합니다.
        </p>
      </div>

      {!apiKey && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            ⚠️ Claude API 키가 설정되어 있지 않습니다. 좌측 메뉴의{" "}
            <strong>설정 페이지</strong>에서 API 키를 먼저 입력하세요. 키는 사용자
            컴퓨터(IndexedDB)에만 저장됩니다.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 보고서 만들기</CardTitle>
          <CardDescription>
            유형과 대상, 기간을 선택하고 생성을 누르세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>보고서 유형</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {REPORT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>학급</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="학급 선택" />
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
              <Label>제목 (선택)</Label>
              <Input
                placeholder="자동 생성됩니다"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>시작일</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>종료일</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {/* 학생 다중 선택 */}
          {needsStudentPick && classId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>학생 선택 ({studentIds.length}명)</Label>
                <div className="space-x-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStudentIds(students.map((s) => s.id))}
                  >
                    전체 선택
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setStudentIds([])}
                  >
                    선택 해제
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto p-2 border rounded">
                {students.map((s) => {
                  const on = studentIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`px-2 py-1 text-sm rounded border ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      {s.number}. {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>추가 지침 (선택)</Label>
            <Textarea
              placeholder="예) 학부모 안내용으로 부드러운 어조로 작성. 진로 영역을 강조."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={generate}
              disabled={generating || !apiKey}
              size="lg"
            >
              {generating ? "Claude로 생성 중..." : "보고서 생성"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 미리보기 */}
      {previewText && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">생성된 보고서</CardTitle>
                <CardDescription>
                  모델: {previewModel} · 자동으로 보관함에 저장되었습니다.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(previewText)}
              >
                복사
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {previewText}
            </pre>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* 보관함 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">보관함 ({reports.length})</CardTitle>
          <CardDescription>이전에 생성한 보고서 목록</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">
              아직 생성된 보고서가 없습니다.
            </p>
          )}
          {reports.map((r) => (
            <div
              key={r.id}
              className="border rounded p-3 space-y-2 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("ko-KR")} ·{" "}
                    {r.period.from} ~ {r.period.to}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{REPORT_TYPE_LABEL[r.type]}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(r.content)}
                  >
                    복사
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("삭제하시겠습니까?")) removeReport(r.id);
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              <details>
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  본문 펼치기
                </summary>
                <pre className="whitespace-pre-wrap text-sm mt-2 leading-relaxed">
                  {r.content}
                </pre>
              </details>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
