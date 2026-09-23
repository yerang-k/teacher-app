import { Link, useLocation } from "wouter";
import pkg from "../../package.json";
import { useTaskStore } from "@/stores";
import { getSyncUrl, getLastSyncedAt, hasPendingChanges } from "@/lib/cloudSync";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

const MENU = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/lessons", label: "수업·진도", icon: "📚" },
  { href: "/timetable", label: "시간표", icon: "🗓️" },
  { href: "/assessment", label: "수행평가", icon: "📊" },
  { href: "/attendance", label: "출결", icon: "✓" },
  { href: "/behavior", label: "행동특성", icon: "📝" },
  { href: "/tasks", label: "업무·행사·일정", icon: "📋" },
  { href: "/school-sheet", label: "학교 일정", icon: "🏫" },
  { href: "/memos", label: "회의록·메모", icon: "📓" },
  { href: "/ai-report", label: "AI 보고서", icon: "🤖" },
  { href: "/backup", label: "백업/복원", icon: "💾" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const overdueCount = useTaskStore((s) => s.overdue().length);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };
  // 동기화 상태 문구: 주소 미설정 → 이 기기에만 저장 / 변경 대기 → 대기 중 / 그 외 → 마지막 동기화 시각
  // (localStorage 값이라 화면이 스스로 갱신되지 않으므로 3초마다 다시 읽는다)
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);
  let storageLabel = "기기에 저장";
  if (getSyncUrl()) {
    const last = getLastSyncedAt();
    const d = last ? new Date(last) : null;
    const when = d && !isNaN(d.getTime())
      ? ` ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : "";
    storageLabel = hasPendingChanges() ? "동기화 대기 중" : `동기화됨${when}`;
  }

  return (
    <div className="min-h-screen">
      {/* 사이드바 */}
      {/* position:fixed + inset-y-0(top:0·bottom:0)로 화면 위·아래 양끝에 붙박아,
          100vh 계산에 의존하지 않고 어떤 환경(줌·조상 요소·모바일 UI)에서도
          정확히 보이는 화면 높이에 딱 맞춘다. 제목은 위, 저작권은 아래에 고정하고
          메뉴만 스크롤시켜 저작권이 항상 바닥에 붙어 잘리지 않게 한다.
          본문은 ml-56으로 사이드바 폭만큼 밀어 겹치지 않게 한다. */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 border-r bg-muted/30 flex flex-col transition-[width] duration-150 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <div className="flex items-center border-b shrink-0">
          <Link href="/">
            <a className="flex-1 min-w-0 block p-4 pb-3 hover:bg-accent transition-colors">
              {collapsed ? (
                <div className="font-bold text-lg text-center">🏫</div>
              ) : (
                <>
                  <div className="font-bold text-lg truncate">교사 도우미</div>
                  <div className="text-xs text-muted-foreground truncate">
                    수업·업무 관리 앱
                  </div>
                </>
              )}
            </a>
          </Link>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          className="shrink-0 flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground border-b hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          {!collapsed && "접기"}
        </button>
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
          {MENU.map((m) => {
            const isActive =
              m.href === "/" ? location === "/" : location.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href}>
                <a
                  title={collapsed ? m.label : undefined}
                  className={`flex items-center gap-2 rounded text-sm transition-colors ${
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
                  } ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  <span className="relative shrink-0">
                    {m.icon}
                    {collapsed && m.href === "/tasks" && overdueCount > 0 && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{m.label}</span>}
                  {!collapsed && m.href === "/tasks" && overdueCount > 0 && (
                    <span className="ml-auto text-xs bg-rose-500 text-white px-1.5 rounded">
                      {overdueCount}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="shrink-0 border-t p-4 text-xs text-muted-foreground space-y-1">
            <div className="whitespace-nowrap">v{pkg.version} · {storageLabel}</div>
            <div>교사 도우미 &copy; 2026 KIMYERANG.</div>
            <div className="break-keep">
              본 앱은 자유롭게 사용할 수 있으나, 저작자의 허락 없는
              <br />
              복제·배포·수정은 금지합니다.
            </div>
          </div>
        )}
      </aside>

      {/* 메인 콘텐츠 (사이드바 폭만큼 밀고, 페이지 자체가 스크롤) */}
      <main className={`min-h-screen transition-[margin] duration-150 ${collapsed ? "ml-14" : "ml-56"}`}>
        {children}
      </main>
    </div>
  );
}
