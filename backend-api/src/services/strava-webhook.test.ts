import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  verifyWebhook,
  processActivityEvent,
  type WebhookVerifyQuery,
  type StravaActivityResponse,
  type FetchStravaActivityFn,
} from "./strava-webhook.js";

describe("verifyWebhook", () => {
  it("hub.challenge が文字列ならそのまま返す", () => {
    const query: WebhookVerifyQuery = {
      "hub.mode": "subscribe",
      "hub.challenge": "abc123challenge",
      "hub.verify_token": "STRAVA",
    };
    expect(verifyWebhook(query)).toEqual({ "hub.challenge": "abc123challenge" });
  });

  it("hub.challenge が空文字の場合は null を返す", () => {
    expect(verifyWebhook({ "hub.challenge": "" })).toBeNull();
  });

  it("hub.challenge が無い場合は null を返す", () => {
    expect(verifyWebhook({})).toBeNull();
    expect(verifyWebhook({ "hub.mode": "subscribe" })).toBeNull();
  });
});

describe("processActivityEvent", () => {
  const mockUserId = "user-uuid-1";
  const mockGroupId = "group-uuid-1";
  /** ダミーPolyline（東京駅付近の短いルート想定）。decode で [lat, lng][] が得られる */
  const dummyPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  let mockSupabase: SupabaseClient;
  let mockFetchStrava: FetchStravaActivityFn;
  let upsertCalls: unknown[];

  beforeEach(() => {
    upsertCalls = [];
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockUserId, strava_access_token: "token123" },
              error: null,
            }),
          };
        }
        if (table === "group_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: undefined,
            [Symbol.toStringTag]: "Promise",
          } as unknown as ReturnType<SupabaseClient["from"]>;
        }
        if (table === "tiles") {
          return {
            upsert: vi.fn((rows: unknown, opts: unknown) => {
              upsertCalls.push({ rows, opts });
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    // group_members のチェーン: select().eq() の戻り値が thenable で { data: [...] } を返す
    const fromUsers = mockSupabase.from("users") as ReturnType<SupabaseClient["from"]> & {
      select: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
      eq: ReturnType<ReturnType<ReturnType<SupabaseClient["from"]>["select"]>["eq"]>;
      single: () => Promise<{ data: { id: string; strava_access_token: string } | null; error: unknown }>;
    };
    const fromGroups = mockSupabase.from("group_members");
    (fromGroups as { select: (cols: string) => unknown }).select = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [{ group_id: mockGroupId }], error: null }),
    });

    mockFetchStrava = vi.fn().mockResolvedValue({
      id: 12345,
      map: { summary_polyline: dummyPolyline },
    } as StravaActivityResponse);
  });

  it("ユーザー取得・Strava取得・H3計算・Upsert が行われ、Upsert に正しい形で渡る", async () => {
    const fromSpy = vi.mocked(mockSupabase.from);
    const groupMembersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ group_id: mockGroupId }], error: null }),
    };
    fromSpy.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockUserId, strava_access_token: "token123" },
            error: null,
          }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      if (table === "group_members") {
        return groupMembersChain as unknown as ReturnType<SupabaseClient["from"]>;
      }
      if (table === "tiles") {
        return {
          upsert: vi.fn((rows: unknown, opts: unknown) => {
            upsertCalls.push({ rows, opts });
            return Promise.resolve({ data: null, error: null });
          }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      return {} as ReturnType<SupabaseClient["from"]>;
    });

    const result = await processActivityEvent(100, 999, mockSupabase, mockFetchStrava);

    expect(result.success).toBe(true);
    expect(mockFetchStrava).toHaveBeenCalledWith(100, "token123");

    expect(upsertCalls.length).toBe(1);
    const { rows, opts } = upsertCalls[0] as { rows: Array<Record<string, unknown>>; opts: Record<string, unknown> };
    expect(opts).toMatchObject({ onConflict: "h3_index,group_id", ignoreDuplicates: false });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("h3_index");
      expect(row).toHaveProperty("group_id", mockGroupId);
      expect(row).toHaveProperty("owner_id", mockUserId);
      expect(row).toHaveProperty("score", 100);
      expect(row).toHaveProperty("captured_at");
      expect(typeof row.h3_index).toBe("string");
      expect((row.h3_index as string).length).toBe(15); // H3 Resolution 7
    }
  });

  it("ユーザーが存在しない場合は success: false, error: user_not_found", async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      return {} as ReturnType<SupabaseClient["from"]>;
    });

    const result = await processActivityEvent(100, 999, mockSupabase, mockFetchStrava);
    expect(result.success).toBe(false);
    expect(result.error).toBe("user_not_found");
  });

  it("アクセストークンが無い場合は success: false, error: missing_access_token", async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockUserId, strava_access_token: null },
            error: null,
          }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      return {} as ReturnType<SupabaseClient["from"]>;
    });

    const result = await processActivityEvent(100, 999, mockSupabase, mockFetchStrava);
    expect(result.success).toBe(false);
    expect(result.error).toBe("missing_access_token");
  });

  it("Polyline が無い場合は success: false, error: no_polyline", async () => {
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockUserId, strava_access_token: "token123" },
            error: null,
          }),
        } as unknown as ReturnType<SupabaseClient["from"]>;
      }
      return {} as ReturnType<SupabaseClient["from"]>;
    });

    const noPolylineFetch: FetchStravaActivityFn = vi.fn().mockResolvedValue({
      id: 100,
      map: { summary_polyline: null },
    });

    const result = await processActivityEvent(100, 999, mockSupabase, noPolylineFetch);
    expect(result.success).toBe(false);
    expect(result.error).toBe("no_polyline");
  });
});
