import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useMemoStore } from "@/stores";
import { uid } from "@/db";
import { todayKey } from "@/lib/dateUtils";
import type { Memo, MemoCategory, MemoAttachment } from "@/types";

const CATEGORIES: MemoCategory[] = ["회의록", "메모"];
// 첨부 1개 최대 크기(너무 크면 저장·동기화가 무거워짐). 삼성노트 PDF/이미지 한두 장 수준.
const MAX_ATTACH_BYTES = 8 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** data URL을 blob URL로 바꿔 새 탭에서 연다 (큰 PDF의 data: 직접 열기 차단 회피). */
function openAttachment(att: MemoAttachment) {
  try {
    const [head, b64] = att.dataUrl.split(",");
    const mime = head.match(/data:(.*?);/)?.[1] || att.mime || "application/octet-stream";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    window.open(att.dataUrl, "_blank");
  }
}

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

export default function MemosPage() {
  const memos = useMemoStore((s) => s.memos);
  const loadAll = useMemoStore((s) => s.loadAll);
  const add = useMemoStore((s) => s.add);
  const update = useMemoStore((s) => s.update);
  const remove = useMemoStore((s) => s.remove);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const [open, setOpen] = useState(false);
  const [penOpen, setPenOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<MemoCategory>("회의록");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<MemoAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = (preset?: Partial<{ category: MemoCategory; title: string; attachments: MemoAttachment[] }>) => {
    setEditingId(null);
    setCategory(preset?.category ?? "회의록");
    setTitle(preset?.title ?? "");
    setDate(todayKey());
    setBody("");
    setAttachments(preset?.attachments ?? []);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  // S펜 필기 → PNG를 첨부로 변환하고 작성창을 연다.
  const attachHandwriting = (dataUrl: string) => {
    const att: MemoAttachment = {
      id: uid(),
      name: `손글씨-${todayKey()}.png`,
      mime: "image/png",
      dataUrl,
      addedAt: Date.now(),
    };
    setPenOpen(false);
    resetForm({ category: "메모", title: "손글씨 메모", attachments: [att] });
    setOpen(true);
  };

  const openEdit = (m: Memo) => {
    setEditingId(m.id);
    setCategory(m.category);
    setTitle(m.title);
    setDate(m.date);
    setBody(m.body);
    setAttachments(m.attachments);
    setOpen(true);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: MemoAttachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ATTACH_BYTES) {
        toast.error(`${f.name}은(는) 너무 큽니다 (최대 8MB). 삼성노트에서 페이지를 나눠 내보내 주세요.`);
        continue;
      }
      next.push({
        id: uid(),
        name: f.name || "첨부",
        mime: f.type || "application/octet-stream",
        dataUrl: await fileToDataUrl(f),
        addedAt: Date.now(),
      });
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const save = async () => {
    if (!title.trim() && attachments.length === 0 && !body.trim()) {
      toast.error("제목이나 내용, 또는 첨부 중 하나는 있어야 합니다.");
      return;
    }
    const finalTitle = title.trim() || (category === "회의록" ? "제목 없는 회의록" : "제목 없는 메모");
    if (editingId) {
      await update(editingId, { category, title: finalTitle, date, body, attachments });
      toast.success("수정했습니다.");
    } else {
      await add({ category, title: finalTitle, date, body, attachments });
      toast.success("저장했습니다.");
    }
    setOpen(false);
  };

  const del = async (m: Memo) => {
    if (!window.confirm(`"${m.title}"을(를) 삭제할까요? 첨부한 필기도 함께 삭제됩니다.`)) return;
    await remove(m.id);
    toast.success("삭제했습니다.");
  };

  // 삼성노트 등에서 '공유'로 넘어온 파일 받기 (설치형 앱 + 안드로이드).
  // 서비스워커가 shared-inbox 캐시에 넣어두면 여기서 꺼내 새 메모 작성창을 연다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("shared") || !("caches" in window)) return;
    (async () => {
      try {
        const cache = await caches.open("shared-inbox");
        const keys = await cache.keys();
        const atts: MemoAttachment[] = [];
        for (const req of keys) {
          const res = await cache.match(req);
          if (!res) continue;
          const blob = await res.blob();
          const name = decodeURIComponent(res.headers.get("x-filename") || "삼성노트 필기");
          const dataUrl = await fileToDataUrl(new File([blob], name, { type: blob.type }));
          atts.push({ id: uid(), name, mime: blob.type, dataUrl, addedAt: Date.now() });
          await cache.delete(req);
        }
        window.history.replaceState({}, "", "/memos");
        if (atts.length) {
          resetForm({ title: "삼성노트 필기", attachments: atts });
          setOpen(true);
          toast.success("삼성노트에서 받은 필기를 첨부했습니다. 제목·분류를 정하고 저장하세요.");
        }
      } catch {
        /* 공유 수신 실패는 조용히 무시 (수동 첨부로 대체 가능) */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">회의록 · 메모</h1>
          <p className="text-sm text-muted-foreground">
            회의 기록과 메모를 남기고, 삼성노트 등에서 필기한 PDF·이미지를 첨부하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPenOpen(true)}>
            ✏️ 손글씨
          </Button>
          <Button onClick={openNew}>+ 새로 작성</Button>
        </div>
      </div>

      {memos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 작성한 회의록·메모가 없습니다. <b>+ 새로 작성</b>으로 시작하세요.
            <div className="mt-2 text-xs">
              삼성태블릿이라면, 앱을 홈 화면에 설치한 뒤 삼성노트에서 <b>공유 → 교사 도우미</b>로
              필기를 바로 첨부할 수 있어요.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memos.map((m) => (
            <Card key={m.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={m.category === "회의록" ? "default" : "outline"} className="text-[10px]">
                        {m.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmtDate(m.date)}</span>
                    </div>
                    <h2 className="font-semibold mt-1 break-keep">{m.title}</h2>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(m)}>
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-rose-600 hover:text-rose-700"
                      onClick={() => del(m)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
                {m.body && (
                  <p className="text-sm whitespace-pre-wrap break-keep text-foreground/90">{m.body}</p>
                )}
                {m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.attachments.map((a) =>
                      a.mime.startsWith("image/") ? (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openAttachment(a)}
                          className="border rounded overflow-hidden hover:opacity-90"
                          title={a.name}
                        >
                          <img src={a.dataUrl} alt={a.name} className="h-24 w-auto object-cover" />
                        </button>
                      ) : (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openAttachment(a)}
                          className="flex items-center gap-1.5 border rounded px-2.5 py-1.5 text-xs hover:bg-accent"
                          title={a.name}
                        >
                          📄 <span className="max-w-[160px] truncate">{a.name}</span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "회의록·메모 수정" : "새 회의록·메모"}</DialogTitle>
            <DialogDescription className="text-xs">
              필기는 삼성노트 등에서 PDF·이미지로 내보내 첨부하세요. 모든 내용은 이 기기(및 동기화 설정 시 구글 드라이브)에만 저장됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="space-y-1.5 w-32">
                <Label className="text-xs">분류</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as MemoCategory)}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">날짜</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">제목</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={category === "회의록" ? "예: 3학년 학년회의" : "예: 학부모 상담 메모"}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">내용 (선택)</Label>
              <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="타이핑으로 남길 내용" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">첨부 (삼성노트 PDF·이미지 등)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  파일 첨부
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-1 border rounded pl-2 pr-1 py-1 text-xs">
                      <span className="max-w-[160px] truncate">
                        {a.mime.startsWith("image/") ? "🖼️" : "📄"} {a.name}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-rose-600 px-1"
                        onClick={() => removeAttachment(a.id)}
                        aria-label="첨부 제거"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={save}>{editingId ? "수정 저장" : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HandwritingDialog open={penOpen} onOpenChange={setPenOpen} onSave={attachHandwriting} />
    </div>
  );
}

const PEN_COLORS = ["#1e3050", "#2563eb", "#dc2626", "#111827"];

/** S펜/마우스로 바로 필기하는 캔버스. 저장 시 PNG data URL을 넘긴다. */
function HandwritingDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const penSeen = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const [empty, setEmpty] = useState(true);

  const ctxOf = () => canvasRef.current?.getContext("2d") ?? null;

  // 다이얼로그가 열리면 캔버스를 표시 크기에 맞춰 초기화(흰 배경)
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const cv = canvasRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      undoStack.current = [];
      setEmpty(true);
      setErasing(false);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const posOf = (e: React.PointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const pushUndo = () => {
    const cv = canvasRef.current;
    const ctx = ctxOf();
    if (!cv || !ctx) return;
    try {
      undoStack.current.push(ctx.getImageData(0, 0, cv.width, cv.height));
      if (undoStack.current.length > 15) undoStack.current.shift();
    } catch {
      /* ignore */
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") penSeen.current = true;
    if (e.pointerType === "touch" && penSeen.current) return; // 펜 사용 중이면 손바닥(터치) 무시
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pushUndo();
    drawing.current = true;
    last.current = posOf(e);
    // 점 찍기(짧은 탭)
    strokeTo(posOf(e), e.pressure || 0.5, true);
    setEmpty(false);
  };

  const strokeTo = (p: { x: number; y: number }, pressure: number, dot = false) => {
    const ctx = ctxOf();
    if (!ctx) return;
    const base = erasing ? 16 : 2.2;
    const w = erasing ? base : base * (0.5 + (pressure || 0.5) * 1.8);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = w;
    ctx.beginPath();
    const from = last.current ?? p;
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(dot ? p.x + 0.01 : p.x, dot ? p.y + 0.01 : p.y);
    ctx.stroke();
    last.current = p;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    if (e.pointerType === "touch" && penSeen.current) return;
    e.preventDefault();
    strokeTo(posOf(e), e.pressure);
  };

  const endStroke = () => {
    drawing.current = false;
    last.current = null;
  };

  const undo = () => {
    const ctx = ctxOf();
    const snap = undoStack.current.pop();
    if (ctx && snap) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(snap, 0, 0);
      ctx.restore();
    }
    setEmpty(undoStack.current.length === 0);
  };

  const clearAll = () => {
    const cv = canvasRef.current;
    const ctx = ctxOf();
    if (!cv || !ctx) return;
    pushUndo();
    const rect = cv.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setEmpty(true);
  };

  const save = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    onSave(cv.toDataURL("image/png"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>손글씨 필기</DialogTitle>
          <DialogDescription className="text-xs">
            S펜(또는 마우스)으로 바로 필기하세요. 저장하면 이미지로 메모에 첨부됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={`h-7 w-7 rounded-full border-2 ${
                !erasing && color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`색상 ${c}`}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant={erasing ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setErasing((v) => !v)}
          >
            지우개
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={undo}>
            되돌리기
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={clearAll}>
            전체 지우기
          </Button>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full rounded border bg-white touch-none"
          style={{ height: "58vh", cursor: "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={save} disabled={empty}>
            메모에 첨부
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
