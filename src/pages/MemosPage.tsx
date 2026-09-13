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
import { uid, db, runWithoutChangeEvents } from "@/db";
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

const fmtDateShort = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<MemoCategory>("회의록");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<MemoAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

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

  // 회의록·메모만 따로 파일로 백업 (첨부 PDF/이미지까지 포함, 자체 완결 JSON).
  const exportMemos = () => {
    if (memos.length === 0) {
      toast.error("백업할 회의록·메모가 없습니다.");
      return;
    }
    const backup = {
      type: "teacher-app-memos",
      version: 1,
      exportedAt: new Date().toISOString(),
      memos,
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `회의록메모-백업-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`회의록·메모 ${memos.length}건을 백업 파일로 저장했습니다.`);
  };

  // 백업 파일에서 회의록·메모 불러오기 (기존 것은 두고 병합, id 같으면 갱신).
  const importMemos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (backupFileRef.current) backupFileRef.current.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list: unknown = Array.isArray(parsed) ? parsed : parsed?.memos;
      if (!Array.isArray(list)) throw new Error("형식 오류");
      const valid = (list as Memo[]).filter(
        (m) => m && typeof m.id === "string" && typeof m.title === "string"
      );
      if (valid.length === 0) throw new Error("회의록이 없음");
      // 메모는 클라우드 동기화 대상이 아니므로 변경 알림 없이 바로 저장
      await runWithoutChangeEvents(() => db.memos.bulkPut(valid));
      await loadAll();
      toast.success(`회의록·메모 ${valid.length}건을 불러왔습니다.`);
    } catch {
      toast.error("올바른 회의록·메모 백업 파일이 아닙니다.");
    }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportMemos}>
            ⬆ 백업
          </Button>
          <Button variant="outline" size="sm" onClick={() => backupFileRef.current?.click()}>
            ⬇ 불러오기
          </Button>
          <input
            ref={backupFileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importMemos}
          />
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
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {memos.map((m) => {
            const first = m.attachments[0];
            const extra = m.attachments.length - 1;
            const firstIsImage = !!first && first.mime.startsWith("image/");
            const firstIsPdf =
              !!first &&
              (first.mime === "application/pdf" || first.name.toLowerCase().endsWith(".pdf"));
            return (
              <div key={m.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                {/* 썸네일: 첫 첨부(이미지/PDF), 없으면 본문 미리보기 */}
                <button
                  type="button"
                  onClick={() => (first ? openAttachment(first) : openEdit(m))}
                  title={first ? first.name : m.title}
                  className="relative flex h-40 w-full items-center justify-center overflow-hidden bg-slate-50 hover:opacity-95"
                >
                  {firstIsImage ? (
                    <img src={first.dataUrl} alt={first.name} className="h-full w-full object-cover" />
                  ) : firstIsPdf ? (
                    <PdfThumbnail dataUrl={first.dataUrl} />
                  ) : m.body ? (
                    <p className="p-2 text-left text-[11px] leading-snug whitespace-pre-wrap break-keep text-muted-foreground">
                      {m.body}
                    </p>
                  ) : (
                    <span className="text-3xl">📝</span>
                  )}
                  {extra > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      +{extra}
                    </span>
                  )}
                </button>

                {/* 정보 + 수정/삭제 */}
                <div className="flex flex-1 flex-col gap-1 p-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={m.category === "회의록" ? "default" : "outline"} className="text-[10px]">
                      {m.category}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{fmtDateShort(m.date)}</span>
                  </div>
                  <h2
                    className="text-sm font-semibold leading-tight break-keep"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {m.title}
                  </h2>
                  <div className="mt-auto flex gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 text-xs"
                      onClick={() => openEdit(m)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 text-xs text-rose-600 hover:text-rose-700"
                      onClick={() => del(m)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}

let pdfWorkerReady = false;

/** PDF 첫 페이지를 이미지로 렌더해 썸네일로 보여준다. pdfjs는 필요할 때만 동적 로드. */
function PdfThumbnail({ dataUrl }: { dataUrl: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!pdfWorkerReady) {
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          pdfWorkerReady = true;
        }
        const b64 = dataUrl.split(",")[1] ?? "";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2, 300 / base.width) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) setThumb(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (failed) return <span className="text-4xl">📄</span>;
  if (!thumb) return <span className="text-xs text-muted-foreground">미리보기 생성 중…</span>;
  return <img src={thumb} alt="PDF 미리보기" className="h-full w-full object-cover object-top" />;
}
