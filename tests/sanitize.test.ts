import { describe, expect, it } from "vitest";
import { sanitizeJlptHtml } from "@/utils/sanitize";

describe("sanitizeJlptHtml (NS-005 Security Regression)", () => {
  it("preserves safe JLPT furigana and underline tags", () => {
    const input =
      '<p><ruby>毎日<rt>まいにち</rt></ruby>　<u>電車</u>で　行きます。</p>';
    expect(sanitizeJlptHtml(input)).toBe(input);
  });

  it("strips script tags, event handlers, and nested malformed tags", () => {
    const xss =
      '<<script>alert(1)//<</script><img src=x onerror="alert(2)"><ruby onmouseover="alert(3)">漢字<rt>かんじ</rt></ruby>';
    const output = sanitizeJlptHtml(xss);

    expect(output).not.toContain("<script");
    expect(output).not.toContain("<img");
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("onmouseover");
    expect(output).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
  });

  it("auto-closes unclosed allowed tags cleanly", () => {
    expect(sanitizeJlptHtml("<ruby>本<rt>ほん")).toBe(
      "<ruby>本<rt>ほん</rt></ruby>"
    );
  });
});
