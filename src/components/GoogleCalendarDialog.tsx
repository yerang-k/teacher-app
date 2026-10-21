import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useGoogleCalendarStore, useSettingsStore } from "@/stores";

/** 달력에 읽어와 보여줄 구글 캘린더를 고르는 창 (읽기 전용) */
export default function GoogleCalendarDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const calendars = useGoogleCalendarStore((s) => s.calendars);
  const loading = useGoogleCalendarStore((s) => s.loading);
  const error = useGoogleCalendarStore((s) => s.error);
  const loadCalendars = useGoogleCalendarStore((s) => s.loadCalendars);

  const selected = settings.googleCalendarIds ?? [];

  useEffect(() => {
    if (open) loadCalendars();
  }, [open, loadCalendars]);

  const toggle = async (id: string, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((x) => x !== id);
    await updateSettings({ googleCalendarIds: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구글 캘린더 연결</DialogTitle>
          <DialogDescription>
            선택한 구글 캘린더의 일정을 달력에 함께 보여줍니다. 읽기 전용이라 여기서 수정하거나
            삭제할 수는 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {loading && calendars.length === 0 && (
            <p className="text-sm text-muted-foreground">캘린더 목록을 불러오는 중…</p>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p>{error}</p>
              <p className="mt-1 text-xs text-rose-700/80">
                동기화용 Apps Script에 캘린더 읽기 코드를 붙여 넣고 새 버전으로 다시 배포해야 합니다.
              </p>
            </div>
          )}
          {calendars.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) => toggle(c.id, e.target.checked)}
              />
              <span
                className="h-3 w-3 shrink-0 rounded-full border"
                style={{ backgroundColor: c.color || undefined }}
              />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
          {!loading && !error && calendars.length === 0 && (
            <p className="text-sm text-muted-foreground">불러온 캘린더가 없습니다.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => loadCalendars()} disabled={loading}>
            목록 새로 불러오기
          </Button>
          <Button onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
