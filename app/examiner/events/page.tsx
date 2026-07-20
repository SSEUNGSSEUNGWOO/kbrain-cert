import { requireRole } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/server";
import { EventReview } from "./event-review";

export const dynamic = "force-dynamic";

export default async function EventReviewPage() {
  await requireRole(["admin", "examiner"]);
  const admin = createAdminSupabase();
  const { data: exams } = await admin
    .from("exams")
    .select("id, title, exam_date")
    .order("exam_date", { ascending: false, nullsFirst: false });
  return <EventReview exams={exams ?? []} />;
}
