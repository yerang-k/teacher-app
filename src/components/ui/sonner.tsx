import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset="calc(50vh - 28px)"
      mobileOffset="calc(50vh - 28px)"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-current group-[.toast]:opacity-90",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // 종류별 색: 흰 배경과 구분되는 연한 톤 (기본 스타일보다 우선하도록 !)
          success: "group-[.toaster]:!bg-emerald-100 group-[.toaster]:!text-emerald-900 group-[.toaster]:!border-emerald-300",
          error: "group-[.toaster]:!bg-rose-100 group-[.toaster]:!text-rose-900 group-[.toaster]:!border-rose-300",
          warning: "group-[.toaster]:!bg-amber-100 group-[.toaster]:!text-amber-900 group-[.toaster]:!border-amber-300",
          info: "group-[.toaster]:!bg-sky-100 group-[.toaster]:!text-sky-900 group-[.toaster]:!border-sky-300",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
