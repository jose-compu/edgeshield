function encodeBase64Url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) {
    raw += String.fromCharCode(byte);
  }
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  const pairs = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
  const cookies: Record<string, string> = {};
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=");
    if (!name || rest.length === 0) {
      continue;
    }
    cookies[name] = rest.join("=");
  }
  return cookies;
}

export interface CsrfCookieOptions {
  name: string;
  sameSite?: "strict" | "lax" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  path?: string;
}

export async function signCsrfPayload(payload: string, secret: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function generateDoubleSubmitToken(secret: string, ttlMs: number): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const payload = `${nonce}.${issuedAt}.${expiresAt}`;
  const sig = await signCsrfPayload(payload, secret);
  return `${payload}.${sig}`;
}

export function buildCsrfCookie(token: string, cookie: CsrfCookieOptions, ttlMs: number): string {
  const parts = [`${cookie.name}=${token}`];
  parts.push(`Max-Age=${Math.max(1, Math.ceil(ttlMs / 1000))}`);
  parts.push(`Path=${cookie.path ?? "/"}`);
  parts.push(`SameSite=${(cookie.sameSite ?? "strict").toLowerCase()}`);
  if (cookie.secure ?? true) {
    parts.push("Secure");
  }
  if (cookie.httpOnly ?? true) {
    parts.push("HttpOnly");
  }
  return parts.join("; ");
}

export async function verifyDoubleSubmitToken(
  request: Request,
  secret: string,
  cookieName: string
): Promise<"valid" | "missing_token" | "mismatch" | "expired"> {
  const requestToken = request.headers.get("x-csrf-token");
  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieToken = cookies[cookieName];
  if (!requestToken || !cookieToken) {
    return "missing_token";
  }
  if (requestToken !== cookieToken) {
    return "mismatch";
  }

  const segments = requestToken.split(".");
  if (segments.length !== 4) {
    return "mismatch";
  }
  const [nonce, issuedAtRaw, expiresAtRaw, signature] = segments;
  if (!nonce || !issuedAtRaw || !expiresAtRaw || !signature) {
    return "mismatch";
  }
  const payload = `${nonce}.${issuedAtRaw}.${expiresAtRaw}`;
  const expectedSig = await signCsrfPayload(payload, secret);
  if (expectedSig !== signature) {
    return "mismatch";
  }
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return "expired";
  }
  return "valid";
}
