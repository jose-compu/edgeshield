import { describe, expect, it } from "vitest";
import { evaluateRules } from "../../src/bot/rules";

describe("bot rules", () => {
  it("returns neutral without rules", () => {
    expect(evaluateRules("Mozilla/5.0")).toBe("neutral");
  });

  it("allowlist has priority over blocklist", () => {
    const decision = evaluateRules("googlebot", {
      allow: [/googlebot/i],
      block: [/bot/i]
    });
    expect(decision).toBe("allow");
  });

  it("blocks when only block rule matches", () => {
    const decision = evaluateRules("curl/8.0", {
      block: [/curl/i]
    });
    expect(decision).toBe("block");
  });

  it("returns neutral when rules exist but nothing matches", () => {
    expect(evaluateRules("Mozilla/5.0", { allow: [/googlebot/i], block: [/curl/i] })).toBe("neutral");
    expect(evaluateRules("Mozilla/5.0", { allow: [], block: [] })).toBe("neutral");
  });
});
