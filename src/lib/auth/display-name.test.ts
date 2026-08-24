import { describe, expect, test } from "vitest";
import { getUserDisplayInfo } from "./display-name";
import type { User } from "@supabase/supabase-js";

function user(overrides: Partial<User>): User {
  return {
    id: "u1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

describe("getUserDisplayInfo", () => {
  test("prefers full_name and avatar_url from Google's user_metadata", () => {
    const info = getUserDisplayInfo(
      user({
        email: "jane@example.com",
        user_metadata: { full_name: "Jane Doe", avatar_url: "https://example.com/jane.jpg" },
      }),
    );

    expect(info).toEqual({ name: "Jane Doe", avatarUrl: "https://example.com/jane.jpg" });
  });

  test("falls back to name/picture when full_name/avatar_url are absent", () => {
    const info = getUserDisplayInfo(
      user({
        email: "jane@example.com",
        user_metadata: { name: "Jane D.", picture: "https://example.com/jane2.jpg" },
      }),
    );

    expect(info).toEqual({ name: "Jane D.", avatarUrl: "https://example.com/jane2.jpg" });
  });

  test("falls back to the local part of the email when no name is available", () => {
    const info = getUserDisplayInfo(user({ email: "jane.doe@example.com", user_metadata: {} }));

    expect(info).toEqual({ name: "jane.doe", avatarUrl: null });
  });

  test("falls back to a generic label when there is no name or email at all", () => {
    const info = getUserDisplayInfo(user({ user_metadata: {} }));

    expect(info).toEqual({ name: "Tu cuenta", avatarUrl: null });
  });
});
