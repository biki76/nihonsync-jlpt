import { describe, expect, it } from "vitest";
import { isValidOptionIndex, isValidUuid } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";

describe("Input Validation & Rate Limiter (NS-011)", () => {
  it("validates UUID strings and rejects malformed values", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("seed-n5-1")).toBe(false);
    expect(isValidUuid("'; DROP TABLE exams; --")).toBe(false);
  });

  it("validates option indexes (1..4 or null)", () => {
    expect(isValidOptionIndex(null)).toBe(true);
    expect(isValidOptionIndex(1)).toBe(true);
    expect(isValidOptionIndex(4)).toBe(true);
    expect(isValidOptionIndex(0)).toBe(false);
    expect(isValidOptionIndex(5)).toBe(false);
  });

  it("enforces sliding-window request limits", () => {
    const key = `test-bucket-${Date.now()}`;
    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(false);
  });
});
