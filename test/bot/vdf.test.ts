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
    expect(() => createVdfChallenge(4)).toThrow("between 8 and 64");
  });
});
