import { describe, it, expect, vi } from "vitest";
import { runDecayScores } from "./decay-scores.js";

describe("runDecayScores", () => {
  it("RPC が成功した場合 success: true を返す", async () => {
    const deps = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
    };
    const result = await runDecayScores(deps);
    expect(result).toEqual({ success: true });
    expect(deps.rpc).toHaveBeenCalledWith("decay_tile_scores");
  });

  it("RPC がエラーを返した場合 success: false と error メッセージを返す", async () => {
    const deps = {
      rpc: vi.fn().mockResolvedValue({
        error: { message: "permission denied" },
      }),
    };
    const result = await runDecayScores(deps);
    expect(result).toEqual({
      success: false,
      error: "permission denied",
    });
    expect(deps.rpc).toHaveBeenCalledWith("decay_tile_scores");
  });
});
