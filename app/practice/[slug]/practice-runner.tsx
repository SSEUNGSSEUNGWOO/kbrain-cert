"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AttachmentViewer, type Attachment } from "@/components/attachment-viewer";
import { EnvCheck, type EnvResultSnapshot } from "@/components/env-check";
import { SecurityPledge } from "@/components/security-pledge";
import { WaitingRoom } from "@/components/waiting-room";
import { useSavePrecheck } from "@/lib/hooks/use-save-precheck";
import { useAutoSaveAnswer } from "@/lib/hooks/use-auto-save-answer";
import { useExamTimer, formatHms } from "@/lib/hooks/use-exam-timer";
import { useMonitorEvents } from "@/lib/hooks/use-monitor-events";
import { useExamSessionLive } from "@/lib/hooks/use-exam-session-live";
import { ProctorGuard } from "@/components/proctor-guard";
import { ExamChat } from "@/components/exam-chat";
import { cn } from "@/lib/utils";
import { AgoraWebcamPublisher } from "@/components/agora-webcam-publisher";
import { AgoraScreenPublisher } from "@/components/agora-screen-publisher";
import { createClientSupabase } from "@/lib/supabase/client";

type Slot = {
  id: string;
  type: "text" | "long_text" | "url" | "file" | "number";
  label: string;
  max_score: number;
  accept?: string;
};

type Question = {
  id: string;
  code: string;
  content: string;
  submission_slots: Slot[];
  max_score: number;
  set_id: string;
  set_order: number;
  tags: string[];
  difficulty: string | null;
};

type Set = {
  id: string;
  title: string;
  scenario: string | null;
  attachments: Attachment[];
};

type Tab = "env" | "pledge" | "waiting" | "exam";

export function PracticeRunner({
  slug,
  exam,
  sets: initialSets,
  questions: initialQuestions,
  sessionId,
  initialIdentityPath = null,
  initialAnswers = {},
  skipToExam = false,
}: {
  slug: string;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
    /** 실 시험 예약 시각 · 실 시험이면 이 시각을 기준으로 카운트다운·자동 제출 */
    examDate?: string | null;
    allowNoWebcam?: boolean;
    allowNoScreenShare?: boolean;
    allowDualMonitor?: boolean;
  };
  sets: Set[];
  questions: Question[];
  /** 실 시험 세션 id · Practice에서는 null · 있으면 precheck 결과 서버 저장 */
  sessionId?: string | null;
  /** 재접속 시 DB에서 복원한 신분증 이미지 경로 */
  initialIdentityPath?: string | null;
  /** 재접속 시 DB에서 복원한 문항별 답안 */
  initialAnswers?: Record<string, Record<string, unknown>>;
  /** Practice ?skip=1 · 환경체크/서약/대기실 건너뛰고 시험창부터 (미리보기용) */
  skipToExam?: boolean;
}) {
  const savePrecheck = useSavePrecheck(sessionId);
  const [tab, setTab] = useState<Tab>(skipToExam ? "exam" : "env");
  const [envPassed, setEnvPassed] = useState(skipToExam);
  const [pledgePassed, setPledgePassed] = useState(skipToExam);
  const [waitingReady, setWaitingReady] = useState(skipToExam);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sets, setSets] = useState(initialSets);
  const [questions, setQuestions] = useState(initialQuestions);
  const [contentBusy, setContentBusy] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [answers, setAnswers] =
    useState<Record<string, Record<string, unknown>>>(initialAnswers);

  // 웹캠 · 화면 공유 스트림 · 환경 체크에서 획득 → 페이지 unmount까지 유지
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    webcamStreamRef.current = webcamStream;
  }, [webcamStream]);
  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);
  useEffect(() => {
    return () => {
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const currentQ = questions[currentIdx];
  const currentSet = sets.find((s) => s.id === currentQ?.set_id);
  const currentAnswer = currentQ ? answers[currentQ.id] ?? {} : {};

  // 답안 auto-save · sessionId 없으면 no-op (Practice)
  const { flushCurrent, prepareSubmit } = useAutoSaveAnswer(
    sessionId,
    currentQ?.id,
    currentAnswer
  );

  const [submitting, setSubmitting] = useState(false);
  const [activeUploads, setActiveUploads] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverStartTime, setServerStartTime] = useState<string | null>(null);

  const isRealExam = sessionId != null;

  // exam 탭 진입 시 시작 시각 서버에서 확정 (실 시험만)
  useEffect(() => {
    if (tab !== "exam" || !isRealExam || !sessionId || serverStartTime) return;
    void fetch("/api/exam/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.startTime) setServerStartTime(data.startTime);
      })
      .catch(() => {});
  }, [tab, isRealExam, sessionId, serverStartTime]);

  // Practice는 로컬 시간 기준 · exam 탭 진입 시각으로 폴백
  const [practiceStartTime, setPracticeStartTime] = useState<string | null>(null);
  const enterExam = async () => {
    if (!isRealExam && !practiceStartTime) {
      setPracticeStartTime(new Date().toISOString());
    }
    if (isRealExam && questions.length === 0) {
      if (contentBusy) return;
      setContentBusy(true);
      setContentError(null);
      try {
        const response = await fetch("/api/exam/content", {
          cache: "no-store",
        });
        const content = await response.json();
        if (!response.ok) {
          throw new Error(content.error ?? "시험 문제를 불러오지 못했습니다.");
        }
        setSets(content.sets ?? []);
        setQuestions(content.questions ?? []);
      } catch (error) {
        setContentError(
          error instanceof Error
            ? error.message
            : "시험 문제를 불러오지 못했습니다."
        );
        return;
      } finally {
        setContentBusy(false);
      }
    }
    setTab("exam");
  };

  // 감독 이벤트 batch 저장 (실 시험만 · Practice는 no-op)
  const { fire: fireMonitorEvent } = useMonitorEvents(sessionId);

  // 세션 라이브: 시간 연장 · 강제 종료 감지 · 채팅 메시지 (타이머 전에 선언 · 아래에서 참조)
  const {
    live: sessionLive,
    markRead: markChatRead,
    addMessage: addChatMessage,
  } = useExamSessionLive(sessionId);

  // 감독관이 강제 종료했으면 done 페이지로 이동
  useEffect(() => {
    if (sessionLive.isSubmitted && sessionId && tab === "exam") {
      window.location.href = `/exam/session/${sessionId}/done`;
    }
  }, [sessionLive.isSubmitted, sessionId, tab]);

  // 타이머 기준 시각
  // - 실 시험 + exam_date 있음 → exam_date 기준 (모든 응시자 동시 종료)
  // - 실 시험 + exam_date 없음 → 개인 진입 시각 폴백 (start_time)
  // - Practice → 개인 로컬 진입 시각
  const effectiveStartTime =
    isRealExam
      ? exam.examDate ?? serverStartTime
      : practiceStartTime;
  const effectiveDurationMinutes =
    exam.durationMinutes + (isRealExam ? sessionLive.timeExtensionMinutes : 0);
  const timer = useExamTimer(effectiveStartTime, effectiveDurationMinutes);

  // 타이머 만료 시 자동 제출 (실 시험만 · 1회 발화)
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (
      timer.expired &&
      isRealExam &&
      !submitting &&
      !autoSubmittedRef.current
    ) {
      autoSubmittedRef.current = true;
      void doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.expired, isRealExam, submitting]);
  const answeredQuestionIds = useMemo(
    () =>
      new Set(
        Object.entries(answers)
          .filter(([, values]) => Object.values(values).some(hasAnswerValue))
          .map(([questionId]) => questionId)
      ),
    [answers]
  );
  const answeredCount = answeredQuestionIds.size;

  async function doSubmit(auto = false) {
    if (!sessionId) return;
    if (!auto && activeUploads > 0) {
      setSubmitError("파일 업로드가 끝난 뒤 제출해 주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await prepareSubmit();
      const res = await fetch("/api/exam/session/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          auto,
          answers: Object.entries(answers).map(
            ([questionId, slotValues]) => ({ questionId, slotValues })
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "제출 실패");
      window.location.href = `/exam/session/${sessionId}/done`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "제출 실패");
      setSubmitting(false);
    }
  }

  async function moveToQuestion(index: number) {
    if (index === currentIdx || index < 0 || index >= questions.length) return;
    const saved = await flushCurrent();
    if (!saved) {
      setSubmitError(
        "현재 문항을 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 이동해 주세요."
      );
      return;
    }
    setSubmitError(null);
    setCurrentIdx(index);
  }
  const questionsBySet = useMemo(() => {
    const map: Record<string, Question[]> = {};
    for (const q of questions) {
      if (!map[q.set_id]) map[q.set_id] = [];
      map[q.set_id].push(q);
    }
    return map;
  }, [questions]);

  const setIndex = sets.findIndex((s) => s.id === currentQ?.set_id);
  const questionIndexInSet =
    questionsBySet[currentQ?.set_id]?.findIndex((q) => q.id === currentQ.id) ??
    -1;

  const showTimer = tab === "exam";
  const proctorActive = tab === "exam" && isRealExam;
  const webcamRequired = isRealExam && !exam.allowNoWebcam;
  const screenRequired = isRealExam && !exam.allowNoScreenShare;
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [recoveryCameraId, setRecoveryCameraId] = useState("");
  const [webcamRecoveryBusy, setWebcamRecoveryBusy] = useState(false);
  const [screenRecoveryBusy, setScreenRecoveryBusy] = useState(false);
  useEffect(() => {
    if (!proctorActive || !webcamRequired || webcamStream) return;
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cameras = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(cameras);
      setRecoveryCameraId((current) => current || cameras[0]?.deviceId || "");
    });
  }, [proctorActive, webcamRequired, webcamStream]);
  const recoverWebcam = useCallback(async () => {
    setWebcamRecoveryBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          frameRate: 10,
          ...(recoveryCameraId
            ? { deviceId: { exact: recoveryCameraId } }
            : {}),
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      track.onended = () => setWebcamStream(null);
      setWebcamStream(stream);
      setSubmitError(null);
      fireMonitorEvent({
        eventType: "webcam_recovered",
        severity: "info",
      });
    } catch {
      setSubmitError("웹캠을 다시 연결해야 시험을 계속할 수 있습니다.");
    } finally {
      setWebcamRecoveryBusy(false);
    }
  }, [fireMonitorEvent, recoveryCameraId]);
  const recoverScreenShare = useCallback(async () => {
    setScreenRecoveryBusy(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
      } as DisplayMediaStreamOptions);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings() as MediaTrackSettings & {
        displaySurface?: string;
      };
      if (settings.displaySurface && settings.displaySurface !== "monitor") {
        stream.getTracks().forEach((streamTrack) => streamTrack.stop());
        setSubmitError("반드시 '전체 화면'을 선택해 주세요.");
        return;
      }
      track.onended = () => setScreenStream(null);
      setScreenStream(stream);
      setSubmitError(null);
      fireMonitorEvent({
        eventType: "screen_share_recovered",
        severity: "info",
      });
    } catch {
      setSubmitError("화면 공유를 다시 시작해야 시험을 계속할 수 있습니다.");
    } finally {
      setScreenRecoveryBusy(false);
    }
  }, [fireMonitorEvent]);
  const reportWebcamFailure = useCallback(
    () => fireMonitorEvent({ eventType: "webcam_publish_failed", severity: "high" }),
    [fireMonitorEvent]
  );
  const reportScreenFailure = useCallback(
    () => fireMonitorEvent({ eventType: "screen_publish_failed", severity: "high" }),
    [fireMonitorEvent]
  );
  useEffect(() => {
    if (!proctorActive) return;
    const webcamTrack = webcamStream?.getVideoTracks()[0];
    const screenTrack = screenStream?.getVideoTracks()[0];
    const onWebcamEnded = () =>
      fireMonitorEvent({ eventType: "webcam_stopped", severity: "high" });
    const onScreenEnded = () =>
      fireMonitorEvent({ eventType: "screen_share_stopped", severity: "high" });
    webcamTrack?.addEventListener("ended", onWebcamEnded);
    screenTrack?.addEventListener("ended", onScreenEnded);
    return () => {
      webcamTrack?.removeEventListener("ended", onWebcamEnded);
      screenTrack?.removeEventListener("ended", onScreenEnded);
    };
  }, [fireMonitorEvent, proctorActive, screenStream, webcamStream]);

  return (
    <div className="min-h-screen flex flex-col">
      <ProctorGuard
        active={proctorActive}
        onEvent={fireMonitorEvent}
      />
      <TopBar
        exam={exam}
        slug={slug}
        timer={showTimer ? timer : null}
        isRealExam={isRealExam}
      />
      <AgoraWebcamPublisher
        sessionId={sessionId ?? null}
        webcamStream={webcamStream}
        active={proctorActive && webcamRequired}
        onFailure={reportWebcamFailure}
      />
      <AgoraScreenPublisher
        sessionId={sessionId ?? null}
        screenStream={screenStream}
        active={proctorActive && screenRequired}
        onFailure={reportScreenFailure}
      />

      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
          {tab === "exam" ? (
            <div className="flex h-14 w-full items-center justify-between">
              <div>
                <div className="text-sm font-bold text-primary">시험 진행 중</div>
                <div className="text-[10px] text-muted-foreground">
                  이전 단계로 돌아갈 수 없습니다
                </div>
              </div>
              <div className="text-xs font-bold text-muted-foreground">
                {questions.length}문항 · {sets.length}세트
              </div>
            </div>
          ) : (
            <>
              <TabButton
                active={tab === "env"}
                onClick={() => setTab("env")}
                label="1. 환경 체크"
                hint="6개 항목 자동 검사"
                done={envPassed}
              />
              <TabButton
                active={tab === "pledge"}
                onClick={() => envPassed && setTab("pledge")}
                label="2. 보안 서약"
                hint={envPassed ? "6개 유의사항 동의" : "환경 체크 후 이용"}
                done={pledgePassed}
                disabled={!envPassed}
              />
              <TabButton
                active={tab === "waiting"}
                onClick={() => pledgePassed && setTab("waiting")}
                label="3. 대기실"
                hint={pledgePassed ? "시험 시작 대기" : "서약 완료 후 이용"}
                done={waitingReady}
                disabled={!pledgePassed}
              />
              <TabButton
                active={false}
                onClick={() => waitingReady && enterExam()}
                label="4. 시험창"
                hint={waitingReady ? "입장 준비 완료" : "대기실에서 입장"}
                disabled={!waitingReady}
              />
            </>
          )}
        </div>
      </div>

      {tab === "env" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <EnvCheck
            webcamStream={webcamStream}
            setWebcamStream={setWebcamStream}
            screenStream={screenStream}
            setScreenStream={setScreenStream}
            allowNoWebcam={isRealExam && exam.allowNoWebcam}
            allowNoScreenShare={isRealExam && exam.allowNoScreenShare}
            allowDualMonitor={isRealExam && exam.allowDualMonitor}
            onEnterExam={(snapshot: EnvResultSnapshot) => {
              void savePrecheck("env", {
                envResult: snapshot,
                userAgent:
                  typeof navigator !== "undefined" ? navigator.userAgent : "",
              });
              setEnvPassed(true);
              setTab("pledge");
            }}
          />
        </div>
      )}

      {tab === "pledge" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <SecurityPledge
            onProceed={() => {
              void savePrecheck("pledge");
              setPledgePassed(true);
              setTab("waiting");
            }}
          />
        </div>
      )}

      {tab === "waiting" && (
        <div className="flex-1 mx-auto max-w-3xl w-full px-6 py-6">
          <WaitingRoom
            exam={exam}
            isPractice={sessionId == null}
            scheduledAt={
              isRealExam && exam.examDate ? new Date(exam.examDate) : undefined
            }
            sessionId={sessionId ?? null}
            initialIdentityPath={initialIdentityPath}
            onEnter={() => {
              void savePrecheck("waiting");
              setWaitingReady(true);
              void enterExam();
            }}
          />
          {contentError && (
            <div className="mt-4 rounded-md border border-danger bg-danger-soft p-4 text-center text-xs font-bold text-danger">
              {contentError} · 잠시 후 다시 시도해 주세요.
            </div>
          )}
        </div>
      )}

      {tab === "exam" && (
      <div className="flex-1 mx-auto max-w-7xl w-full px-6 py-6 flex gap-6">
        {/* 감시 스트림 상시 표시 · 우측 하단 · 감독관 감시 중임을 시각화 */}
        <MonitoringBadge
          webcamStream={webcamStream}
          screenActive={!!screenStream}
          webcamExempt={!webcamRequired}
          screenExempt={!screenRequired}
        />

        {/* 실 시험: 감독관 채팅 · Practice에서는 표시 X */}
        {isRealExam && (
          <ExamChat
            messages={sessionLive.messages}
            unreadCount={sessionLive.unreadCount}
            isSubmitted={sessionLive.isSubmitted}
            onOpen={markChatRead}
            onMessageSent={addChatMessage}
          />
        )}

        {/* 시간 연장 공지 */}
        {isRealExam && sessionLive.timeExtensionMinutes > 0 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-md bg-success text-white px-4 py-2 shadow-lg text-xs font-bold">
            ⏱ 감독관이 시험 시간을 +{sessionLive.timeExtensionMinutes}분 연장했습니다
          </div>
        )}

        {/* 좌측 문항 그리드 */}
        <QuestionRail
          sets={sets}
          questionsBySet={questionsBySet}
          questions={questions}
          currentQuestionId={currentQ?.id}
          answeredQuestionIds={answeredQuestionIds}
          onSelect={(qId) => {
            const i = questions.findIndex((q) => q.id === qId);
            if (i >= 0) void moveToQuestion(i);
          }}
        />

        {/* 중앙 문항 */}
        <main className="flex-1 min-w-0 space-y-6">
          {currentSet && (
            <SetHeader
              setIndex={setIndex}
              set={currentSet}
              questionIndexInSet={questionIndexInSet}
              totalInSet={questionsBySet[currentSet.id]?.length ?? 0}
              slug={slug}
            />
          )}

          {currentQ && (
            <QuestionCard
              question={currentQ}
              answer={answers[currentQ.id] ?? {}}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [currentQ.id]: v }))
              }
              sessionId={sessionId ?? null}
              onUploadStateChange={(busy) =>
                setActiveUploads((count) => Math.max(0, count + (busy ? 1 : -1)))
              }
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => void moveToQuestion(currentIdx - 1)}
              disabled={currentIdx === 0}
              className="h-11 px-5 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← 이전 문항
            </button>
            <div className="text-xs text-muted-foreground font-tabular">
              {currentIdx + 1} / {questions.length}
            </div>
            {currentIdx === questions.length - 1 && isRealExam ? (
              <button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting || activeUploads > 0}
                className="h-11 px-5 rounded-md bg-success hover:opacity-90 text-white text-sm font-bold disabled:opacity-40 transition"
              >
                시험 제출하기 →
              </button>
            ) : (
              <button
                onClick={() => void moveToQuestion(currentIdx + 1)}
                disabled={currentIdx === questions.length - 1}
                className="h-11 px-5 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                다음 문항 →
              </button>
            )}
          </div>
        </main>
      </div>
      )}

      {proctorActive && screenRequired && !screenStream?.getVideoTracks()[0]?.readyState.includes("live") && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-6">
          <div className="w-full max-w-md rounded-md bg-white p-8 text-center shadow-2xl">
            <div className="mb-4 text-4xl">⚠</div>
            <h2 className="mb-2">화면 공유가 중단되었습니다</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              시험 시간은 계속 흐릅니다. 전체 화면 공유를 다시 시작해야 답안을
              계속 작성할 수 있습니다.
            </p>
            <button
              type="button"
              disabled={screenRecoveryBusy}
              onClick={() => void recoverScreenShare()}
              className="h-12 w-full rounded-md bg-primary font-bold text-white disabled:opacity-50"
            >
              {screenRecoveryBusy ? "화면 공유 요청 중…" : "전체 화면 다시 공유"}
            </button>
          </div>
        </div>
      )}

      {proctorActive &&
        webcamRequired &&
        webcamStream?.getVideoTracks()[0]?.readyState !== "live" && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-950/95 p-6">
            <div className="w-full max-w-md rounded-md bg-white p-8 text-center shadow-2xl">
              <div className="mb-4 text-4xl">📷</div>
              <h2 className="mb-2">웹캠 연결이 중단되었습니다</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                시험 시간은 계속 흐릅니다. 사용할 웹캠을 선택하고 다시
                연결해 주세요.
              </p>
              {cameraDevices.length > 0 && (
                <select
                  value={recoveryCameraId}
                  onChange={(event) =>
                    setRecoveryCameraId(event.target.value)
                  }
                  className="mb-3 h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
                  aria-label="복구할 웹캠"
                >
                  {cameraDevices.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `카메라 ${index + 1}`}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={webcamRecoveryBusy}
                onClick={() => void recoverWebcam()}
                className="h-12 w-full rounded-md bg-primary font-bold text-white disabled:opacity-50"
              >
                {webcamRecoveryBusy ? "웹캠 연결 중…" : "선택한 웹캠 다시 연결"}
              </button>
            </div>
          </div>
        )}

      {confirmSubmit && isRealExam && (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          totalCount={questions.length}
          submitting={submitting}
          error={submitError}
          onCancel={() => {
            setConfirmSubmit(false);
            setSubmitError(null);
          }}
          onConfirm={() => doSubmit(false)}
        />
      )}
    </div>
  );
}

function SubmitConfirmDialog({
  answeredCount,
  totalCount,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  answeredCount: number;
  totalCount: number;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const unanswered = totalCount - answeredCount;
  const [unansweredConfirmed, setUnansweredConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-bold text-base">시험을 제출하시겠습니까?</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-md bg-surface-soft p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">답변 완료</span>
              <span className="font-bold font-tabular">
                {answeredCount} / {totalCount}
              </span>
            </div>
            {unanswered > 0 && (
              <div className="text-xs text-warning font-bold">
                ⚠ {unanswered}개 문항이 미답변 상태입니다
              </div>
            )}
          </div>
          {unanswered > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-warning bg-warning-soft p-4 text-sm">
              <input
                type="checkbox"
                checked={unansweredConfirmed}
                onChange={(event) =>
                  setUnansweredConfirmed(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="font-bold leading-relaxed">
                미응답 {unanswered}개 문항이 남아 있음을 확인했으며, 그대로
                제출하겠습니다.
              </span>
            </label>
          )}
          <div className="text-xs text-muted-foreground leading-relaxed">
            제출 후에는 답안을 수정할 수 없습니다. 시험이 종료되며 응시가 완료됩니다.
          </div>
          {error && (
            <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 h-11 rounded-md bg-white border border-border text-sm font-bold hover:border-primary disabled:opacity-50 transition"
            >
              계속 응시
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting || (unanswered > 0 && !unansweredConfirmed)}
              className="flex-1 h-11 rounded-md bg-success hover:opacity-90 text-white text-sm font-bold disabled:opacity-50 transition"
            >
              {submitting ? "제출 중…" : "제출하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────── 감시 스트림 상시 표시 (시험창) ────── */

function MonitoringBadge({
  webcamStream,
  screenActive,
  webcamExempt,
  screenExempt,
}: {
  webcamStream: MediaStream | null;
  screenActive: boolean;
  webcamExempt: boolean;
  screenExempt: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);
  return (
    <div className="fixed bottom-6 right-6 z-40 rounded-md bg-white border border-border shadow-lg overflow-hidden w-48">
      <div className="px-3 py-2 border-b border-border bg-surface-soft flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-[10px] font-bold tracking-widest text-danger uppercase">
          감시 중
        </span>
      </div>
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full aspect-video bg-black object-cover"
      />
      <div className="px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              webcamExempt || webcamStream ? "bg-success" : "bg-danger"
            )}
          />
          웹캠{webcamExempt ? " 면제" : ""}
        </span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              screenExempt || screenActive ? "bg-success" : "bg-danger"
            )}
          />
          화면{screenExempt ? " 면제" : ""}
        </span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  hint,
  done,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  done?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-5 py-3 border-b-2 transition text-left",
        active && !disabled && "border-primary text-primary",
        !active &&
          !disabled &&
          "border-transparent text-muted-foreground hover:text-foreground",
        disabled && "border-transparent text-muted cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "text-sm font-bold",
            active && !disabled && "text-primary",
            disabled && "text-muted"
          )}
        >
          {label}
        </div>
        {done && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-success text-white text-[9px] font-bold">
            ✓
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </button>
  );
}

/* ────── Top bar ────── */

function TopBar({
  exam,
  slug,
  timer,
  isRealExam,
}: {
  exam: {
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
  };
  slug: string;
  timer: { remainingMs: number; totalMs: number; expired: boolean } | null;
  isRealExam: boolean;
}) {
  const minutes = timer ? timer.remainingMs / 60000 : Number.POSITIVE_INFINITY;
  const dangerZone = minutes < 3;
  const warnZone = !dangerZone && minutes < 10;
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
        </Link>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[10px] font-bold tracking-widest uppercase mb-0.5",
              isRealExam ? "text-danger" : "text-info"
            )}
          >
            {isRealExam ? "REAL · 실 응시" : "Practice · 테스트 링크"}
          </div>
          <div className="font-bold text-sm truncate">{exam.title}</div>
        </div>
        {timer && (
          <div
            className={cn(
              "text-right leading-tight px-3 py-1.5 rounded-md",
              dangerZone && "bg-danger-soft animate-pulse",
              warnZone && "bg-warning-soft",
              !dangerZone && !warnZone && "bg-info-soft"
            )}
          >
            <div
              className={cn(
                "text-[10px] font-bold tracking-widest uppercase",
                dangerZone
                  ? "text-danger"
                  : warnZone
                  ? "text-warning"
                  : "text-info"
              )}
            >
              {timer.expired ? "시간 종료" : "남은 시간"}
            </div>
            <div
              className={cn(
                "font-tabular tabular-nums text-lg font-bold",
                dangerZone
                  ? "text-danger"
                  : warnZone
                  ? "text-warning"
                  : "text-info"
              )}
            >
              {formatHms(timer.remainingMs)}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {exam.grade && (
            <span className="hidden md:inline-flex text-[10px] font-bold text-primary bg-primary-soft px-2 py-1 rounded-sm">
              {exam.grade}
            </span>
          )}
          <span className="hidden md:inline-flex text-[10px] font-bold text-muted-foreground bg-surface-soft px-2 py-1 rounded-sm">
            {exam.durationMinutes}분
          </span>
          {!isRealExam && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-info bg-info-soft px-2.5 py-1 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              답안 저장 X
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ────── 좌측 문항 그리드 ────── */

function QuestionRail({
  sets,
  questionsBySet,
  questions,
  currentQuestionId,
  answeredQuestionIds,
  onSelect,
}: {
  sets: Set[];
  questionsBySet: Record<string, Question[]>;
  questions: Question[];
  currentQuestionId: string | undefined;
  answeredQuestionIds: globalThis.Set<string>;
  onSelect: (qId: string) => void;
}) {
  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-24 rounded-md bg-white border border-border p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10px] font-bold tracking-[0.25em] text-muted uppercase">
            문항 · 총 {questions.length}
          </div>
        </div>

        <div className="space-y-4">
          {sets.map((set, si) => {
            const qs = questionsBySet[set.id] ?? [];
            return (
              <div key={set.id}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-tabular text-xs font-bold text-primary tabular-nums">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <div className="text-[11px] font-bold text-foreground truncate">
                    {set.title}
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {qs.map((q, qi) => {
                    const isCurrent = q.id === currentQuestionId;
                    const isAnswered = answeredQuestionIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => onSelect(q.id)}
                        title={`${q.code} · ${
                          isAnswered ? "응답 완료" : "미응답"
                        }`}
                        aria-label={`${qi + 1}번 문항 · ${
                          isAnswered ? "응답 완료" : "미응답"
                        }`}
                        className={cn(
                          "aspect-square rounded-sm text-[11px] font-bold tabular-nums transition",
                          isAnswered
                            ? "bg-success text-white hover:brightness-95"
                            : "bg-surface-soft text-muted-foreground hover:bg-subtle",
                          isCurrent && "ring-2 ring-primary ring-offset-1"
                        )}
                      >
                        {qi + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
          <div className="font-bold text-foreground mb-1">테스트 링크</div>
          여러 번 접속 · 답 저장 X · 첨부는 다운로드 가능
        </div>
      </div>
    </aside>
  );
}

function hasAnswerValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (!value || typeof value !== "object") return false;
  return "path" in value && typeof value.path === "string" && value.path.length > 0;
}

/* ────── Set 헤더 (시나리오 + 첨부) ────── */

function SetHeader({
  setIndex,
  set,
  questionIndexInSet,
  totalInSet,
  slug,
}: {
  setIndex: number;
  set: Set;
  questionIndexInSet: number;
  totalInSet: number;
  slug: string;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      {/* Set 정보 헤더 */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary-soft/60 to-white flex items-center gap-4">
        <div className="w-12 h-12 rounded-md bg-white border-2 border-primary text-primary flex items-center justify-center font-bold text-lg font-tabular shrink-0">
          {String(setIndex + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
            Set {setIndex + 1}
          </div>
          <div className="font-bold text-base truncate">{set.title}</div>
          <div className="text-[11px] text-muted-foreground font-tabular mt-0.5">
            현재 문항 {questionIndexInSet + 1} / {totalInSet} · 첨부{" "}
            {set.attachments.length}개
          </div>
        </div>
      </div>

      {/* 시나리오 · 눈에 잘 띄게 강조 */}
      {set.scenario && (
        <div className="border-l-4 border-warning bg-warning-soft/40 px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-warning text-white flex items-center justify-center text-sm font-bold">
              ⚑
            </div>
            <div className="text-[11px] font-bold tracking-widest text-warning uppercase">
              시나리오 · Scenario
            </div>
          </div>
          <div className="text-[15px] text-foreground whitespace-pre-line leading-[1.8] pl-9">
            {set.scenario}
          </div>
        </div>
      )}

      {/* 첨부 자료 */}
      {set.attachments.length > 0 && (
        <div className="p-4 border-t border-border">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
            첨부 자료
          </div>
          <AttachmentViewer
            attachments={set.attachments}
            practiceSlug={slug}
          />
        </div>
      )}
    </div>
  );
}

/* ────── 문항 카드 ────── */

function QuestionCard({
  question,
  answer,
  onChange,
  sessionId,
  onUploadStateChange,
}: {
  question: Question;
  answer: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sessionId: string | null;
  onUploadStateChange: (busy: boolean) => void;
}) {
  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      {/* 큰 문항 헤더 */}
      <div className="px-8 py-5 border-b border-border bg-gradient-to-r from-primary-soft to-white flex items-center gap-4">
        <div className="w-14 h-14 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xl font-tabular shrink-0 shadow-sm">
          {String(question.set_order).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
            Question · 문제
          </div>
          <div className="font-bold text-lg text-foreground">
            문항 {question.set_order}
          </div>
        </div>
      </div>

      {/* 문제 본문 · 읽기 편한 폭 · 큰 폰트 · 넓은 줄간격 */}
      <div className="px-8 py-8">
        <QuestionBody content={question.content} />
      </div>

      {/* 답안 섹션 · 시각적 구분 */}
      <div className="px-8 py-6 border-t-2 border-dashed border-border bg-surface-soft/50">
        <div className="mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-success text-white flex items-center justify-center font-bold text-sm">
            ✎
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-success uppercase mb-0.5">
              Answer · 답안 작성
            </div>
            <div className="text-xs text-muted-foreground">
              {question.submission_slots.length}개 항목
            </div>
          </div>
        </div>
        <SlotEditor
          slots={question.submission_slots}
          values={answer}
          onChange={onChange}
          sessionId={sessionId}
          questionId={question.id}
          onUploadStateChange={onUploadStateChange}
        />
      </div>
    </div>
  );
}

/**
 * 문제 본문 렌더러 · 가독성 최적화
 * - 문단(빈 줄로 구분) 감지 · 문단 간 공백
 * - 리스트(1./•/-) 자동 인식 · indent
 * - 코드/강조는 지금 텍스트만이라 스킵
 */
function QuestionBody({ content }: { content: string }) {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return (
    <article className="max-w-3xl mx-auto space-y-5 text-[17px] leading-[1.85] text-foreground">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) =>
          /^\s*(\d+\.|[-•·])\s+/.test(l.trim())
        );
        if (isList) {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {lines.map((line, j) => {
                const cleaned = line.replace(/^\s*(\d+\.|[-•·])\s+/, "");
                return (
                  <li key={j} className="flex gap-3">
                    <span className="text-primary font-bold shrink-0 min-w-[1.5rem]">
                      {(line.match(/^\s*(\d+\.|[-•·])/) ?? ["•"])[0].trim()}
                    </span>
                    <span className="flex-1">{cleaned}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </article>
  );
}

type AnswerFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt?: string;
};

function SlotEditor({
  slots,
  values,
  onChange,
  sessionId,
  questionId,
  onUploadStateChange,
}: {
  slots: Slot[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  sessionId: string | null;
  questionId: string;
  onUploadStateChange: (busy: boolean) => void;
}) {
  const setValue = (id: string, v: unknown) => {
    onChange({ ...values, [id]: v });
  };

  return (
    <div className="space-y-5">
      {!sessionId && (
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
          답안 (테스트 · 저장되지 않음)
        </div>
      )}
      {slots.map((slot, idx) => {
        const v = values[slot.id];
        return (
          <div key={slot.id}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-tabular text-xs font-bold text-primary tabular-nums">
                  {(idx + 1).toString().padStart(2, "0")}
                </span>
                <span className="font-bold text-sm">{slot.label}</span>
              </div>
            </div>
            {slot.type === "long_text" && (
              <textarea
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft resize-none font-tabular"
                placeholder="여기에 작성"
              />
            )}
            {slot.type === "text" && (
              <input
                type="text"
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="답 입력"
              />
            )}
            {slot.type === "number" && (
              <input
                type="number"
                value={(v as number | string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm font-tabular focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="정수"
              />
            )}
            {slot.type === "url" && (
              <input
                type="url"
                value={(v as string) ?? ""}
                onChange={(e) => setValue(slot.id, e.target.value)}
                className="w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm font-tabular focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="https://…"
              />
            )}
            {slot.type === "file" && (
              <FileSlot
                slot={slot}
                value={v as AnswerFile | null}
                onChange={(next) => setValue(slot.id, next)}
                sessionId={sessionId}
                questionId={questionId}
                onUploadStateChange={onUploadStateChange}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileSlot({
  slot,
  value,
  onChange,
  sessionId,
  questionId,
  onUploadStateChange,
}: {
  slot: Slot;
  value: AnswerFile | null;
  onChange: (v: AnswerFile | null) => void;
  sessionId: string | null;
  questionId: string;
  onUploadStateChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!sessionId) {
      setError("Practice에서는 파일 업로드가 저장되지 않습니다");
      return;
    }
    setBusy(true);
    onUploadStateChange(true);
    setError(null);
    let preparedPath: string | null = null;
    try {
      const metadata = {
        sessionId,
        questionId,
        slotId: slot.id,
        fileName: file.name,
        fileSize: file.size,
        mime: file.type || "application/octet-stream",
      };
      const prepare = await fetch("/api/exam/answers/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error ?? "업로드 준비 실패");
      preparedPath = prepared.path;
      const supabase = createClientSupabase();
      const { error: uploadError } = await supabase.storage
        .from("answer-files")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: metadata.mime,
        });
      if (uploadError) throw uploadError;
      const complete = await fetch("/api/exam/answers/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata, path: prepared.path }),
      });
      const completed = await complete.json();
      if (!complete.ok) {
        throw new Error(completed.error ?? "업로드 확인 실패");
      }
      onChange(completed.file);
    } catch (err) {
      if (preparedPath) {
        void fetch("/api/exam/answers/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId,
            slotId: slot.id,
            fileName: file.name,
            fileSize: file.size,
            mime: file.type || "application/octet-stream",
            path: preparedPath,
          }),
        });
      }
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setBusy(false);
      onUploadStateChange(false);
    }
  }

  if (value?.path) {
    const downloadUrl = `/api/exam/answer-files/${value.path}?download=${encodeURIComponent(value.name)}`;
    return (
      <div className="rounded-md border border-success bg-success-soft/30 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-success text-white flex items-center justify-center text-lg font-bold shrink-0">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{value.name}</div>
          <div className="text-[11px] text-muted-foreground font-tabular">
            {formatSize(value.size)} · 업로드 완료
          </div>
        </div>
        <a
          href={downloadUrl}
          className="h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-[11px] font-bold transition"
        >
          다운로드
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onUploadStateChange(true);
            void fetch("/api/exam/answers/upload", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                questionId,
                slotId: slot.id,
                fileName: value.name,
                fileSize: value.size,
                mime: value.mime,
                path: value.path,
              }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error ?? "삭제 실패");
                onChange(null);
              })
              .catch((deleteError) =>
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : "삭제 실패"
                )
              )
              .finally(() => {
                setBusy(false);
                onUploadStateChange(false);
              });
          }}
          className="h-8 px-3 rounded-sm bg-white border border-danger text-danger hover:bg-danger-soft text-[11px] font-bold transition"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className={cn(
          "rounded-md border-2 border-dashed py-6 px-4 text-center text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition",
          busy
            ? "border-border bg-surface-soft text-muted"
            : "border-border-strong bg-surface-soft text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        <input
          type="file"
          accept={slot.accept}
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={busy || !sessionId}
          className="hidden"
        />
        <div className="text-2xl">📎</div>
        <div className="font-bold">
          {busy ? "업로드 중…" : "파일 선택"}
        </div>
        {slot.accept && (
          <div className="text-[10px]">허용: {slot.accept}</div>
        )}
        <div className="text-[10px]">최대 20MB · 슬롯당 1개</div>
        {!sessionId && (
          <div className="text-[10px] text-warning font-bold">
            Practice 링크에서는 저장되지 않습니다
          </div>
        )}
      </label>
      {error && (
        <div className="mt-2 text-[11px] text-danger font-bold">{error}</div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
