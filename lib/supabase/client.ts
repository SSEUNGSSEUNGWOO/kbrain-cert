"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 클라이언트 컴포넌트 · 브라우저에서 사용
 * anon key 기반 · RLS 적용
 */
export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
