import { afterEach, describe, expect, it, vi } from "vitest";
import { upstash } from "../../src/storage/upstash";

describe("upstash adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates options", () => {
    expect(() => upstash({ url: "http://invalid", token: "short" })).toThrow();
    expect(() => upstash({ url: "https://example.com", token: "short" })).toThrow();
    expect(() => upstash({ url: "https://example.com", token: "valid-token", timeoutMs: 0 })).toThrow();
  });

  it("runs successful commands", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "ok" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = upstash({
      url: "https://example.upstash.io",
      token: "valid-token",
      timeoutMs: 500
    });

    await expect(adapter.get("k")).resolves.toBeNull();
    await expect(adapter.set("k", "v", 1000)).resolves.toBeUndefined();
    await expect(adapter.increment("k", 1000)).resolves.toBe(2);
    await expect(adapter.delete("k")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("throws when remote returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "ERR" }), { status: 200 }))
    );

    const adapter = upstash({
      url: "https://example.upstash.io",
      token: "valid-token"
    });
    await expect(adapter.get("k")).rejects.toThrow("Upstash error");
  });

  it("throws when status is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("x", { status: 500 }))
    );

    const adapter = upstash({
      url: "https://example.upstash.io",
      token: "valid-token"
    });
    await expect(adapter.get("k")).rejects.toThrow("status 500");
  });
});
