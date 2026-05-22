import { describe, expect, it } from "vitest";
import {
  defaultChallengeRenderer,
  encodeChallenge,
  isReplayedSolution,
  issueChallengeValue,
  markSolutionUsed,
  parseEncodedChallenge,
  renderChallengePage,
  verifyVdfSolution
} from "../../src/bot/challenge";
import { memory } from "../../src/storage/memory";
import { VDF } from "../../src/bot/vdf";

describe("challenge helpers", () => {
  it("parses and detects expired challenges", () => {
    const encoded = encodeChallenge("abcd", Date.now() - 10_000);
    const parsed = parseEncodedChallenge(encoded, 1_000);
    expect(parsed.valid).toBe(true);
    expect(parsed.expired).toBe(true);
  });

  it("renders default HTML challenge page", () => {
    const request = new Request("https://example.com/page");
    const issued = issueChallengeValue(8);
    const page = renderChallengePage({
      request,
      challengeHex: issued.challengeHex,
      issuedAt: issued.issuedAt,
      steps: 2,
      maxAgeMs: 60_000,
      score: 80,
      challengeHeader: "x-edgeshield-vdf-challenge",
      solutionHeader: "x-edgeshield-vdf-solution"
    });

    expect(page.contentType).toBe("text/html; charset=utf-8");
    expect(page.body).toContain("<!DOCTYPE html>");
    expect(page.body).toContain(issued.challengeHex);
    expect(page.body).toContain("SlothPermutation");
  });

  it("supports custom renderer override", () => {
    const request = new Request("https://example.com");
    const page = renderChallengePage(
      {
        request,
        challengeHex: "aa",
        issuedAt: Date.now(),
        steps: 1,
        maxAgeMs: 60_000,
        score: 70,
        challengeHeader: "x-challenge",
        solutionHeader: "x-solution"
      },
      () => "custom-body"
    );
    expect(page.body).toBe("custom-body");
  });

  it("default renderer includes client VDF script", () => {
    const html = defaultChallengeRenderer({
      request: new Request("https://example.com"),
      challengeHex: "ff",
      issuedAt: 1,
      steps: 3,
      maxAgeMs: 60_000,
      score: 90,
      challengeHeader: "x-edgeshield-vdf-challenge",
      solutionHeader: "x-edgeshield-vdf-solution"
    });
    expect(html).toContain("async compute(challengeHex, steps)");
  });

  it("tracks replayed solutions when storage is provided", async () => {
    const storage = memory();
    const challengeHex = issueChallengeValue(8).challengeHex;
    const proof = await VDF.compute(challengeHex, 2);

    expect(await verifyVdfSolution(challengeHex, 2, proof, storage, 60_000)).toBe(true);
    expect(await verifyVdfSolution(challengeHex, 2, proof, storage, 60_000)).toBe(false);
  });

  it("skips replay tracking without storage", async () => {
    const challengeHex = issueChallengeValue(8).challengeHex;
    const proof = await VDF.compute(challengeHex, 2);

    expect(await isReplayedSolution(undefined, challengeHex, proof)).toBe(false);
    await markSolutionUsed(undefined, challengeHex, proof, 60_000);
    expect(await verifyVdfSolution(challengeHex, 2, proof)).toBe(true);
    expect(await verifyVdfSolution(challengeHex, 2, proof)).toBe(true);
  });

  it("returns false when verification throws", async () => {
    expect(await verifyVdfSolution("not-hex", 2, "also-bad")).toBe(false);
  });

  it("parses invalid encoded challenges", () => {
    const parsed = parseEncodedChallenge(".", 60_000);
    expect(parsed.valid).toBe(false);
    expect(parsed.expired).toBe(true);
  });

  it("encodes challenge values with timestamp", () => {
    expect(encodeChallenge("abcd", 1234)).toBe("abcd.1234");
  });

  it("parses valid non-expired challenges", () => {
    const now = 1_000_000;
    const encoded = encodeChallenge("deadbeef", now - 500);
    const parsed = parseEncodedChallenge(encoded, 60_000, now);
    expect(parsed.valid).toBe(true);
    expect(parsed.expired).toBe(false);
    expect(parsed.challengeHex).toBe("deadbeef");
    expect(parsed.issuedAt).toBe(now - 500);
  });

  it("issues random encoded challenge values", () => {
    const issued = issueChallengeValue(8);
    expect(issued.challengeHex).toHaveLength(16);
    expect(issued.encoded).toBe(`${issued.challengeHex}.${issued.issuedAt}`);
  });

  it("does not persist replay keys when maxAgeMs is omitted", async () => {
    const storage = memory();
    const challengeHex = issueChallengeValue(8).challengeHex;
    const proof = await VDF.compute(challengeHex, 2);

    expect(await verifyVdfSolution(challengeHex, 2, proof, storage)).toBe(true);
    expect(await verifyVdfSolution(challengeHex, 2, proof, storage)).toBe(true);
  });

  it("detects replayed solutions via isReplayedSolution", async () => {
    const storage = memory();
    const challengeHex = issueChallengeValue(8).challengeHex;
    const proof = await VDF.compute(challengeHex, 2);
    await markSolutionUsed(storage, challengeHex, proof, 60_000);
    expect(await isReplayedSolution(storage, challengeHex, proof)).toBe(true);
  });
});
