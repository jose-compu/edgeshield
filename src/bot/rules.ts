export interface BotRules {
  block?: RegExp[];
  allow?: RegExp[];
}

export type RuleDecision = "allow" | "block" | "neutral";

export function evaluateRules(userAgent: string, rules?: BotRules): RuleDecision {
  const ua = userAgent.trim();
  if (!rules || (!rules.allow?.length && !rules.block?.length)) {
    return "neutral";
  }
  if (rules.allow?.some((rule) => rule.test(ua))) {
    return "allow";
  }
  if (rules.block?.some((rule) => rule.test(ua))) {
    return "block";
  }
  return "neutral";
}
