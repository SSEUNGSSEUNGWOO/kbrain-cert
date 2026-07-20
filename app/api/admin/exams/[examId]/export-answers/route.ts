import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 시험 답안 zip 다운로드 (관리자 · 채점 위임용)
 * 구조:
 *   {examTitle}_answers_{date}.zip
 *     summary.csv                    · 전체 요약
 *     README.txt                     · 안내
 *     {name}_{code}/                 · 응시자별 폴더
 *       _info.md                     · 응시자 상태·이벤트 통계
 *       Q01_1-슬롯라벨.txt/.md
 *       Q01_2-...
 *     auto_submitted/                · 자동 제출 응시자만 별도 격리
 *       {name}_{code}/...
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { examId } = await params;
  const admin = createAdminSupabase();

  const { data: exam } = await admin
    .from("exams")
    .select("id, title, duration_minutes, pass_score, exam_date")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  const [{ data: sessions }, { data: examQuestions }, { data: examSets }] =
    await Promise.all([
      admin
        .from("exam_sessions")
        .select(
          "id, status, start_time, submit_time, auto_submitted, is_flagged, time_extension_minutes, invitation_id, monitoring_notes"
        )
        .eq("exam_id", examId)
        .order("start_time", { ascending: true, nullsFirst: true }),
      admin
        .from("exam_questions")
        .select(
          "order_num, questions(id, code, content, submission_slots, max_score, set_id, set_order)"
        )
        .eq("exam_id", examId)
        .order("order_num"),
      admin
        .from("exam_sets")
        .select("order_num, question_sets(id, title, scenario)")
        .eq("exam_id", examId)
        .order("order_num"),
    ]);

  const questions = (examQuestions ?? []).map(
    (eq) =>
      (eq as unknown as {
        questions: {
          id: string;
          code: string;
          content: string;
          submission_slots: Array<{
            id: string;
            type: string;
            label: string;
            max_score: number;
          }>;
          max_score: number;
          set_id: string;
          set_order: number;
        };
      }).questions
  );
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const setMap = new Map(
    (examSets ?? []).map((es) => {
      const s = (es as unknown as {
        question_sets: { id: string; title: string; scenario: string | null };
      }).question_sets;
      return [s.id, s];
    })
  );

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const invitationIds = Array.from(
    new Set((sessions ?? []).map((s) => s.invitation_id).filter(Boolean))
  ) as string[];

  const [{ data: invitations }, { data: answers }, { data: eventCounts }] =
    await Promise.all([
      invitationIds.length
        ? admin
            .from("exam_invitations")
            .select("id, name, email, organization, invite_code")
            .in("id", invitationIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string | null;
              email: string;
              organization: string | null;
              invite_code: string;
            }>,
          }),
      sessionIds.length
        ? admin
            .from("answers")
            .select("session_id, question_id, slot_values, submitted_at")
            .in("session_id", sessionIds)
        : Promise.resolve({
            data: [] as Array<{
              session_id: string;
              question_id: string;
              slot_values: Record<string, unknown> | null;
              submitted_at: string | null;
            }>,
          }),
      sessionIds.length
        ? admin
            .from("monitoring_events")
            .select("session_id, event_type, severity")
            .in("session_id", sessionIds)
        : Promise.resolve({
            data: [] as Array<{
              session_id: string;
              event_type: string;
              severity: string;
            }>,
          }),
    ]);

  const invMap = new Map(
    (invitations ?? []).map((inv) => [inv.id, inv])
  );

  const answersBySession = new Map<
    string,
    Map<string, Record<string, unknown>>
  >();
  for (const a of answers ?? []) {
    if (!answersBySession.has(a.session_id))
      answersBySession.set(a.session_id, new Map());
    answersBySession
      .get(a.session_id)!
      .set(a.question_id, a.slot_values ?? {});
  }

  const eventStatsBySession = new Map<
    string,
    { high: number; warn: number; info: number; byType: Record<string, number> }
  >();
  for (const e of eventCounts ?? []) {
    const cur = eventStatsBySession.get(e.session_id) ?? {
      high: 0,
      warn: 0,
      info: 0,
      byType: {},
    };
    if (e.severity === "high") cur.high += 1;
    else if (e.severity === "warn") cur.warn += 1;
    else cur.info += 1;
    cur.byType[e.event_type] = (cur.byType[e.event_type] ?? 0) + 1;
    eventStatsBySession.set(e.session_id, cur);
  }

  const zip = new AdmZip();

  // README
  zip.addFile(
    "README.txt",
    Buffer.from(
      `${exam.title} · 답안 export\n` +
        `생성: ${new Date().toLocaleString("ko-KR")}\n\n` +
        `구조:\n` +
        `  summary.csv                  전체 응시자 요약\n` +
        `  {이름}_{초대코드}/            정상 응시자 폴더 (각 폴더에 _info.md + Q01_1-슬롯.txt ...)\n` +
        `  auto_submitted/{이름}_{초대코드}/  자동 제출 응시자 (시간 만료 or 감독관 강제 종료)\n\n` +
        `채점 참고:\n` +
        `  - _info.md 파일에 응시자 상태·이벤트·연장 시간 등 요약\n` +
        `  - Q{문항번호}_{슬롯순번}-{슬롯라벨}.txt 형태\n` +
        `  - 파일 슬롯(file type)은 M4 이후 지원 예정 (지금은 slot_values에 경로만 저장 시 포함)\n`,
      "utf-8"
    )
  );

  // summary.csv
  const csvLines: string[] = [];
  csvLines.push(
    [
      "응시자",
      "이메일",
      "조직",
      "초대코드",
      "상태",
      "시작",
      "제출",
      "소요분",
      "답변수",
      "전체문항",
      "HIGH이벤트",
      "WARN이벤트",
      "자동제출",
      "Flagged",
      "시간연장(분)",
    ].join(",")
  );

  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;

  for (const session of sessions ?? []) {
    const inv = session.invitation_id ? invMap.get(session.invitation_id) : null;
    const name = inv?.name ?? (inv?.email ? inv.email.split("@")[0] : "익명");
    const code = inv?.invite_code ?? session.id.slice(0, 8);
    const events = eventStatsBySession.get(session.id) ?? {
      high: 0,
      warn: 0,
      info: 0,
      byType: {},
    };
    const answered = answersBySession.get(session.id)?.size ?? 0;
    const durationMs =
      session.start_time && session.submit_time
        ? new Date(session.submit_time).getTime() -
          new Date(session.start_time).getTime()
        : null;
    const durationMin = durationMs ? Math.round(durationMs / 60000) : null;

    csvLines.push(
      [
        csvEscape(name),
        csvEscape(inv?.email ?? ""),
        csvEscape(inv?.organization ?? ""),
        code,
        session.status,
        session.start_time ? new Date(session.start_time).toISOString() : "",
        session.submit_time ? new Date(session.submit_time).toISOString() : "",
        durationMin ?? "",
        answered,
        questions.length,
        events.high,
        events.warn,
        session.auto_submitted ? "Y" : "",
        session.is_flagged ? "Y" : "",
        session.time_extension_minutes ?? 0,
      ].join(",")
    );

    const folderName = slugify(`${name}_${code}`);
    const basePath = session.auto_submitted
      ? `auto_submitted/${folderName}`
      : folderName;

    // _info.md
    const infoLines: string[] = [];
    infoLines.push(`# ${name}`);
    infoLines.push("");
    infoLines.push(`- 이메일: ${inv?.email ?? "-"}`);
    infoLines.push(`- 조직: ${inv?.organization ?? "-"}`);
    infoLines.push(`- 초대코드: ${code}`);
    infoLines.push(`- 세션 ID: ${session.id}`);
    infoLines.push("");
    infoLines.push(`## 상태`);
    infoLines.push(`- 상태: ${session.status}`);
    infoLines.push(
      `- 시작: ${session.start_time ? new Date(session.start_time).toLocaleString("ko-KR") : "-"}`
    );
    infoLines.push(
      `- 제출: ${session.submit_time ? new Date(session.submit_time).toLocaleString("ko-KR") : "-"}`
    );
    if (durationMin != null)
      infoLines.push(`- 소요 시간: ${durationMin}분`);
    if (session.auto_submitted) infoLines.push(`- ⚠ 자동 제출됨`);
    if (session.is_flagged) infoLines.push(`- 🚩 Flagged`);
    if ((session.time_extension_minutes ?? 0) > 0)
      infoLines.push(
        `- 시간 연장: +${session.time_extension_minutes}분`
      );
    if (session.monitoring_notes)
      infoLines.push(`- 감독관 메모: ${session.monitoring_notes}`);
    infoLines.push("");
    infoLines.push(`## 답변 진행`);
    infoLines.push(`- 답변한 문항: ${answered} / ${questions.length}`);
    infoLines.push("");
    infoLines.push(`## 감독 이벤트`);
    infoLines.push(`- HIGH: ${events.high}건 · WARN: ${events.warn}건 · INFO: ${events.info}건`);
    if (Object.keys(events.byType).length > 0) {
      for (const [type, count] of Object.entries(events.byType)) {
        infoLines.push(`  - ${type}: ${count}건`);
      }
    }
    zip.addFile(`${basePath}/_info.md`, Buffer.from(infoLines.join("\n"), "utf-8"));

    // 문항별 답안 파일
    const sessionAnswers = answersBySession.get(session.id);
    if (sessionAnswers) {
      for (const q of questions) {
        const slotValues = sessionAnswers.get(q.id);
        if (!slotValues) continue;
        const qNum = q.set_order.toString().padStart(2, "0");
        const set = setMap.get(q.set_id);
        for (let i = 0; i < q.submission_slots.length; i++) {
          const slot = q.submission_slots[i];
          const value = slotValues[slot.id];
          if (value == null || value === "") continue;
          const slotNum = (i + 1).toString().padStart(1, "0");
          const labelSlug = slugify(slot.label);
          const setPrefix = set ? `[${set.title}] ` : "";

          // file 타입: Storage에서 다운받아 zip에 포함
          if (slot.type === "file" && typeof value === "object" && value !== null) {
            const fileInfo = value as {
              path?: string;
              name?: string;
              size?: number;
              mime?: string;
            };
            if (fileInfo.path) {
              try {
                const { data: fileBlob } = await admin.storage
                  .from("answer-files")
                  .download(fileInfo.path);
                if (fileBlob) {
                  const buffer = Buffer.from(await fileBlob.arrayBuffer());
                  const originalName = fileInfo.name ?? "file";
                  const ext = originalName.match(/(\.[a-zA-Z0-9]{1,10})$/)?.[1] ?? "";
                  const safeName = slugify(
                    originalName.replace(/\.[^.]+$/, "")
                  );
                  zip.addFile(
                    `${basePath}/Q${qNum}_${slotNum}-${labelSlug}-${safeName}${ext}`,
                    buffer
                  );
                  continue;
                }
              } catch {
                /* fallthrough to text */
              }
            }
            zip.addFile(
              `${basePath}/Q${qNum}_${slotNum}-${labelSlug}.txt`,
              Buffer.from(
                `[파일 슬롯 · 다운로드 실패 or 미업로드]\n${JSON.stringify(value, null, 2)}`,
                "utf-8"
              )
            );
            continue;
          }

          const header =
            `# 문항 ${q.set_order} · ${slot.label} (${slot.type} · 배점 ${slot.max_score}점)\n\n` +
            `${setPrefix}${q.content}\n\n---\n\n답안:\n\n`;
          const body =
            typeof value === "string" || typeof value === "number"
              ? String(value)
              : JSON.stringify(value, null, 2);
          zip.addFile(
            `${basePath}/Q${qNum}_${slotNum}-${labelSlug}.txt`,
            Buffer.from(header + body, "utf-8")
          );
        }
      }
    }
  }

  zip.addFile("summary.csv", Buffer.from("﻿" + csvLines.join("\n"), "utf-8"));

  const buffer = zip.toBuffer();
  const filename = `${slugify(exam.title)}_answers_${dateStr}.zip`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${sanitizeAscii(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(v: string): string {
  const s = v ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function slugify(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function sanitizeAscii(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
}
