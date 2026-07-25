/**
 * k6 부하 테스트 · 100명 응시자 동시 응시 시뮬레이션
 *
 * 시나리오:
 *   1분에 걸쳐 0→100 vUser ramp-up
 *   3분간 100 vUser 유지 (응시 흐름 반복 실행)
 *   1분에 걸쳐 100→0 ramp-down
 *
 * 각 vUser 흐름:
 *   POST /api/exam/enter                (로그인 · 세션 쿠키 발급)
 *   POST /api/precheck  step=env
 *   POST /api/precheck  step=pledge
 *   POST /api/precheck  step=waiting
 *   반복 × 3문항:
 *     POST /api/exam/answers/save       (답안 저장 3회씩)
 *   POST /api/exam/session/submit
 *
 * 실행 (PowerShell):
 *   $env:BASE_URL="https://<preview-url>"
 *   $env:EXAM_ID="<exam-uuid>"
 *   $env:QUESTION_IDS="qid1,qid2,qid3"
 *   k6 run tests/load/exam-flow.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EXAM_ID = __ENV.EXAM_ID;
const QUESTION_IDS = (__ENV.QUESTION_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!EXAM_ID) {
  throw new Error("Set EXAM_ID env var (e.g. $env:EXAM_ID=\"...\")");
}

export const options = {
  scenarios: {
    exam_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "http_req_failed": ["rate<0.02"],
    "http_req_duration{name:enter}": ["p(95)<2000"],
    "http_req_duration{name:precheck}": ["p(95)<1500"],
    "http_req_duration{name:save}": ["p(95)<1500"],
    "http_req_duration{name:submit}": ["p(95)<3000"],
  },
};

const enterFailures = new Counter("enter_failures");
const submitLatency = new Trend("submit_latency_ms");

export default function () {
  const vu = __VU; // 1..100
  const idx = String(vu).padStart(3, "0");
  const name = `LoadTest${idx}`;
  const phoneLast4 = String(vu).padStart(4, "0");

  // 1. Enter
  const enterRes = http.post(
    `${BASE_URL}/api/exam/enter`,
    JSON.stringify({ examId: EXAM_ID, name, phoneLast4 }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "enter" },
    }
  );
  const enterOk = check(enterRes, {
    "enter 200": (r) => r.status === 200,
    "enter has sessionId": (r) => !!(r.json() || {}).sessionId,
  });
  if (!enterOk) {
    enterFailures.add(1);
    return;
  }
  const sessionId = enterRes.json("sessionId");

  sleep(randBetween(0.5, 1.5));

  // 2. precheck env
  http.post(
    `${BASE_URL}/api/precheck`,
    JSON.stringify({
      sessionId,
      step: "env",
      data: { envResult: { monitor: { status: "ok", detail: "single" } } },
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "precheck" },
    }
  );

  sleep(randBetween(1, 3));

  // 3. precheck pledge
  http.post(
    `${BASE_URL}/api/precheck`,
    JSON.stringify({ sessionId, step: "pledge" }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "precheck" },
    }
  );

  sleep(randBetween(1, 2));

  // 4. precheck waiting
  http.post(
    `${BASE_URL}/api/precheck`,
    JSON.stringify({ sessionId, step: "waiting" }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "precheck" },
    }
  );

  sleep(1);

  // 5. 답안 저장 반복 (3문항 × 각 3회 · 2~4초 간격)
  for (const qid of QUESTION_IDS.length ? QUESTION_IDS : [null]) {
    if (!qid) break;
    for (let i = 0; i < 3; i++) {
      http.post(
        `${BASE_URL}/api/exam/answers/save`,
        JSON.stringify({
          sessionId,
          questionId: qid,
          slotValues: { text: `LoadTest ${name} answer ${i} at ${Date.now()}` },
        }),
        {
          headers: { "Content-Type": "application/json" },
          tags: { name: "save" },
        }
      );
      sleep(randBetween(2, 4));
    }
  }

  // 6. 제출
  const submitStart = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/api/exam/session/submit`,
    JSON.stringify({ sessionId, auto: false, answers: [] }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "submit" },
    }
  );
  submitLatency.add(Date.now() - submitStart);
  check(submitRes, {
    "submit 200": (r) => r.status === 200,
  });
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}
