import { describe, expect, it } from "vitest";
import { createVdfChallenge, VDF } from "../../src/bot";

describe("VDF", () => {
  it("computes and verifies proof", async () => {
    const challenge = createVdfChallenge(8);
    const steps = 3;
    const proof = await VDF.compute(challenge, steps);
    await expect(VDF.verify(challenge, steps, proof)).resolves.toBe(true);
  });

  it("rejects wrong proof", async () => {
    const challenge = createVdfChallenge(8);
    const steps = 3;
    await expect(VDF.verify(challenge, steps, "deadbeef")).resolves.toBe(false);
  });

  it("validates inputs", async () => {
    await expect(VDF.compute("xyz", 1)).rejects.toThrow("Invalid hex");
    await expect(VDF.compute("ab", 0)).rejects.toThrow("positive integer");
    await expect(VDF.verify("ab", 0, "cd")).rejects.toThrow("positive integer");
    expect(() => createVdfChallenge(4)).toThrow("between 8 and 64");
    expect(() => createVdfChallenge(128)).toThrow("between 8 and 64");
  });

  it("accepts 0x-prefixed hex values", async () => {
    const challenge = "0xdeadbeef";
    const proof = await VDF.compute(challenge, 2);
    await expect(VDF.verify(challenge, 2, `0x${proof}`)).resolves.toBe(true);
  });
});
