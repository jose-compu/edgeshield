import { describe, expect, it } from "vitest";
import { SlothPermutation } from "../../src/bot/sloth-vdf";

describe("SlothPermutation", () => {
  it("generates proofs that verify for multiple step counts", () => {
    const vdf = new SlothPermutation();
    const input = BigInt("0xdeadbeef");

    for (const steps of [1, 2, 5, 10]) {
      const proof = vdf.generateProofVDF(steps, input);
      expect(vdf.verifyProofVDF(steps, input, proof)).toBe(true);
    }
  });

  it("rejects tampered proofs", () => {
    const vdf = new SlothPermutation();
    const input = BigInt("0xabc123");
    const proof = vdf.generateProofVDF(4, input);
    const tampered = proof + BigInt(1);
    expect(vdf.verifyProofVDF(4, input, tampered)).toBe(false);
  });

  it("verifies proofs produced from hex challenges", () => {
    const vdf = new SlothPermutation();
    const input = BigInt("0x0123456789abcdef");
    const proof = vdf.generateProofVDF(3, input);
    expect(vdf.verifyProofVDF(3, input, proof)).toBe(true);
    expect(vdf.verifyProofVDF(3, input, proof + BigInt(42))).toBe(false);
  });
});
