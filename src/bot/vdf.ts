/*
 * VDF wrapper adapted from dignity.js (Apache-2.0):
 * https://github.com/jose-compu/dignity.js/blob/main/src/security/vdf.js
 */
import { SlothPermutation } from "./sloth-vdf";

function normalizeHex(hex: string): string {
  const value = hex.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(value)) {
    throw new Error("Invalid hex input");
  }
  return value;
}

export class VDF {
  static async compute(challengeHex: string, steps: number): Promise<string> {
    if (!Number.isInteger(steps) || steps <= 0) {
      throw new Error("VDF steps must be a positive integer");
    }
    const vdf = new SlothPermutation();
    const challenge = BigInt(`0x${normalizeHex(challengeHex)}`);
    const result = vdf.generateProofVDF(steps, challenge);
    return result.toString(16);
  }

  static async verify(
    challengeHex: string,
    steps: number,
    resultHex: string
  ): Promise<boolean> {
    if (!Number.isInteger(steps) || steps <= 0) {
      throw new Error("VDF steps must be a positive integer");
    }
    const vdf = new SlothPermutation();
    const challenge = BigInt(`0x${normalizeHex(challengeHex)}`);
    const result = BigInt(`0x${normalizeHex(resultHex)}`);
    return vdf.verifyProofVDF(steps, challenge, result);
  }
}

export function createVdfChallenge(bytes = 16): string {
  if (!Number.isInteger(bytes) || bytes < 8 || bytes > 64) {
    throw new Error("Challenge bytes must be between 8 and 64");
  }
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return Array.from(raw, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
