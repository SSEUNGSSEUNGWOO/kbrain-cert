import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

type Fixture = {
  examId: string;
  invitationId: string;
  originalSlug: string | null;
  originalIsTestMode: boolean;
  slug: string;
  name: string;
  phoneLast4: string;
  sessionId?: string;
  answerQuestionId?: string;
};

const env = readEnvLocal();
const supabase = createClient(
  requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
let fixture: Fixture;

test.describe.serial("응시자 이름·전화번호 진입", () => {
  test.beforeAll(async () => {
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, slug, is_test_mode")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (examError || !exam) throw examError ?? new Error("시험 데이터가 없습니다.");

    const suffix = randomUUID().slice(0, 8);
    const slug = `e2e-phone-${suffix}`;
    const name = `E2E_${suffix}`;
    const phoneLast4 = "1357";
    const { error: slugError } = await supabase
      .from("exams")
      .update({ slug, is_test_mode: false })
      .eq("id", exam.id);
    if (slugError) throw slugError;

    const { data: invitation, error: invitationError } = await supabase
      .from("exam_invitations")
      .insert({
        exam_id: exam.id,
        name,
        phone: `010-2468-${phoneLast4}`,
        email: null,
        organization: "Playwright E2E",
        invite_code: randomBytes(6).toString("hex"),
        status: "created",
      })
      .select("id")
      .single();
    if (invitationError || !invitation) {
      await supabase.from("exams").update({ slug: exam.slug }).eq("id", exam.id);
      throw invitationError ?? new Error("검증용 명단 생성 실패");
    }

    fixture = {
      examId: exam.id,
      invitationId: invitation.id,
      originalSlug: exam.slug,
      originalIsTestMode: exam.is_test_mode,
      slug,
      name,
      phoneLast4,
    };
  });

  test.afterAll(async () => {
    if (!fixture) return;
    await supabase
      .from("exam_sessions")
      .delete()
      .eq("invitation_id", fixture.invitationId);
    await supabase
      .from("exam_invitations")
      .delete()
      .eq("id", fixture.invitationId);
    await supabase
      .from("exams")
      .update({
        slug: fixture.originalSlug,
        is_test_mode: fixture.originalIsTestMode,
      })
      .eq("id", fixture.examId);
  });

  test("공용 slug 페이지가 열린다", async ({ page }) => {
    await page.goto(`/exam/${fixture.slug}`);
    await expect(page.getByText("응시자 진입", { exact: true })).toBeVisible();
  });

  test("틀린 전화번호 뒷자리는 차단한다", async ({ request }) => {
    const response = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: "9999",
      },
    });
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not on roster" });
  });

  test("동시에 진입해도 세션을 하나만 생성한다", async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request.post("/api/exam/enter", {
          data: {
            examId: fixture.examId,
            name: fixture.name,
            phoneLast4: fixture.phoneLast4,
          },
        })
      )
    );
    expect(responses.every((response) => response.status() === 200)).toBe(true);

    const bodies = await Promise.all(responses.map((response) => response.json()));
    const sessionIds = new Set(bodies.map((body) => body.sessionId));
    expect(sessionIds.size).toBe(1);
    fixture.sessionId = [...sessionIds][0];

    const { count, error } = await supabase
      .from("exam_sessions")
      .select("*", { count: "exact", head: true })
      .eq("invitation_id", fixture.invitationId);
    if (error) throw error;
    expect(count).toBe(1);
  });

  test("정상 재진입은 기존 세션을 이어서 사용한다", async ({ page, request }) => {
    await page.goto(`/exam/${fixture.slug}`);
    await page.getByLabel("이름").fill(fixture.name);
    await page.getByLabel("전화번호 뒷 4자리").fill(fixture.phoneLast4);
    await page.getByRole("button", { name: /응시 시작/ }).click();
    await expect(page).toHaveURL(/\/exam\/session\/[^/]+\/take$/);
    const browserSessionId = page
      .url()
      .match(/\/exam\/session\/([^/]+)\/take$/)?.[1];
    expect(browserSessionId).toBe(fixture.sessionId);

    const response = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessionId: fixture.sessionId,
      reconnect: true,
    });
  });

  test("전체 답안을 확정 저장하고 재접속 데이터로 복원한다", async ({
    request,
  }) => {
    expect(fixture.sessionId).toBeTruthy();
    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);

    const { data: examQuestion, error: questionError } = await supabase
      .from("exam_questions")
      .select("question_id")
      .eq("exam_id", fixture.examId)
      .order("order_num")
      .limit(1)
      .single();
    if (questionError || !examQuestion) {
      throw questionError ?? new Error("검증용 문항이 없습니다.");
    }
    fixture.answerQuestionId = examQuestion.question_id;
    const marker = `복원검증_${randomUUID()}`;

    const save = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: fixture.answerQuestionId,
            slotValues: { e2e_restore: marker },
          },
        ],
      },
    });
    expect(save.status()).toBe(200);

    const { data: savedAnswer, error: answerError } = await supabase
      .from("answers")
      .select("slot_values")
      .eq("session_id", fixture.sessionId!)
      .eq("question_id", fixture.answerQuestionId)
      .single();
    if (answerError) throw answerError;
    expect(savedAnswer.slot_values).toMatchObject({ e2e_restore: marker });

    const takePage = await request.get(
      `/exam/session/${fixture.sessionId}/take`
    );
    expect(takePage.status()).toBe(200);
    expect(await takePage.text()).toContain(marker);
  });

  test("최종 제출 직전 저장한 답안까지 제출 상태로 확정한다", async ({
    request,
  }) => {
    expect(fixture.sessionId).toBeTruthy();
    expect(fixture.answerQuestionId).toBeTruthy();
    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);
    const marker = `즉시제출_${randomUUID()}`;

    const save = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: fixture.answerQuestionId,
            slotValues: { e2e_submit: marker },
          },
        ],
      },
    });
    expect(save.status()).toBe(200);

    const submit = await request.post("/api/exam/session/submit", {
      data: { sessionId: fixture.sessionId, auto: false },
    });
    expect(submit.status()).toBe(200);

    const { data: submittedAnswer, error } = await supabase
      .from("answers")
      .select("slot_values, submitted_at")
      .eq("session_id", fixture.sessionId!)
      .eq("question_id", fixture.answerQuestionId!)
      .single();
    if (error) throw error;
    expect(submittedAnswer.slot_values).toMatchObject({ e2e_submit: marker });
    expect(submittedAnswer.submitted_at).not.toBeNull();
  });

  test("제출 완료한 응시자의 재진입을 차단한다", async ({ request }) => {
    expect(fixture.sessionId).toBeTruthy();
    const response = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "already submitted" });
  });

  test("테스트 시험은 제출 후 새 회차로 다시 응시한다", async ({ request }) => {
    const { error } = await supabase
      .from("exams")
      .update({ is_test_mode: true })
      .eq("id", fixture.examId);
    if (error) throw error;

    const first = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.sessionId).not.toBe(fixture.sessionId);
    expect(firstBody.reconnect).toBe(false);

    const reconnect = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(reconnect.status()).toBe(200);
    await expect(reconnect.json()).resolves.toMatchObject({
      sessionId: firstBody.sessionId,
      reconnect: true,
    });

    const { count, error: countError } = await supabase
      .from("exam_sessions")
      .select("*", { count: "exact", head: true })
      .eq("invitation_id", fixture.invitationId);
    if (countError) throw countError;
    expect(count).toBe(2);
  });
});

function readEnvLocal(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    result[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function requiredEnv(envValues: Record<string, string>, key: string): string {
  const value = process.env[key] ?? envValues[key];
  if (!value) throw new Error(`${key} 환경 변수가 필요합니다.`);
  return value;
}
