import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isValidInternalApiKey,
  isValidBackfillApiKey,
  safeEqualString,
} from "./internal-auth.js";

describe("internal-auth", () => {
  const originalInternal = process.env.INTERNAL_API_KEY;
  const originalBackfill = process.env.INTERNAL_BACKFILL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = "test-internal-key";
    process.env.INTERNAL_BACKFILL_API_KEY = "test-backfill-key";
  });

  afterEach(() => {
    if (originalInternal === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalInternal;
    if (originalBackfill === undefined) delete process.env.INTERNAL_BACKFILL_API_KEY;
    else process.env.INTERNAL_BACKFILL_API_KEY = originalBackfill;
  });

  it("キーが一致すれば true", () => {
    expect(isValidInternalApiKey("test-internal-key")).toBe(true);
  });

  it("キーが不一致なら false", () => {
    expect(isValidInternalApiKey("wrong-key-value!")).toBe(false);
  });

  it("環境変数が未設定なら一致する値でも false（fail closed）", () => {
    delete process.env.INTERNAL_API_KEY;
    expect(isValidInternalApiKey("test-internal-key")).toBe(false);
    expect(isValidInternalApiKey("")).toBe(false);
    expect(isValidInternalApiKey(undefined)).toBe(false);
  });

  it("環境変数が空文字なら false（fail closed）", () => {
    process.env.INTERNAL_API_KEY = "";
    expect(isValidInternalApiKey("")).toBe(false);
  });

  it("長さが違うキーは false（例外を投げない）", () => {
    expect(isValidInternalApiKey("short")).toBe(false);
    expect(isValidInternalApiKey("test-internal-key-with-extra-suffix")).toBe(false);
  });

  it("未提供（undefined / 配列）は false", () => {
    expect(isValidInternalApiKey(undefined)).toBe(false);
    expect(isValidInternalApiKey(null)).toBe(false);
    expect(isValidInternalApiKey(["test-internal-key"])).toBe(false);
  });

  it("バックフィルキーも同様に照合する", () => {
    expect(isValidBackfillApiKey("test-backfill-key")).toBe(true);
    expect(isValidBackfillApiKey("test-internal-key")).toBe(false);
    delete process.env.INTERNAL_BACKFILL_API_KEY;
    expect(isValidBackfillApiKey("test-backfill-key")).toBe(false);
  });

  it("safeEqualString は同値のみ true", () => {
    expect(safeEqualString("abc", "abc")).toBe(true);
    expect(safeEqualString("abc", "abd")).toBe(false);
    expect(safeEqualString("abc", "abcd")).toBe(false);
  });
});
