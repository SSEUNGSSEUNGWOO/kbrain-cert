import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { TestExam } from "./test-exam";

export const dynamic = "force-dynamic";

/** 기존 practice 링크 호환 · 테스트 시험으로 지정된 경우에만 공개 */
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ skip?: string }>;
}) {
  const { slug } = await params;
  const { skip } = await searchParams;
  const supabase = createAdminSupabase();
  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .eq("practice_slug", slug)
    .eq("is_test_mode", true)
    .maybeSingle();
  if (!exam) notFound();

  return (
    <TestExam
      examId={exam.id}
      slug={slug}
      skipToExam={skip === "1" || skip === "true"}
    />
  );
}
