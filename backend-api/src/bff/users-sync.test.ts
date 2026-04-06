import { describe, it, expect, vi } from "vitest";
import { runUsersSync, type UsersSyncBody } from "./users-sync.js";

const validBody: UsersSyncBody = {
  strava_id: 12345,
  access_token: "access",
  refresh_token: "refresh",
  display_name: "Test User",
  profile_image_url: "https://example.com/icon.png",
  strava_token_expires_at: "2025-12-31T00:00:00Z",
};

function createSupabaseMock(options?: {
  existingUser?: { id: string; initial_backfill_done_at: string | null } | null;
  existingUserError?: string | null;
  upsertData?: { id?: string } | null;
  upsertError?: string | null;
}) {
  const existingUser = options?.existingUser ?? null;
  const existingUserError = options?.existingUserError ?? null;
  const upsertData = options?.upsertData ?? { id: "user-1" };
  const upsertError = options?.upsertError ?? null;

  const mockExistingMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: existingUser, error: existingUserError ? { message: existingUserError } : null });
  const mockExistingEq = vi.fn(() => ({ maybeSingle: mockExistingMaybeSingle }));
  const mockExistingSelect = vi.fn(() => ({ eq: mockExistingEq }));

  const mockUpsertSingle = vi
    .fn()
    .mockResolvedValue({ data: upsertData, error: upsertError ? { message: upsertError } : null });
  const mockUpsertSelect = vi.fn(() => ({ single: mockUpsertSingle }));
  const mockUpsert = vi.fn(() => ({ select: mockUpsertSelect }));

  const mockFrom = vi.fn((_table: string) => ({
    select: mockExistingSelect,
    upsert: mockUpsert,
  }));

  return {
    supabase: { from: mockFrom },
    mocks: {
      mockFrom,
      mockUpsert,
    },
  };
}

describe("runUsersSync", () => {
  it("必須項目が欠けている場合は 400", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase } = createSupabaseMock();

    const missingStravaId = { ...validBody, strava_id: undefined } as unknown as UsersSyncBody;
    expect(await runUsersSync(supabase as never, missingStravaId, encrypt)).toEqual({
      ok: false,
      statusCode: 400,
      error: "Missing or invalid strava_id, access_token, refresh_token",
    });

    const missingAccessToken = { ...validBody, access_token: undefined } as unknown as UsersSyncBody;
    expect(await runUsersSync(supabase as never, missingAccessToken, encrypt)).toEqual({
      ok: false,
      statusCode: 400,
      error: "Missing or invalid strava_id, access_token, refresh_token",
    });
  });

  it("暗号化が null を返す場合は 500", async () => {
    const encrypt = vi.fn(() => null);
    const { supabase } = createSupabaseMock();

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: false, statusCode: 500, error: "Token encryption failed" });
  });

  it("upsert 成功時は ok: true と id を返す", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase, mocks } = createSupabaseMock();

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: true, id: "user-1", should_run_initial_backfill: true });
    expect(mocks.mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        strava_id: 12345,
        display_name: "Test User",
        icon_url: "https://example.com/icon.png",
        strava_access_token: "enc:access",
        strava_refresh_token: "enc:refresh",
        strava_token_expires_at: "2025-12-31T00:00:00Z",
      }),
      expect.any(Object)
    );
  });

  it("display_name が空の場合は User {strava_id} になる", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase, mocks } = createSupabaseMock();
    const body = { ...validBody, display_name: "", profile_image_url: null };

    await runUsersSync(supabase as never, body, encrypt);
    expect(mocks.mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "User 12345" }),
      expect.any(Object)
    );
  });

  it("Supabase upsert がエラーの場合は 500", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase } = createSupabaseMock({ upsertData: null, upsertError: "DB error" });

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: false, statusCode: 500, error: "DB error" });
  });

  it("upsert は成功したが id が無い場合は 500", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase } = createSupabaseMock({ upsertData: {}, upsertError: null });

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      error: "users upsert succeeded but id was missing",
    });
  });

  it("既存ユーザーで initial_backfill_done_at がある場合 should_run_initial_backfill は false", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase } = createSupabaseMock({
      existingUser: { id: "user-1", initial_backfill_done_at: "2026-01-01T00:00:00Z" },
    });

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: true, id: "user-1", should_run_initial_backfill: false });
  });
  it("initial_backfill_done_at カラム未適用環境でも users/sync は失敗せず、初回バックフィルは無効化する", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const { supabase } = createSupabaseMock({
      existingUserError: 'column users.initial_backfill_done_at does not exist',
    });

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: true, id: "user-1", should_run_initial_backfill: false });
  });
});
