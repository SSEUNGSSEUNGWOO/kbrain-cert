import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

async function requireExaminer() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .maybeSingle();
  return role ? user : null;
}

export async function GET(request: Request) {
  if (!(await requireExaminer())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");
  const eventType = searchParams.get("eventType");
  const reviewed = searchParams.get("reviewed");
  if (!examId) {
    return NextResponse.json({ error: "examId required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: sessions, error: sessionError } = await admin
    .from("exam_sessions")
    .select("id, invitation_id")
    .eq("exam_id", examId);
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (!sessionIds.length) return NextResponse.json({ events: [] });

  let query = admin
    .from("monitoring_events")
    .select(
      "id, session_id, event_type, severity, detected_at, question_index, is_reviewed, reviewer_note"
    )
    .in("session_id", sessionIds)
    .order("detected_at", { ascending: false })
    .limit(500);
  if (eventType && eventType !== "all") query = query.eq("event_type", eventType);
  if (reviewed === "true") query = query.eq("is_reviewed", true);
  if (reviewed === "false") query = query.eq("is_reviewed", false);
  const { data: events, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invitationIds = Array.from(
    new Set((sessions ?? []).map((session) => session.invitation_id).filter(Boolean))
  ) as string[];
  const { data: invitations } = invitationIds.length
    ? await admin
        .from("exam_invitations")
        .select("id, name, phone")
        .in("id", invitationIds)
    : { data: [] };
  const invitationMap = new Map(
    (invitations ?? []).map((invitation) => [invitation.id, invitation])
  );
  const sessionMap = new Map(
    (sessions ?? []).map((session) => [session.id, session])
  );

  return NextResponse.json({
    events: (events ?? []).map((event) => {
      const session = sessionMap.get(event.session_id);
      const invitation = session?.invitation_id
        ? invitationMap.get(session.invitation_id)
        : null;
      return {
        ...event,
        applicantName: invitation?.name ?? "-",
        applicantPhone: invitation?.phone ?? "-",
      };
    }),
  });
}

export async function PATCH(request: Request) {
  if (!(await requireExaminer())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const { id, isReviewed, reviewerNote } = (body ?? {}) as {
    id?: number;
    isReviewed?: boolean;
    reviewerNote?: string;
  };
  const note = (reviewerNote ?? "").trim();
  if (!Number.isInteger(id) || typeof isReviewed !== "boolean" || note.length > 1000) {
    return NextResponse.json({ error: "invalid review" }, { status: 400 });
  }
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("monitoring_events")
    .update({ is_reviewed: isReviewed, reviewer_note: note || null })
    .eq("id", id!)
    .select("id, is_reviewed, reviewer_note")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "event not found" }, { status: 404 });
  return NextResponse.json({ event: data });
}
