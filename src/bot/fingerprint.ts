export interface FingerprintResult {
  score: number;
  signals: string[];
}

/** Common crawler / CLI user-agent substrings (case-insensitive). */
const AUTOMATED_UA_PATTERNS: RegExp[] = [
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /\bcurl\//i,
  /\bwget\//i,
  /\bhttpie\//i,
  /\bpython-requests\//i,
  /\bgo-http-client\//i,
  /\bjava\//i,
  /\baxios\//i,
  /\bnode-fetch\//i,
  /\bpostmanruntime\//i,
  /\binsomnia\//i
];

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
  } else if (AUTOMATED_UA_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    score += 40;
    signals.push("automated_client_ua");
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
