import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SessionDetail } from "./session-detail";

export const dynamic = "force-dynamic";

export default async function ExaminerSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "examiner"]);
  const { id } = await params;

  return (
    <div className="min-h-screen bg-surface-soft">
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/examiner/monitor" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
              k
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
                Kbrain Cert · Examiner
              </div>
              <div className="font-bold text-sm">응시자 상세</div>
            </div>
          </Link>
          <Link
            href="/examiner/monitor"
            className="h-9 px-4 rounded-md bg-white border border-border hover:border-primary text-xs font-bold transition inline-flex items-center"
          >
            ← 그리드로
          </Link>
        </div>
      </nav>
      <SessionDetail sessionId={id} />
    </div>
  );
}
