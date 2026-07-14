/**
 * Supabase 스키마 타입 - 수동 정의 (초기)
 *
 * 정식 자동생성 방법 (승우님이 supabase login 후 실행):
 *   npx supabase gen types typescript --project-id rrewqehmebpzwbiuavdw --schema public > lib/supabase/database.types.ts
 *
 * 지금은 M2에서 실제 사용할 최소 테이블만 정의. 나머지는 자동생성 후 대체.
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
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
    Views: Record<string, never>;
    Functions: {
      to_percentage: {
        Args: { raw: number; max_val: number };
        Returns: number;
      };
    };
    Enums: {
      app_role: AppRole;
      difficulty_level: DifficultyLevel;
      exam_status: ExamStatus;
      session_status: SessionStatus;
      invitation_status: InvitationStatus;
      event_severity: EventSeverity;
    };
  };
}
