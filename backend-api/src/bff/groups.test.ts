import { describe, it, expect, vi } from "vitest";
import { createGroup, joinGroup } from "./groups.js";

const validUserId = "550e8400-e29b-41d4-a716-446655440000";

describe("createGroup", () => {
  it("name が空の場合は 400", async () => {
    const mockFrom = vi.fn(() => ({}));
    const supabase = { from: mockFrom };
    const result = await createGroup(supabase as never, { name: "", user_id: validUserId });
    expect(result).toEqual({ ok: false, statusCode: 400, error: "Missing or invalid name" });
  });

  it("user_id が不正な場合は 400", async () => {
    const mockFrom = vi.fn(() => ({}));
    const supabase = { from: mockFrom };
    const result = await createGroup(supabase as never, { name: "My Group", user_id: "not-a-uuid" });
    expect(result).toEqual({ ok: false, statusCode: 400, error: "Missing or invalid user_id" });
  });

  it("groups insert 成功後に group_members insert が失敗した場合は 500", async () => {
    const mockGroupsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "g1", name: "My Group", invite_code: "abc12345" },
          error: null,
        }),
      }),
    });
    const mockMembersInsert = vi.fn().mockResolvedValue({ error: { message: "FK violation" } });
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups") return { insert: mockGroupsInsert };
      if (table === "group_members") return { insert: mockMembersInsert };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await createGroup(supabase as never, { name: "My Group", user_id: validUserId });
    expect(result).toEqual({ ok: false, statusCode: 500, error: "FK violation" });
  });

  it("groups insert 成功・group_members 成功で ok: true と group_id, name, invite_code を返す", async () => {
    const mockGroupsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "g1", name: "My Group", invite_code: "deadbeef" },
          error: null,
        }),
      }),
    });
    const mockMembersInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups") return { insert: mockGroupsInsert };
      if (table === "group_members") return { insert: mockMembersInsert };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await createGroup(supabase as never, { name: "My Group", user_id: validUserId });
    expect(result).toEqual({
      ok: true,
      group_id: "g1",
      name: "My Group",
      invite_code: "deadbeef",
    });
    expect(mockMembersInsert).toHaveBeenCalledWith({ group_id: "g1", user_id: validUserId });
  });

  it("groups insert が 23505 の場合はリトライし、最終的に全て衝突なら 409", async () => {
    const mockGroupsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505" },
        }),
      }),
    });
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups") return { insert: mockGroupsInsert };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await createGroup(supabase as never, { name: "My Group", user_id: validUserId });
    expect(result).toEqual({
      ok: false,
      statusCode: 409,
      error: "Invite code conflict after retries",
    });
    expect(mockGroupsInsert).toHaveBeenCalledTimes(5);
  });
});

describe("joinGroup", () => {
  it("invite_code が空の場合は 400", async () => {
    const mockFrom = vi.fn(() => ({}));
    const supabase = { from: mockFrom };
    const result = await joinGroup(supabase as never, { invite_code: "", user_id: validUserId });
    expect(result).toEqual({ ok: false, statusCode: 400, error: "Missing or invalid invite_code" });
  });

  it("user_id が不正な場合は 400", async () => {
    const mockFrom = vi.fn(() => ({}));
    const supabase = { from: mockFrom };
    const result = await joinGroup(supabase as never, { invite_code: "abc12345", user_id: "x" });
    expect(result).toEqual({ ok: false, statusCode: 400, error: "Missing or invalid user_id" });
  });

  it("招待コードに一致するグループが無い場合は 404", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups")
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await joinGroup(supabase as never, {
      invite_code: "nonexistent",
      user_id: validUserId,
    });
    expect(result).toEqual({ ok: false, statusCode: 404, error: "Group not found" });
  });

  it("グループ取得エラー時は 500", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups")
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await joinGroup(supabase as never, {
      invite_code: "abc12345",
      user_id: validUserId,
    });
    expect(result).toEqual({ ok: false, statusCode: 500, error: "DB error" });
  });

  it("既に参加済み（23505）の場合は 409", async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups")
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "g1" },
                error: null,
              }),
            }),
          }),
        };
      if (table === "group_members")
        return {
          insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
        };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await joinGroup(supabase as never, {
      invite_code: "abc12345",
      user_id: validUserId,
    });
    expect(result).toEqual({ ok: false, statusCode: 409, error: "Already a member" });
  });

  it("参加成功時は ok: true と group_id を返す", async () => {
    const mockMembersInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === "groups")
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "g1" },
                error: null,
              }),
            }),
          }),
        };
      if (table === "group_members") return { insert: mockMembersInsert };
      return {};
    });
    const supabase = { from: mockFrom };

    const result = await joinGroup(supabase as never, {
      invite_code: "abc12345",
      user_id: validUserId,
    });
    expect(result).toEqual({ ok: true, group_id: "g1" });
    expect(mockMembersInsert).toHaveBeenCalledWith({ group_id: "g1", user_id: validUserId });
  });
});
