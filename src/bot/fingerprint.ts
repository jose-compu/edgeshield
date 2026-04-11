export interface FingerprintResult {
  score: number;
  signals: string[];
}

export function fingerprintRequest(request: Request): FingerprintResult {
  let score = 0;
  const signals: string[] = [];

  const userAgent = request.headers.get("user-agent") ?? "";
  const accept = request.headers.get("accept");
  const acceptLanguage = request.headers.get("accept-language");
  const acceptEncoding = request.headers.get("accept-encoding");
  const connection = request.headers.get("connection");
  const cfBotScore = request.headers.get("cf-bot-score");

  if (!userAgent) {
    score += 35;
    signals.push("missing_user_agent");
  }
  if (!accept) {
    score += 20;
    signals.push("missing_accept");
  }
  if (!acceptLanguage) {
    score += 10;
    signals.push("missing_accept_language");
  }
  if (!acceptEncoding) {
    score += 10;
    signals.push("missing_accept_encoding");
  }
  if (connection && !["keep-alive", "close"].includes(connection.toLowerCase())) {
    score += 10;
    signals.push("suspicious_connection");
  }

  if (cfBotScore) {
    const parsed = Number.parseInt(cfBotScore, 10);
    if (Number.isFinite(parsed) && parsed <= 10) {
      score += 30;
      signals.push("low_cf_bot_score");
    }
  }

  return { score: Math.min(100, score), signals };
}
