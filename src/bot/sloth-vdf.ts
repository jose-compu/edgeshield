/*
 * Sloth permutation adapted from dignity.js (Apache-2.0):
 * https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js
 * https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts
 */
export class SlothPermutation {
  private static readonly p = BigInt(
    "170082004324204494273811327264862981553264701145937538369570764779791492622392118654022654452947093285873855529044371650895045691292912712699015605832276411308653107069798639938826015099738961427172366594187783204437869906954750443653318078358839409699824714551430573905637228307966826784684174483831608534979"
  );

  private fastPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === BigInt(1)) {
      return BigInt(0);
    }

    let result = BigInt(1);
    let powBase = base % modulus;
    let powExponent = exponent;

    while (powExponent > 0) {
      if (powExponent % BigInt(2) === BigInt(1)) {
        result = (result * powBase) % modulus;
      }

      powExponent /= BigInt(2);
      powBase = (powBase * powBase) % modulus;
    }

    return result;
  }

  private quadRes(x: bigint): boolean {
    return (
      this.fastPow(
        x,
        (SlothPermutation.p - BigInt(1)) / BigInt(2),
        SlothPermutation.p
      ) === BigInt(1)
    );
  }

  private modSqrtOp(x: bigint): bigint {
    let value = x;
    if (!this.quadRes(value)) {
      value = (-value + SlothPermutation.p) % SlothPermutation.p;
    }
    return this.fastPow(
      value,
      (SlothPermutation.p + BigInt(1)) / BigInt(4),
      SlothPermutation.p
    );
  }

  private modOp(x: bigint, t: bigint): bigint {
    let value = x % SlothPermutation.p;
    for (let i = BigInt(0); i < t; i += BigInt(1)) {
      value = this.modSqrtOp(value);
    }
    return value;
  }

  private modVerif(y: bigint, x: bigint, t: bigint): boolean {
    const input = x % SlothPermutation.p;
    let value = y;

    for (let i = BigInt(0); i < t; i += BigInt(1)) {
      value = (value * value) % SlothPermutation.p;
    }

    if (!this.quadRes(value)) {
      value = (-value + SlothPermutation.p) % SlothPermutation.p;
    }

    return (
      input === value ||
      ((-input + SlothPermutation.p) % SlothPermutation.p) === value
    );
  }

  generateProofVDF(steps: number, input: bigint): bigint {
    return this.modOp(input, BigInt(steps));
  }

  verifyProofVDF(steps: number, input: bigint, output: bigint): boolean {
    return this.modVerif(output, input, BigInt(steps));
  }
}
