import type { User } from "@supabase/supabase-js";

export interface UserDisplayInfo {
  name: string;
  avatarUrl: string | null;
}

// El login solo existe hoy vía Google OAuth — user_metadata trae los
// campos de perfil de Google (full_name/name, avatar_url/picture).
export function getUserDisplayInfo(user: User): UserDisplayInfo {
  const metadata = user.user_metadata ?? {};

  const name =
    metadata.full_name ?? metadata.name ?? (user.email ? user.email.split("@")[0] : null) ?? "Tu cuenta";

  const avatarUrl = metadata.avatar_url ?? metadata.picture ?? null;

  return { name, avatarUrl };
}
