export function verifyOrigin(request: Request): "valid" | "origin_mismatch" {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) {
    return "origin_mismatch";
  }

  const expected = `https://${host}`;
  if (origin && origin !== expected) {
    return "origin_mismatch";
  }
  if (referer) {
    try {
      const parsed = new URL(referer);
      if (parsed.origin !== expected) {
        return "origin_mismatch";
      }
    } catch {
      return "origin_mismatch";
    }
  }
  return "valid";
}
