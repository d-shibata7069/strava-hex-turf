import { describe, it, expect, vi } from "vitest";
import { runBackfillDailyStats } from "./backfill-daily-stats.js";

describe("runBackfillDailyStats", () => {
  it("RPC が成功した場合 success: true を返し、p_start_date / p_end_date を渡す", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const result = await runBackfillDailyStats({ rpc }, "1month");
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("backfill_user_group_daily_stats", {
      p_start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      p_end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    const [, params] = rpc.mock.calls[0];
    expect(params.p_start_date <= params.p_end_date).toBe(true);
  });

  it("range 1week で RPC が呼ばれ、日数差が 7 日以内である", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await runBackfillDailyStats({ rpc }, "1week");
    const [, params] = rpc.mock.calls[0];
    const start = new Date(params.p_start_date);
    const end = new Date(params.p_end_date);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it("RPC がエラーを返した場合 success: false と error メッセージを返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: "function not found" },
    });
    const result = await runBackfillDailyStats({ rpc }, "1month");
    expect(result).toEqual({
      success: false,
      error: "function not found",
    });
  });
});
