# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev       # Next.js dev server (http://localhost:3000)
npm run build     # production build
npm run start     # run built app
npm run lint      # eslint (flat config, next core-web-vitals + typescript)
```

No test runner is configured yet (Vitest/Playwright appear only in `docs/MASTER_PLAN.md` as M4+ goals). Verification is manual — walk through the UI and check the Supabase dashboard.

### One-off scripts

All scripts read env from `.env.local` via `node --env-file=`:

```powershell
# Grant admin role to a Supabase auth.users UUID
node --env-file=.env.local scripts/bootstrap-admin.mjs <UUID> [email] [name] [org]

# Seed a sample exam
node --env-file=.env.local scripts/seed-exam-blue-1.mjs

# Attachment maintenance
node --env-file=.env.local scripts/upload-attachments.mjs
node --env-file=.env.local scripts/replace-attachments-with-zip.mjs
node --env-file=.env.local scripts/add-practice-slug.mjs
```

### Database migrations

Migrations under `supabase/migrations/` are **applied manually** by pasting into the Supabase SQL Editor (dev project first, then prod). There is no `supabase db push` workflow wired up. When a migration adds/renames columns, also update `lib/supabase/database.types.ts` (see below).

## Architecture

### Stack quirks

- **Next.js 16 App Router + React 19 + Tailwind v4 + TypeScript strict**. `@/*` maps to repo root (no `src/`).
- **Middleware lives in `proxy.ts`, not `middleware.ts`.** This is the Next.js 16 rename of the middleware hook — do NOT rename it back. The exported function is `proxy` and the `config.matcher` skips `_next/static`, images, favicons. Its sole job is `updateSession(request)` which refreshes the Supabase auth cookie so downstream server components see a fresh session.
- Global font (Pretendard variable, JetBrains Mono) is loaded from a CDN in `app/layout.tsx` — not via `next/font`.

### Supabase clients (two variants, don't mix them)

`lib/supabase/server.ts` exports two factories:

- `createServerSupabase()` — reads the user's auth cookie, applies **RLS**. Use in server components / route handlers whenever the caller is an authenticated staff user and RLS should filter results.
- `createAdminSupabase()` — service-role key, **bypasses RLS**. Use for admin bulk work, cron-like operations, applicant-session flows (where the caller is not a Supabase auth user), and anywhere RLS gets in the way. **Never import this from client code.**

Both are typed loosely (no `Database` generic on the clients) because the manual types don't fully satisfy `@supabase/supabase-js`'s expected shape. Cast query results at the call site rather than fighting the type system.

`lib/supabase/database.types.ts` is **hand-maintained** and lists the migrations it currently reflects at the top. When you add/modify columns, either update this file to match or use `as unknown as ...` casts locally — do not add `any`.

### Two authentication realms

There are two totally separate auth systems in this codebase:

1. **Staff (admin / examiner / grader)** — Supabase Auth (email/password). `lib/auth.ts` exposes `getUser()`, `requireAuth()`, `requireRole(role | role[])`. Roles come from the `user_roles` table (queried with the admin client because the table has no SELECT policy). Guards live in server components (`app/admin/layout.tsx`, `app/examiner/**/page.tsx`) — no route middleware for role checks.

2. **Applicants** — NOT Supabase Auth users. They enter through `/exam/{slug}` with their roster name and the last four digits of their phone number. `POST /api/exam/enter` matches `exam_invitations` and `lib/exam/session-cookie.ts` issues an HMAC-signed cookie `kbrain_exam_session` (`<sessionId>.<hmac>`, 6h TTL, `EXAM_SESSION_SECRET`). Every applicant-facing API route (`app/api/exam/**`, `app/api/precheck`) must:
   - `verifySessionCookieValue(cookies.get(SESSION_COOKIE_NAME)?.value)` → gets `cookieSessionId` or null
   - Reject if the request body's `sessionId` doesn't equal `cookieSessionId` (403 "session mismatch")

   This mirrors the pattern in `app/api/exam/session/start/route.ts` and `app/api/exam/answers/save/route.ts` — copy it for new applicant endpoints.

### Domain model & invariants

Read `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` for full context. The invariants that will bite you if ignored:

- **All questions are `work_based` (slot-based).** No auto-grading anywhere. Slot types: `text | long_text | url | file | number`. There is no `correct_answer` / `options` column — never introduce one.
- **`rubric` (grading criteria) is server-only.** Applicant role can only select from the `questions_for_applicant` **view**, which omits `rubric`. Don't expose the `questions` table directly to applicant queries. Applicant pages must fetch via server components using the admin client (or the view).
- **Set-level proctoring toggle.** `question_sets.proctoring_disabled=true` unmounts `ProctorGuard` and the event batcher for that set, but keeps Agora + recording running. Never remove this flag.
- **Score display is always `toPercentage(raw, max)`** from `lib/utils.ts`. DB stores raw scores; every UI/CSV/export must round-trip through this helper.
- **Timer is defended 3 ways.** Client `useExamTimer` re-computes from `Date.now()` on `visibilitychange`/`focus`/`online`; a pg_cron function `auto_submit_expired_sessions()` finalises expired rows every minute; and `exam_date` is an absolute wall-clock start so all applicants share a deadline. The client checks `session.time_extension_minutes` too — server AND client must use the extended duration.
- **`auto_submitted` semantics.** `true` = timer expiry auto-submit. `false` = examiner force-submit (reason logged into `monitoring_notes` as `[force_submit] <reason>`). Zip export uses this to isolate auto-submitted sessions in their own folder.

### Practice / real-exam share one component

`app/practice/[slug]/practice-runner.tsx` (`PracticeRunner`) is a 4-step wizard (env check → pledge → waiting → exam). The real-exam page `app/exam/session/[id]/take/page.tsx` reuses it by passing `sessionId`. Behaviour flip based on `sessionId`:

- `sessionId != null` → `useSavePrecheck` posts step results to `/api/precheck` (server saves onto `exam_sessions`); file-slot uploads persist.
- `sessionId == null` (Practice) → no server writes; file-slot UI shows a "저장되지 않음" notice.

The webcam and screen-share `MediaStream`s are acquired in Step 1 and **kept alive by the parent component** across all four steps — do not re-acquire them per step (users would see repeated permission prompts).

### Storage buckets & attachment routing

Three private buckets served through Next route handlers that enforce auth:

| Bucket | Serving route | Auth |
|---|---|---|
| `exam-attachments` | `app/api/attachments/[...path]/route.ts` | logged-in staff · practice slug · applicant session cookie (path must match session's exam) |
| `answer-files` | `app/api/exam/answer-files/[...path]/route.ts` | admin/examiner · applicant session cookie (path's sessionId must match cookie) |
| `identity-documents` | `app/api/exam/identity/image/route.ts` | admin/examiner only |

Applicant uploads (`app/api/exam/answers/upload`, `app/api/exam/identity/upload`) use FormData with the session-cookie check pattern above.

### Milestone status (as of 2026-07-16)

`docs/MASTER_PLAN.md` is the source of truth. M0–M3.7 are done; **M4 (Agora + Cloudflare R2 recording), M5 (grading UI, answer export/import), M6 (load tests) are not yet built.** Applicant email/OTP and Resend invitation code were removed on 2026-07-20; do not restore them unless explicitly requested.
