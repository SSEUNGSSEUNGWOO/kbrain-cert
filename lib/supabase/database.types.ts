/**
 * Supabase 스키마 타입 - 수동 정의
 * 정식 자동생성 (승우님이 login 후):
 *   npx supabase gen types typescript --project-id rrewqehmebpzwbiuavdw --schema public > lib/supabase/database.types.ts
 *
 * 지금은 수동 유지 · 마이그레이션 신규 컬럼 · 테이블 추가할 때마다 이 파일도 갱신
 * 반영된 마이그레이션:
 *   - 20260714000001_initial_schema
 *   - 20260715000001_exam_practice_slug
 *   - 20260715000002_exam_session_precheck
 *   - 20260715000003_auto_submit_cron (함수만)
 *   - 20260715000004_realtime_publications (publication만)
 *   - 20260716000001_examiner_actions (time_extension + session_messages)
 *   - 20260716000002_answer_files (bucket)
 *   - 20260716000003_identity_documents (bucket)
 *   - 20260720000001_exam_slug_and_phone_entry (slug + phone + guest_otp_codes drop)
 *   - 20260720000002_single_session_per_invitation (invitation당 단일 session)
 *   - 20260720000003_test_exam_attempts (테스트 시험 다회차)
 */

export type AppRole = "admin" | "examiner" | "grader" | "applicant";
export type DifficultyLevel = "쉬움" | "보통" | "어려움";
export type ExamStatus = "draft" | "open" | "closed";
export type SessionStatus =
  | "waiting"
  | "in_progress"
  | "submitted"
  | "passed"
  | "failed";
export type InvitationStatus = "created" | "sent" | "used" | "expired";
export type EventSeverity = "info" | "warn" | "high";
export type IdentityReviewStatus = "pending" | "approved" | "rejected";
export type RecordingKind = "webcam" | "screen";
export type SenderRole = "applicant" | "examiner" | "system";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: AppRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          organization: string | null;
          department: string | null;
          position: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email?: string | null;
          organization?: string | null;
          department?: string | null;
          position?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      question_categories: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          order_num: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          order_num?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["question_categories"]["Insert"]
        >;
      };
      exam_grades: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          order_num: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          order_num?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_grades"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          code: string;
          category_id: string | null;
          grade_id: string | null;
          difficulty: DifficultyLevel | null;
          tags: string[];
          content: string;
          attachments: Json;
          submission_slots: Json;
          rubric: Json | null;
          max_score: number;
          set_id: string | null;
          set_order: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["questions"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      question_sets: {
        Row: {
          id: string;
          title: string;
          scenario: string | null;
          attachments: Json;
          total_score: number | null;
          order_num: number;
          category_id: string | null;
          grade_id: string | null;
          proctoring_disabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["question_sets"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["question_sets"]["Insert"]
        >;
      };
      exams: {
        Row: {
          id: string;
          title: string;
          grade_id: string | null;
          exam_date: string | null;
          duration_minutes: number;
          max_participants: number | null;
          status: ExamStatus;
          instructions: string | null;
          registration_mode: string;
          pass_score: number;
          is_test_mode: boolean;
          use_absolute_end: boolean;
          entry_start_minutes: number;
          allow_dual_monitor: boolean;
          skip_waiting_checks: boolean;
          agora_channel_name: string | null;
          custom_texts: Json;
          alert_event_types: string[];
          practice_slug: string | null;
          slug: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["exams"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exams"]["Insert"]>;
      };
      exam_sets: {
        Row: {
          exam_id: string;
          set_id: string;
          order_num: number;
        };
        Insert: {
          exam_id: string;
          set_id: string;
          order_num?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["exam_sets"]["Insert"]
        >;
      };
      exam_questions: {
        Row: {
          exam_id: string;
          question_id: string;
          order_num: number;
        };
        Insert: {
          exam_id: string;
          question_id: string;
          order_num?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["exam_questions"]["Insert"]
        >;
      };
      exam_invitations: {
        Row: {
          id: string;
          exam_id: string;
          email: string | null;
          phone: string | null;
          name: string | null;
          organization: string | null;
          invite_code: string;
          status: InvitationStatus;
          sent_at: string | null;
          used_at: string | null;
          allow_dual_monitor: boolean | null;
          allow_no_webcam: boolean | null;
          allow_no_screen_share: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          email?: string | null;
          phone?: string | null;
          name?: string | null;
          organization?: string | null;
          invite_code: string;
          status?: InvitationStatus;
          sent_at?: string | null;
          used_at?: string | null;
          allow_dual_monitor?: boolean | null;
          allow_no_webcam?: boolean | null;
          allow_no_screen_share?: boolean | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["exam_invitations"]["Insert"]
        >;
      };
      exam_sessions: {
        Row: {
          id: string;
          exam_id: string;
          applicant_id: string | null;
          invitation_id: string | null;
          is_test_attempt: boolean;
          status: SessionStatus;
          start_time: string | null;
          submit_time: string | null;
          score_total: number | null;
          is_flagged: boolean;
          identity_image_url: string | null;
          identity_review_status: IdentityReviewStatus | null;
          identity_review_note: string | null;
          identity_reviewed_by: string | null;
          monitoring_notes: string | null;
          auto_submitted: boolean;
          time_extension_minutes: number;
          precheck_env_result: Json | null;
          precheck_pledge_accepted_at: string | null;
          precheck_waiting_entered_at: string | null;
          precheck_user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          applicant_id?: string | null;
          invitation_id?: string | null;
          is_test_attempt?: boolean;
          status?: SessionStatus;
          start_time?: string | null;
          submit_time?: string | null;
          score_total?: number | null;
          is_flagged?: boolean;
          identity_image_url?: string | null;
          identity_review_status?: IdentityReviewStatus | null;
          identity_review_note?: string | null;
          identity_reviewed_by?: string | null;
          monitoring_notes?: string | null;
          auto_submitted?: boolean;
          time_extension_minutes?: number;
          precheck_env_result?: Json | null;
          precheck_pledge_accepted_at?: string | null;
          precheck_waiting_entered_at?: string | null;
          precheck_user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["exam_sessions"]["Insert"]
        >;
      };
      answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          slot_values: Json;
          slot_scores: Json | null;
          score: number | null;
          feedback: string | null;
          graded_by: string | null;
          graded_at: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          question_id: string;
          slot_values?: Json;
          slot_scores?: Json | null;
          score?: number | null;
          feedback?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["answers"]["Insert"]>;
      };
      monitoring_events: {
        Row: {
          id: number;
          session_id: string;
          event_type: string;
          detected_at: string;
          screenshot_url: string | null;
          question_index: number | null;
          severity: EventSeverity;
          payload: Json | null;
          is_reviewed: boolean;
          reviewer_note: string | null;
        };
        Insert: {
          id?: number;
          session_id: string;
          event_type: string;
          detected_at?: string;
          screenshot_url?: string | null;
          question_index?: number | null;
          severity?: EventSeverity;
          payload?: Json | null;
          is_reviewed?: boolean;
          reviewer_note?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["monitoring_events"]["Insert"]
        >;
      };
      session_messages: {
        Row: {
          id: number;
          session_id: string;
          sender_role: SenderRole;
          sender_id: string | null;
          content: string;
          is_announcement: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: number;
          session_id: string;
          sender_role: SenderRole;
          sender_id?: string | null;
          content: string;
          is_announcement?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["session_messages"]["Insert"]
        >;
      };
      recordings: {
        Row: {
          id: string;
          session_id: string;
          kind: RecordingKind;
          storage_key: string;
          size_bytes: number | null;
          duration_seconds: number | null;
          started_at: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          kind: RecordingKind;
          storage_key: string;
          size_bytes?: number | null;
          duration_seconds?: number | null;
          started_at?: string | null;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recordings"]["Insert"]>;
      };
      site_settings: {
        Row: {
          key: string;
          value: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["site_settings"]["Insert"]
        >;
      };
    };
    Views: {
      questions_for_applicant: {
        Row: {
          id: string;
          code: string;
          content: string;
          submission_slots: Json;
          max_score: number;
          set_id: string | null;
          set_order: number | null;
          tags: string[];
          difficulty: DifficultyLevel | null;
        };
      };
    };
    Functions: {
      to_percentage: {
        Args: { raw: number; max_val: number };
        Returns: number;
      };
      auto_submit_expired_sessions: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      force_submit_exam_sessions: {
        Args: { p_exam_id: string; p_reason: string };
        Returns: number;
      };
      submit_exam_session: {
        Args: {
          p_session_id: string;
          p_answers: Json;
          p_auto?: boolean;
        };
        Returns: Array<{
          submitted_at: string;
          already_submitted: boolean;
        }>;
      };
      save_exam_answers: {
        Args: {
          p_session_id: string;
          p_answers: Json;
        };
        Returns: string;
      };
      consume_exam_entry_attempt: {
        Args: {
          p_attempt_key: string;
          p_max_attempts?: number;
          p_window_seconds?: number;
        };
        Returns: boolean;
      };
      cleanup_exam_entry_attempts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      validate_exam_answers: {
        Args: {
          p_exam_id: string;
          p_answers: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      difficulty_level: DifficultyLevel;
      exam_status: ExamStatus;
      session_status: SessionStatus;
      invitation_status: InvitationStatus;
      event_severity: EventSeverity;
      identity_review_status: IdentityReviewStatus;
      recording_kind: RecordingKind;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
