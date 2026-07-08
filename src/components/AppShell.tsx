import { useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, FileText, Settings, Sparkles, Play } from "lucide-react";
import { Toaster } from "sonner";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/scripts", label: "Roteiros", icon: FileText },
  { to: "/prompter", label: "Prompter", icon: Play },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }, []);
  const isPrompter = loc.pathname.startsWith("/prompter");
  if (isPrompter)
    return (
      <>
        {children}
        <Toaster theme="dark" position="top-center" />
      </>
    );

  return (
    <div className="min-h-screen gradient-hero">
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              Prompter<span className="text-gradient">.io</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/scripts/new"
            className="hidden md:inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-spring hover:scale-105"
          >
            Novo roteiro
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6">{children}</main>

      {/* mobile bottom nav */}
      <nav className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl glass px-2 py-2 shadow-elevated md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[10px] font-medium transition-smooth ${
                active ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
      <Toaster theme="dark" position="top-center" />
    </div>
  );
}
