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

describe("runUsersSync", () => {
  it("必須項目が欠けている場合は 400", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };

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
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: false, statusCode: 500, error: "Token encryption failed" });
  });

  it("upsert 成功時は ok: true と id を返す", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: true, id: "user-1" });
    expect(mockUpsert).toHaveBeenCalledWith(
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
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };
    const body = { ...validBody, display_name: "", profile_image_url: null };

    await runUsersSync(supabase as never, body, encrypt);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "User 12345" }),
      expect.any(Object)
    );
  });

  it("Supabase upsert がエラーの場合は 500", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({ ok: false, statusCode: 500, error: "DB error" });
  });

  it("upsert は成功したが id が無い場合は 500", async () => {
    const encrypt = vi.fn((s: string) => `enc:${s}`);
    const mockSingle = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    const supabase = { from: mockFrom };

    const result = await runUsersSync(supabase as never, validBody, encrypt);
    expect(result).toEqual({
      ok: false,
      statusCode: 500,
      error: "users upsert succeeded but id was missing",
    });
  });
});
