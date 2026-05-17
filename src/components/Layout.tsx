import { Link, useLocation } from "wouter";
import { useTaskStore } from "@/stores";

const MENU = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/lessons", label: "수업·진도", icon: "📚" },
  { href: "/attendance", label: "출결", icon: "✓" },
  { href: "/behavior", label: "행동특성", icon: "📝" },
  { href: "/tasks", label: "업무", icon: "📋" },
  { href: "/ai-report", label: "AI 보고서", icon: "🤖" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const overdueCount = useTaskStore((s) => s.overdue().length);

  return (
    <div className="flex min-h-screen">
      {/* 사이드바 */}
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-1">
        <div className="px-2 pb-4 mb-2 border-b">
          <div className="font-bold text-lg">교사 도우미</div>
          <div className="text-xs text-muted-foreground">
            수업·업무 관리 앱
          </div>
        </div>
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
        <div className="mt-auto pt-4 text-xs text-muted-foreground px-2">
          v1.0 · 로컬 저장
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
