import { randomInt, delay, seed, encodeNTPath, encodePosixPath } from "src/tools";

import { describe, it, expect } from "bun:test";

describe("randomInt", () => {
  it("should generate a random integer within the specified range", () => {
    const min = 1;
    const max = 10;
    const result = randomInt(min, max);
    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("should return the same value when min equals max", () => {
    expect(randomInt(5, 5)).toBe(5);
  });

  it("should handle negative ranges", () => {
    const result = randomInt(-10, -1);
    expect(result).toBeGreaterThanOrEqual(-10);
    expect(result).toBeLessThanOrEqual(-1);
  });

  it("should handle crossing zero", () => {
    const result = randomInt(-5, 5);
    expect(result).toBeGreaterThanOrEqual(-5);
    expect(result).toBeLessThanOrEqual(5);
  });
});

describe("delay", () => {
  it("should delay execution for the specified number of milliseconds", async () => {
    const ms = 100;
    const start = Date.now();
    await delay(ms);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(ms);
  });

  it("should resolve immediately for 0ms", async () => {
    const start = Date.now();
    await delay(0);
    const end = Date.now();
    expect(end - start).toBeLessThan(50);
  });
});

describe("seed", () => {
  it("should generate a random seed within the specified range", () => {
    const result = seed();
    expect(result).toBeGreaterThanOrEqual(10000000000);
    expect(result).toBeLessThanOrEqual(999999999999);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("should generate different seeds on successive calls", () => {
    const seeds = new Set(Array.from({ length: 10 }, () => seed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe("encodeNTPath", () => {
  it("should encode a POSIX path to an NT path", () => {
    expect(encodeNTPath("SDXL/realvisxlV40")).toBe("SDXL\\realvisxlV40");
  });

  it("should handle nested directories", () => {
    expect(encodeNTPath("a/b/c/d")).toBe("a\\b\\c\\d");
  });

  it("should return the same string if no forward slashes", () => {
    expect(encodeNTPath("plain_path")).toBe("plain_path");
  });

  it("should handle empty string", () => {
    expect(encodeNTPath("")).toBe("");
  });
});

describe("encodePosixPath", () => {
  it("should encode an NT path to a POSIX path", () => {
    expect(encodePosixPath("SDXL\\realvisxlV40")).toBe("SDXL/realvisxlV40");
  });

  it("should handle nested directories", () => {
    expect(encodePosixPath("a\\b\\c\\d")).toBe("a/b/c/d");
  });

  it("should return the same string if no backslashes", () => {
    expect(encodePosixPath("plain_path")).toBe("plain_path");
  });

  it("should handle empty string", () => {
    expect(encodePosixPath("")).toBe("");
  });
});
