const MAX_IDENTIFIER_LENGTH = 128;

export function extractClientIp(request: Request): string | null {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ];
  for (const value of candidates) {
    if (value && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function sanitizeIdentifier(identifier: string): string {
  const normalized = identifier.trim().replace(/\s+/g, "_").toLowerCase();
  if (!normalized) {
    return "anonymous";
  }
  return normalized.slice(0, MAX_IDENTIFIER_LENGTH);
}

export function defaultIdentifier(request: Request): string {
  return sanitizeIdentifier(extractClientIp(request) ?? "anonymous");
}
