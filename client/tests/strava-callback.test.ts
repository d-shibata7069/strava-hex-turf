import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/auth/strava/callback/route";

const mocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "strava_hex_session",
  createSessionToken: mocks.createSessionToken,
  getSessionCookieOptions: () => ({ path: "/", httpOnly: true, maxAge: 3600 }),
  getSessionDestroyOptions: () => ({ path: "/", httpOnly: true, maxAge: 0 }),
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServer: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }),
}));

const A = 53694021;
const B = 206060517;
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
function request(query = "code=code&state=state") {
  return new NextRequest(`https://app.example/api/auth/strava/callback?${query}`, {
    headers: { cookie: "strava_oauth_state=state; strava_hex_session=old-account-a" },
  });
}
function prepare(athleteId: number, userId: string, backfill = false) {
  mocks.fetch
    .mockResolvedValueOnce(Response.json({
      access_token: "test-access", refresh_token: "test-refresh", expires_at: 1900000000,
      athlete: { id: athleteId, firstname: "Daiki", lastname: "Shibata", profile: null },
    }))
    .mockResolvedValueOnce(Response.json({ id: userId, should_run_initial_backfill: backfill }));
  mocks.maybeSingle.mockResolvedValue({ data: { id: userId, strava_id: athleteId }, error: null });
}
function expectLoggedOut(response: Awaited<ReturnType<typeof GET>>) {
  expect(response.cookies.get("strava_hex_session")?.maxAge).toBe(0);
  expect(response.cookies.get("strava_oauth_state")?.maxAge).toBe(0);
  expect(mocks.createSessionToken).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
  vi.stubEnv("NEXT_PUBLIC_STRAVA_CLIENT_ID", "test-client");
  vi.stubEnv("STRAVA_CLIENT_SECRET", "test-secret");
  vi.stubEnv("BACKEND_API_URL", "https://backend.example");
  vi.stubEnv("INTERNAL_BACKFILL_API_KEY", "test-backfill");
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
  mocks.createSessionToken.mockImplementation(async (id: string) => `session-${id}`);
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Strava account switching", () => {
  it("keeps same-name athletes separate and replaces the old session", async () => {
    for (const [athleteId, uuid] of [[A, UUID_A], [B, UUID_B]] as const) {
      prepare(athleteId, uuid);
      const response = await GET(request());
      expect(response.cookies.get("strava_hex_session")?.value).toBe(`session-${uuid}`);
      expect(mocks.eq).toHaveBeenCalledWith("id", uuid);
      expect(mocks.eq).toHaveBeenCalledWith("strava_id", athleteId);
    }
    const syncCalls = mocks.fetch.mock.calls.filter(([url]) => String(url).endsWith("/users/sync"));
    expect(syncCalls.map(([, init]) => JSON.parse(init.body).strava_id)).toEqual([A, B]);
    expect(syncCalls.map(([, init]) => JSON.parse(init.body).display_name)).toEqual(["Daiki Shibata", "Daiki Shibata"]);
  });
  it("rejects a sync UUID belonging to the other athlete before backfill or session creation", async () => {
    prepare(B, UUID_A, true);
    mocks.maybeSingle.mockResolvedValue({ data: { id: UUID_A, strava_id: A }, error: null });
    expectLoggedOut(await GET(request()));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "DB unavailable" } },
  ])("fails closed on a missing mapping or DB error: %j", async result => {
    prepare(B, UUID_B);
    mocks.maybeSingle.mockResolvedValue(result);
    expectLoggedOut(await GET(request()));
  });
  it("clears both cookies on a thrown identity lookup error", async () => {
    prepare(B, UUID_B);
    mocks.maybeSingle.mockRejectedValue(new Error("DB unavailable"));
    expectLoggedOut(await GET(request()));
  });
  it("accepts a BIGINT returned as a decimal string", async () => {
    prepare(B, UUID_B);
    mocks.maybeSingle.mockResolvedValue({ data: { id: UUID_B, strava_id: String(B) }, error: null });
    expect((await GET(request())).cookies.get("strava_hex_session")?.value).toBe(`session-${UUID_B}`);
  });
  it.each(["error=access_denied", "code=code&state=wrong", "state=state"])("clears the previous session on OAuth failure: %s", async query => {
    expectLoggedOut(await GET(request(query)));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("clears the previous session when sync fails", async () => {
    prepare(B, UUID_B);
    mocks.fetch.mockReset()
      .mockResolvedValueOnce(Response.json({ athlete: { id: B } }))
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));
    expectLoggedOut(await GET(request()));
  });
  it("clears both cookies when initial backfill fails", async () => {
    prepare(B, UUID_B, true);
    mocks.fetch.mockResolvedValueOnce(new Response("failed", { status: 500 }));
    expectLoggedOut(await GET(request()));
  });
  it("clears both cookies when the initial backfill key is missing", async () => {
    prepare(B, UUID_B, true);
    vi.stubEnv("INTERNAL_BACKFILL_API_KEY", "");
    expectLoggedOut(await GET(request()));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("clears the previous session when token signing fails", async () => {
    prepare(B, UUID_B);
    mocks.createSessionToken.mockRejectedValue(new Error("configuration"));
    const response = await GET(request());
    expect(response.cookies.get("strava_hex_session")?.maxAge).toBe(0);
    expect(response.cookies.get("strava_oauth_state")?.maxAge).toBe(0);
  });
});
