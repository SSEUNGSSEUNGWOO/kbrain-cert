import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", key: "dashboard" },
  { href: "/admin/questions", label: "문제은행", key: "questions" },
  { href: "/admin/exams", label: "시험", key: "exams" },
  { href: "/admin/invitations", label: "응시자", key: "invitations" },
  { href: "/admin/grading", label: "채점", key: "grading" },
];

export type AdminNavKey =
  | "dashboard"
  | "questions"
  | "exams"
  | "invitations"
  | "grading";

export function AdminShell({
  active,
  children,
  userEmail,
}: {
  active: AdminNavKey;
  children: ReactNode;
  userEmail?: string;
}) {
  // Auth guard는 app/admin/layout.tsx가 담당 (async server component)
  const email = userEmail ?? "admin";
  const initial = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-border">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
                k
              </div>
              <div className="font-bold text-lg tracking-tight">
                kbrain-cert
              </div>
            </Link>
            <div className="ml-3 text-[10px] font-bold tracking-[0.2em] text-primary bg-primary-soft px-2 py-0.5 rounded-sm">
              ADMIN
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    active === item.key
                      ? "text-primary bg-primary-soft"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-soft"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right leading-tight">
                <div className="text-[10px] font-bold tracking-widest text-muted uppercase">
                  Admin
                </div>
                <div className="text-xs font-bold truncate max-w-40">
                  {email}
                </div>
              </div>
              <div
                className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center text-xs font-bold"
                title={email}
              >
                {initial}
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-danger uppercase px-2 py-1 rounded-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 pb-6 border-b border-border flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase mb-2">
          Admin · 2026.07.14
        </div>
        <h1>{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatBox({
  label,
  value,
  unit,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone?: "primary" | "success" | "danger" | "warning" | "info";
}) {
  const text = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-md bg-white border border-border p-4">
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className={`font-tabular text-2xl font-bold ${text}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {unit && (
          <div className="text-sm font-bold text-muted">{unit}</div>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9 px-4 text-xs" : "h-11 px-5 text-sm";
  return (
    <button
      onClick={onClick}
      className={`${h} rounded-md bg-primary hover:bg-primary-hover text-white font-bold transition`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9 px-4 text-xs" : "h-11 px-5 text-sm";
  return (
    <button
      onClick={onClick}
      className={`${h} rounded-md bg-white border border-border hover:border-primary text-foreground font-bold transition`}
    >
      {children}
    </button>
  );
}
