import { Link, useLocation } from "wouter";
import { useTaskStore } from "@/stores";
import { getSyncUrl } from "@/lib/cloudSync";

const MENU = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/lessons", label: "수업·진도", icon: "📚" },
  { href: "/timetable", label: "시간표", icon: "🗓️" },
  { href: "/assessment", label: "수행평가", icon: "📊" },
  { href: "/attendance", label: "출결", icon: "✓" },
  { href: "/behavior", label: "행동특성", icon: "📝" },
  { href: "/tasks", label: "업무", icon: "📋" },
  { href: "/ai-report", label: "AI 보고서", icon: "🤖" },
  { href: "/backup", label: "백업/복원", icon: "💾" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const overdueCount = useTaskStore((s) => s.overdue().length);
  // 구글 드라이브 동기화 주소가 설정돼 있으면 드라이브에, 없으면 이 기기에만 저장됨
  const storageLabel = getSyncUrl() ? "구글 드라이브 동기화" : "이 기기에 저장";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 사이드바 */}
      {/* 껍데기를 화면 높이로 고정(h-screen overflow-hidden)하고 오른쪽 본문만
          스크롤시킨다. 사이드바 안에서도 제목은 위, 저작권은 맨 아래에 고정하고
          메뉴만 flex-1 overflow-y-auto로 스크롤시켜, 화면이 짧아도 저작권이
          항상 바닥에 붙어 잘리지 않게 한다. */}
      <aside className="w-56 border-r bg-muted/30 flex flex-col h-full">
        <div className="p-4 pb-3 border-b shrink-0">
          <div className="font-bold text-lg">교사 도우미</div>
          <div className="text-xs text-muted-foreground">
            수업·업무 관리 앱
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 min-h-0">
          {MENU.map((m) => {
            const isActive =
              m.href === "/" ? location === "/" : location.startsWith(m.href);
            return (
              <Link key={m.href} href={m.href}>
                <a
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                  {m.href === "/tasks" && overdueCount > 0 && (
                    <span className="ml-auto text-xs bg-rose-500 text-white px-1.5 rounded">
                      {overdueCount}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t p-4 text-xs text-muted-foreground space-y-1">
          <div>v2.0 · {storageLabel}</div>
          <div>교사 도우미 &copy; 2026 KIMYERANG.</div>
          <div className="break-keep">
            본 앱은 자유롭게 사용할 수 있으나, 저작자의 허락 없는
            <br />
            복제·배포·수정은 금지합니다.
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 (여기만 스크롤) */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
