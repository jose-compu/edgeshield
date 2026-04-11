import { describe, expect, it, vi } from "vitest";
import { memory } from "../../src/storage/memory";

describe("memory adapter", () => {
  it("sets and gets values with ttl", async () => {
    const adapter = memory();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    await adapter.set("k", "v", 100);
    expect(await adapter.get("k")).toBe("v");
  });

  it("expires old values", async () => {
    const adapter = memory();
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    await adapter.set("k", "v", 100);
    now.mockReturnValue(1_500);
    expect(await adapter.get("k")).toBeNull();
  });

  it("increments and deletes", async () => {
    const adapter = memory();
    expect(await adapter.increment("count", 10_000)).toBe(1);
    expect(await adapter.increment("count", 10_000)).toBe(2);
    await adapter.delete("count");
    expect(await adapter.get("count")).toBeNull();
  });
});
