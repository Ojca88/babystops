// Shared by both the browser and server Supabase clients — kept free of
// server-only imports (like next/headers) so it's safe to use from client
// components too.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
