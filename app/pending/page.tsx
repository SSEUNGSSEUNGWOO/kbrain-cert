import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { requireAuth } from "@/lib/auth";

export default async function PendingPage() {
  const user = await requireAuth();

  return (
    <main className="min-h-screen bg-surface-soft flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-md bg-white border border-border p-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center font-bold">
            k
          </span>
          <span className="font-bold text-lg">kbrain-cert</span>
        </Link>
        <h1 className="text-xl font-bold mb-2">접근 권한 확인이 필요합니다</h1>
        <p className="text-sm text-muted-foreground mb-2">
          현재 계정에 사용할 수 있는 역할이 배정되지 않았습니다.
        </p>
        <p className="text-xs text-muted-foreground font-tabular mb-6">
          {user.email}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full h-10 rounded-md border border-border bg-white text-sm font-bold hover:border-primary transition"
          >
            다른 계정으로 로그인
          </button>
        </form>
      </section>
    </main>
  );
}
