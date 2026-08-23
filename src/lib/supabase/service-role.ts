import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con SUPABASE_SERVICE_ROLE_KEY — bypassa RLS por diseño.
// Solo para scripts de ingesta y el cron de refresco (docs/baby-stops/02-modelo-de-datos.md,
// 10-mvp-tecnico.md). Nunca importar desde un componente cliente.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createServiceRoleClient: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
