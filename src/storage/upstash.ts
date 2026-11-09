import type { StorageAdapter } from "../core/types";

export interface UpstashOptions {
  url: string;
  token: string;
  timeoutMs?: number;
}

interface UpstashResponse<T = unknown> {
  result?: T;
  error?: string;
}

function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Upstash URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Upstash URL must use https");
  }
  return parsed;
}

async function callUpstash<T>(
  endpoint: URL,
  token: string,
  timeoutMs: number,
  command: Array<string | number>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
    if (!response.ok) {
      throw new Error(`Upstash request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as UpstashResponse<T>;
    if (payload.error) {
      throw new Error(`Upstash error: ${payload.error}`);
    }
    return payload.result as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pipeline INCR + PEXPIRE in one HTTP round-trip (no Lua EVAL).
 * Upstash REST: POST /pipeline with an array of Redis commands.
 */
async function incrWithExpire(
  endpoint: URL,
  token: string,
  timeoutMs: number,
  key: string,
  ttlMs: number
): Promise<number> {
  const pipelineUrl = new URL(endpoint.toString());
  if (!pipelineUrl.pathname.endsWith("/pipeline")) {
    const base = pipelineUrl.pathname.endsWith("/")
      ? pipelineUrl.pathname
      : `${pipelineUrl.pathname}/`;
    pipelineUrl.pathname = `${base}pipeline`.replace(/\/{2,}/g, "/");
    if (!pipelineUrl.pathname.startsWith("/")) {
      pipelineUrl.pathname = `/${pipelineUrl.pathname}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const px = Math.max(1, Math.floor(ttlMs));

  try {
    const response = await fetch(pipelineUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, px]
      ])
    });
    if (!response.ok) {
      throw new Error(`Upstash request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as UpstashResponse[] | UpstashResponse;
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      if (row.error) {
        throw new Error(`Upstash error: ${row.error}`);
      }
    }
    const incrResult = rows[0]?.result;
    if (typeof incrResult !== "number") {
      throw new Error("Upstash pipeline INCR did not return a number");
    }
    return incrResult;
  } finally {
    clearTimeout(timeout);
  }
}

export function upstash(options: UpstashOptions): StorageAdapter {
  if (!options.token || options.token.trim().length < 8) {
    throw new Error("Upstash token appears invalid");
  }
  const endpoint = validateUrl(options.url);
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (timeoutMs <= 0 || timeoutMs > 30_000) {
    throw new Error("Upstash timeoutMs must be between 1 and 30000");
  }

  return {
    async get(key: string): Promise<string | null> {
      const result = await callUpstash<string | null>(endpoint, options.token, timeoutMs, ["GET", key]);
      return result ?? null;
    },
    async set(key: string, value: string, ttlMs: number): Promise<void> {
      await callUpstash(endpoint, options.token, timeoutMs, [
        "SET",
        key,
        value,
        "PX",
        Math.max(1, Math.floor(ttlMs))
      ]);
    },
    async increment(key: string, ttlMs: number): Promise<number> {
      return incrWithExpire(endpoint, options.token, timeoutMs, key, ttlMs);
    },
    async delete(key: string): Promise<void> {
      await callUpstash(endpoint, options.token, timeoutMs, ["DEL", key]);
    }
  };
}
