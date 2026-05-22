/*
 * Bot challenge helpers and default HTML renderer.
 * Sloth VDF core adapted from dignity.js (Apache-2.0):
 * https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js
 */
import type { StorageAdapter } from "../core/types";
import { createVdfChallenge, VDF } from "./vdf";

export interface ChallengeContext {
  request: Request;
  challengeHex: string;
  issuedAt: number;
  steps: number;
  maxAgeMs: number;
  score: number;
  challengeHeader: string;
  solutionHeader: string;
}

export type ChallengeRenderer = (context: ChallengeContext) => string;

export interface ParsedChallenge {
  challengeHex: string;
  issuedAt: number;
  expired: boolean;
  valid: boolean;
}

export function parseEncodedChallenge(
  encoded: string,
  maxAgeMs: number,
  nowMs = Date.now()
): ParsedChallenge {
  const [challengeHex, issuedAtRaw] = encoded.split(".");
  const issuedAt = Number.parseInt(issuedAtRaw ?? "", 10);
  const valid = Boolean(challengeHex) && Number.isFinite(issuedAt);
  const expired = !valid || nowMs - issuedAt > maxAgeMs;
  return {
    challengeHex: challengeHex ?? "",
    issuedAt,
    expired,
    valid
  };
}

export function encodeChallenge(challengeHex: string, issuedAt = Date.now()): string {
  return `${challengeHex}.${issuedAt}`;
}

function solutionReplayKey(challengeHex: string, solution: string): string {
  return `edgeshield:vdf:used:${challengeHex}:${solution}`;
}

export async function isReplayedSolution(
  storage: StorageAdapter | undefined,
  challengeHex: string,
  solution: string
): Promise<boolean> {
  if (!storage) {
    return false;
  }
  const existing = await storage.get(solutionReplayKey(challengeHex, solution));
  return existing !== null;
}

export async function markSolutionUsed(
  storage: StorageAdapter | undefined,
  challengeHex: string,
  solution: string,
  ttlMs: number
): Promise<void> {
  if (!storage) {
    return;
  }
  await storage.set(solutionReplayKey(challengeHex, solution), "1", ttlMs);
}

export async function verifyVdfSolution(
  challengeHex: string,
  steps: number,
  solution: string,
  storage?: StorageAdapter,
  maxAgeMs?: number
): Promise<boolean> {
  if (await isReplayedSolution(storage, challengeHex, solution)) {
    return false;
  }
  let verified = false;
  try {
    verified = await VDF.verify(challengeHex, steps, solution);
  } catch {
    verified = false;
  }
  if (verified && storage && maxAgeMs) {
    await markSolutionUsed(storage, challengeHex, solution, maxAgeMs);
  }
  return verified;
}

export function issueChallengeValue(bytes = 16): { encoded: string; challengeHex: string; issuedAt: number } {
  const challengeHex = createVdfChallenge(bytes);
  const issuedAt = Date.now();
  return {
    challengeHex,
    issuedAt,
    encoded: encodeChallenge(challengeHex, issuedAt)
  };
}

/** Browser-compatible Sloth VDF used by the default challenge page. */
export const SLOTH_VDF_CLIENT_SOURCE = String.raw`
class SlothPermutation {
  static p = BigInt(
    "170082004324204494273811327264862981553264701145937538369570764779791492622392118654022654452947093285873855529044371650895045691292912712699015605832276411308653107069798639938826015099738961427172366594187783204437869906954750443653318078358839409699824714551430573905637228307966826784684174483831608534979"
  );
  fastPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;
    let result = 1n;
    let powBase = base % modulus;
    let powExponent = exponent;
    while (powExponent > 0n) {
      if (powExponent % 2n === 1n) result = (result * powBase) % modulus;
      powExponent /= 2n;
      powBase = (powBase * powBase) % modulus;
    }
    return result;
  }
  quadRes(x) {
    return this.fastPow(x, (SlothPermutation.p - 1n) / 2n, SlothPermutation.p) === 1n;
  }
  modSqrtOp(x) {
    let value = x;
    if (!this.quadRes(value)) value = (-value + SlothPermutation.p) % SlothPermutation.p;
    return this.fastPow(value, (SlothPermutation.p + 1n) / 4n, SlothPermutation.p);
  }
  modOp(x, t) {
    let value = x % SlothPermutation.p;
    for (let i = 0n; i < t; i += 1n) value = this.modSqrtOp(value);
    return value;
  }
  async compute(challengeHex, steps) {
    const vdf = new SlothPermutation();
    const challenge = BigInt("0x" + challengeHex);
    return vdf.modOp(challenge, BigInt(steps)).toString(16);
  }
}
`;

export function defaultChallengeRenderer(context: ChallengeContext): string {
  const url = context.request.url;
  const challengeHeader = context.challengeHeader;
  const solutionHeader = context.solutionHeader;
  const encoded = encodeChallenge(context.challengeHex, context.issuedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verification required</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1a1a1a; }
    p { line-height: 1.5; }
    #status { font-weight: 600; }
  </style>
</head>
<body>
  <h1>Verification required</h1>
  <p id="status">Checking your browser…</p>
  <p>This short check helps protect the site from automated traffic.</p>
  <script>
${SLOTH_VDF_CLIENT_SOURCE}
(async () => {
  const status = document.getElementById("status");
  const challengeHex = ${JSON.stringify(context.challengeHex)};
  const encoded = ${JSON.stringify(encoded)};
  const steps = ${context.steps};
  const challengeHeader = ${JSON.stringify(challengeHeader)};
  const solutionHeader = ${JSON.stringify(solutionHeader)};
  const targetUrl = ${JSON.stringify(url)};
  try {
    const vdf = new SlothPermutation();
    const proof = await vdf.compute(challengeHex, steps);
    status.textContent = "Verification complete. Continuing…";
    const headers = new Headers();
    headers.set(challengeHeader, encoded);
    headers.set(solutionHeader, proof);
    const response = await fetch(targetUrl, { method: "GET", headers, credentials: "same-origin" });
    if (response.redirected) {
      window.location.href = response.url;
      return;
    }
    if (response.ok) {
      const html = await response.text();
      document.open();
      document.write(html);
      document.close();
      return;
    }
    status.textContent = "Verification failed. Please refresh and try again.";
  } catch (error) {
    status.textContent = "Verification failed. Please refresh and try again.";
    console.error(error);
  }
})();
  </script>
</body>
</html>`;
}

export interface ChallengePage {
  body: string;
  contentType: string;
}

export function renderChallengePage(
  context: ChallengeContext,
  renderer: ChallengeRenderer = defaultChallengeRenderer
): ChallengePage {
  return {
    body: renderer(context),
    contentType: "text/html; charset=utf-8"
  };
}
