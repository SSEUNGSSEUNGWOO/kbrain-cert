"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "./actions";

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-md bg-primary text-white flex items-center justify-center font-bold">
            k
          </div>
          <div className="font-bold text-xl tracking-tight">kbrain-cert</div>
        </Link>

        <div className="rounded-md bg-white border border-border p-8">
          <div className="mb-6">
            <div className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2">
              Sign In
            </div>
            <h1 className="text-2xl">관리자 · 감독관 · 채점자 로그인</h1>
            <p className="text-sm text-muted-foreground mt-2">
              응시자는 안내받은 시험 링크로 진입해주세요.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-muted uppercase mb-1.5 block">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-md border border-border bg-white text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="admin@daeasy.co.kr"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-muted uppercase mb-1.5 block">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full h-11 px-4 rounded-md border border-border bg-white text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger-soft border border-danger rounded-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full h-11 rounded-md bg-primary hover:bg-primary-hover text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "로그인 중…" : "로그인 →"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-xs text-muted-foreground">
            <div className="mb-1">
              <b className="text-foreground">계정이 없으신가요?</b>
            </div>
            <div>
              관리자에게 계정 생성을 요청하세요. 초기 admin은{" "}
              <code className="text-[10px] bg-surface-soft px-1.5 py-0.5 rounded-sm font-tabular">
                docs/M2_ADMIN_BOOTSTRAP.md
              </code>{" "}
              참고.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
