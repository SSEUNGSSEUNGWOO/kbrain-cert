import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

type Fixture = {
  examId: string;
  invitationId: string;
  originalSlug: string | null;
  originalIsTestMode: boolean;
  originalExamDate: string | null;
  originalStatus: string;
  originalAllowNoScreenShare: boolean;
  durationMinutes: number;
  slug: string;
  name: string;
  phoneLast4: string;
  sessionId?: string;
  answerQuestionId?: string;
  answerSlotId?: string;
  questionContent?: string;
  fileQuestionId?: string;
  fileSlotId?: string;
  identityPath?: string;
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
      .select(
        "id, slug, is_test_mode, exam_date, duration_minutes, status, allow_no_screen_share"
      )
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
      .update({
        slug,
        is_test_mode: false,
        status: "open",
        allow_no_screen_share: false,
      })
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

    const { data: examQuestions, error: fileQuestionError } = await supabase
      .from("exam_questions")
      .select("question_id, questions(submission_slots)")
      .eq("exam_id", exam.id);
    if (fileQuestionError) throw fileQuestionError;
    const fileQuestion = (examQuestions ?? []).find((item) => {
      const slots = (
        item as unknown as {
          questions: { submission_slots: Array<{ id: string; type: string }> };
        }
      ).questions?.submission_slots;
      return slots?.some((slot) => slot.type === "file");
    });
    const fileSlots = fileQuestion
      ? (
          fileQuestion as unknown as {
            questions: {
              submission_slots: Array<{ id: string; type: string }>;
            };
          }
        ).questions.submission_slots
      : [];

    fixture = {
      examId: exam.id,
      invitationId: invitation.id,
      originalSlug: exam.slug,
      originalIsTestMode: exam.is_test_mode,
      originalExamDate: exam.exam_date,
      originalStatus: exam.status,
      originalAllowNoScreenShare: exam.allow_no_screen_share,
      durationMinutes: exam.duration_minutes,
      slug,
      name,
      phoneLast4,
      fileQuestionId: fileQuestion?.question_id,
      fileSlotId: fileSlots.find((slot) => slot.type === "file")?.id,
    };
  });

  test.afterAll(async () => {
    if (!fixture) return;
    if (fixture.identityPath) {
      await supabase.storage
        .from("identity-documents")
        .remove([fixture.identityPath]);
    }
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
        exam_date: fixture.originalExamDate,
        status: fixture.originalStatus,
        allow_no_screen_share: fixture.originalAllowNoScreenShare,
      })
      .eq("id", fixture.examId);
  });

  test("공용 slug 페이지가 열린다", async ({ page }) => {
    await page.goto(`/exam/${fixture.slug}`);
    await expect(page.getByText("응시자 진입", { exact: true })).toBeVisible();
  });

  test("응시자 PC 시간이 틀려도 서버 시각은 영향을 받지 않는다", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + 24 * 60 * 60 * 1000;
    });
    await page.goto(`/exam/${fixture.slug}`);
    const result = await page.evaluate(async () => {
      const response = await fetch("/api/time", { cache: "no-store" });
      return (await response.json()) as { nowMs: number };
    });
    expect(Math.abs(result.nowMs - Date.now())).toBeLessThan(10_000);
    const skewedBrowserNow = await page.evaluate(() => Date.now());
    expect(skewedBrowserNow - result.nowMs).toBeGreaterThan(
      23 * 60 * 60 * 1000
    );
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

  test("같은 이름으로 전화번호를 반복 대입하면 제한한다", async ({ request }) => {
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await request.post("/api/exam/enter", {
        data: {
          examId: fixture.examId,
          name: fixture.name,
          phoneLast4: String(8000 + attempt),
        },
      });
      expect(response.status()).toBe(404);
    }
    const blocked = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: "8999",
      },
    });
    expect(blocked.status()).toBe(429);
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

  test("기존 신분증을 복원하고 예약 시각에 대기실에서 자동 입장한다", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    expect(fixture.sessionId).toBeTruthy();
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getDisplayMedia.bind(
        navigator.mediaDevices
      );
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        const stream = await original(options);
        (
          window as Window & { __e2eScreenStream?: MediaStream }
        ).__e2eScreenStream = stream;
        return stream;
      };
    });
    fixture.identityPath = `${fixture.sessionId}/e2e_identity.png`;
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
      "base64"
    );
    const { error: uploadError } = await supabase.storage
      .from("identity-documents")
      .upload(fixture.identityPath, onePixelPng, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const startsAt = new Date(Date.now() + 30_000).toISOString();
    const { error: setupError } = await supabase
      .from("exam_sessions")
      .update({ identity_image_url: fixture.identityPath })
      .eq("id", fixture.sessionId!);
    if (setupError) throw setupError;
    const { error: scheduleError } = await supabase
      .from("exams")
      .update({ exam_date: startsAt })
      .eq("id", fixture.examId);
    if (scheduleError) throw scheduleError;

    await page.goto(`/exam/${fixture.slug}`);
    await page.getByLabel("이름").fill(fixture.name);
    await page.getByLabel("전화번호 뒷 4자리").fill(fixture.phoneLast4);
    await page.getByRole("button", { name: /응시 시작/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`/exam/session/${fixture.sessionId}/take$`)
    );

    await page
      .getByRole("button", { name: /화면 공유 테스트|다시 테스트/ })
      .click();
    await expect(
      page.getByRole("button", { name: "보안 서약으로 이동 →" })
    ).toBeEnabled({ timeout: 15_000 });
    await page
      .getByRole("button", { name: "보안 서약으로 이동 →" })
      .click();
    const checkboxes = page.getByRole("checkbox");
    for (let index = 0; index < (await checkboxes.count()); index += 1) {
      await checkboxes.nth(index).check();
    }
    await page
      .getByRole("button", { name: "동의하고 대기실로 이동 →" })
      .click();

    await expect(page.getByText("✓ 업로드 완료")).toBeVisible();
    await expect(page.getByText("Step 3 · 대기실")).toBeVisible();
    await expect(page.getByText(/문항 · 총 \d+/)).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText("Step 3 · 대기실")).not.toBeVisible();
    await page.evaluate(() => {
      (
        window as Window & { __e2eScreenStream?: MediaStream }
      ).__e2eScreenStream?.getTracks().forEach((track) => track.stop());
    });
    await expect(
      page.getByRole("heading", { name: "화면 공유가 중단되었습니다" })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "전체 화면 다시 공유" })
      .click();
    await expect(
      page.getByRole("heading", { name: "화면 공유가 중단되었습니다" })
    ).not.toBeVisible();

    const { error: restoreError } = await supabase
      .from("exams")
      .update({ exam_date: fixture.originalExamDate })
      .eq("id", fixture.examId);
    if (restoreError) throw restoreError;
  });

  test("예약 시각 전 시험 시작을 서버에서 차단한다", async ({ request }) => {
    expect(fixture.sessionId).toBeTruthy();
    const startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("exams")
      .update({ exam_date: startsAt })
      .eq("id", fixture.examId);
    if (error) throw error;

    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);
    const start = await request.post("/api/exam/session/start", {
      data: { sessionId: fixture.sessionId },
    });
    expect(start.status()).toBe(409);
    const startBody = await start.json();
    expect(startBody.error).toBe("exam not started");
    expect(new Date(startBody.startsAt).getTime()).toBe(
      new Date(startsAt).getTime()
    );

    const { data: examQuestion, error: questionError } = await supabase
      .from("exam_questions")
      .select("question_id, questions(content)")
      .eq("exam_id", fixture.examId)
      .order("order_num")
      .limit(1)
      .single();
    if (questionError || !examQuestion) throw questionError;
    const content = (
      examQuestion as unknown as {
        questions: { content: string } | null;
      }
    ).questions?.content;
    expect(content).toBeTruthy();
    const contentResponse = await request.get("/api/exam/content");
    expect(contentResponse.status()).toBe(409);
    const takeResponse = await request.get(
      `/exam/session/${fixture.sessionId}/take`
    );
    expect(await takeResponse.text()).not.toContain(content!);

    const { error: restoreError } = await supabase
      .from("exams")
      .update({ exam_date: fixture.originalExamDate })
      .eq("id", fixture.examId);
    if (restoreError) throw restoreError;
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
      .select("question_id, questions(content, submission_slots)")
      .eq("exam_id", fixture.examId)
      .order("order_num")
      .limit(1)
      .single();
    if (questionError || !examQuestion) {
      throw questionError ?? new Error("검증용 문항이 없습니다.");
    }
    fixture.answerQuestionId = examQuestion.question_id;
    const question = (
      examQuestion as unknown as {
        questions: {
          content: string;
          submission_slots: Array<{ id: string }>;
        } | null;
      }
    ).questions;
    fixture.answerSlotId = question?.submission_slots[0]?.id;
    fixture.questionContent = question?.content;
    if (!fixture.answerSlotId) throw new Error("검증용 답안 슬롯이 없습니다.");
    const marker = `복원검증_${randomUUID()}`;

    const save = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: fixture.answerQuestionId,
            slotValues: { [fixture.answerSlotId]: marker },
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
    expect(savedAnswer.slot_values).toMatchObject({
      [fixture.answerSlotId]: marker,
    });

    const takePage = await request.get(
      `/exam/session/${fixture.sessionId}/take`
    );
    expect(takePage.status()).toBe(200);
    expect(await takePage.text()).toContain(marker);
  });

  test("답안 파일을 서버 메모리 경유 없이 직접 업로드하고 삭제한다", async ({
    request,
  }) => {
    expect(fixture.fileQuestionId).toBeTruthy();
    expect(fixture.fileSlotId).toBeTruthy();
    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);
    const metadata = {
      sessionId: fixture.sessionId,
      questionId: fixture.fileQuestionId,
      slotId: fixture.fileSlotId,
      fileName: "e2e-direct-upload.txt",
      fileSize: 17,
      mime: "text/plain",
    };
    const prepare = await request.post("/api/exam/answers/upload", {
      data: metadata,
    });
    expect(prepare.status(), await prepare.text()).toBe(200);
    const prepared = await prepare.json();
    const anon = createClient(
      requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { auth: { persistSession: false } }
    );
    const content = new TextEncoder().encode("direct-upload-e2e");
    const { error: uploadError } = await anon.storage
      .from("answer-files")
      .uploadToSignedUrl(prepared.path, prepared.token, content, {
        contentType: "text/plain",
      });
    if (uploadError) throw uploadError;

    const complete = await request.patch("/api/exam/answers/upload", {
      data: { ...metadata, path: prepared.path },
    });
    expect(complete.status(), await complete.text()).toBe(200);
    const remove = await request.delete("/api/exam/answers/upload", {
      data: { ...metadata, path: prepared.path },
    });
    expect(remove.status(), await remove.text()).toBe(200);

    const folder = prepared.path.slice(0, prepared.path.lastIndexOf("/"));
    const fileName = prepared.path.slice(prepared.path.lastIndexOf("/") + 1);
    const { data: remaining, error: listError } = await supabase.storage
      .from("answer-files")
      .list(folder, { search: fileName });
    if (listError) throw listError;
    expect(remaining).toHaveLength(0);
  });

  test("답안 저장 요청 100개가 동시에 와도 유실 없이 처리한다", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    expect(fixture.answerQuestionId).toBeTruthy();
    expect(fixture.answerSlotId).toBeTruthy();
    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);
    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        request.post("/api/exam/answers/save", {
          data: {
            sessionId: fixture.sessionId,
            questionId: fixture.answerQuestionId,
            slotValues: {
              [fixture.answerSlotId!]: `동시저장_${index}`,
            },
          },
        })
      )
    );
    expect(responses.every((response) => response.status() === 200)).toBe(true);
    const { data: saved, error } = await supabase
      .from("answers")
      .select("slot_values")
      .eq("session_id", fixture.sessionId!)
      .eq("question_id", fixture.answerQuestionId!)
      .single();
    if (error) throw error;
    expect(
      Object.values(saved.slot_values as Record<string, unknown>)[0]
    ).toMatch(/^동시저장_\d+$/);
  });

  test("다른 시험 문항과 존재하지 않는 슬롯 주입을 차단한다", async ({
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

    const foreignQuestion = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: randomUUID(),
            slotValues: {},
          },
        ],
      },
    });
    expect(foreignQuestion.status()).toBe(400);

    const invalidSlot = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: fixture.answerQuestionId,
            slotValues: { forged_slot: "주입 시도" },
          },
        ],
      },
    });
    expect(invalidSlot.status()).toBe(400);
  });

  test("최종 제출 직전 저장한 답안까지 제출 상태로 확정한다", async ({
    request,
  }) => {
    expect(fixture.sessionId).toBeTruthy();
    expect(fixture.answerQuestionId).toBeTruthy();
    expect(fixture.answerSlotId).toBeTruthy();
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
            slotValues: { [fixture.answerSlotId!]: marker },
          },
        ],
      },
    });
    expect(save.status()).toBe(200);

    const submit = await request.post("/api/exam/session/submit", {
      data: { sessionId: fixture.sessionId, auto: false },
    });
    expect(submit.status(), await submit.text()).toBe(200);

    const { data: submittedAnswer, error } = await supabase
      .from("answers")
      .select("slot_values, submitted_at")
      .eq("session_id", fixture.sessionId!)
      .eq("question_id", fixture.answerQuestionId!)
      .single();
    if (error) throw error;
    expect(submittedAnswer.slot_values).toMatchObject({
      [fixture.answerSlotId!]: marker,
    });
    expect(submittedAnswer.submitted_at).not.toBeNull();

    const lateSave = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: fixture.sessionId,
        answers: [
          {
            questionId: fixture.answerQuestionId,
            slotValues: { [fixture.answerSlotId!]: "제출후덮어쓰기" },
          },
        ],
      },
    });
    expect(lateSave.status()).toBe(409);
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

  test("서버 마감 시각 이후 답안 저장을 차단하고 세션을 종료한다", async ({
    request,
  }) => {
    const expiredAt = new Date(
      Date.now() - (fixture.durationMinutes + 1) * 60 * 1000
    ).toISOString();
    const { error } = await supabase
      .from("exams")
      .update({ exam_date: expiredAt })
      .eq("id", fixture.examId);
    if (error) throw error;

    const enter = await request.post("/api/exam/enter", {
      data: {
        examId: fixture.examId,
        name: fixture.name,
        phoneLast4: fixture.phoneLast4,
      },
    });
    expect(enter.status()).toBe(200);
    const body = await enter.json();

    const save = await request.post("/api/exam/answers/save", {
      data: {
        sessionId: body.sessionId,
        questionId: fixture.answerQuestionId,
        slotValues: { too_late: true },
      },
    });
    expect(save.status()).toBe(409);
    await expect(save.json()).resolves.toEqual({
      error: "exam time expired",
    });

    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions")
      .select("status, submit_time, auto_submitted")
      .eq("id", body.sessionId)
      .single();
    if (sessionError) throw sessionError;
    expect(session.status).toBe("submitted");
    expect(session.submit_time).not.toBeNull();
    expect(session.auto_submitted).toBe(true);
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
