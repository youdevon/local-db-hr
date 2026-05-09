import { describe, expect, it } from "vitest";

import {
  compareSemverStyle,
  isVersionNewer,
  meetsMinimumSupportedVersion,
  parseSemverStyle,
  stripVersionPrefix,
} from "./version-compare";

describe("stripVersionPrefix", () => {
  it("removes a single leading v", () => {
    expect(stripVersionPrefix("v1.0.0")).toBe("1.0.0");
    expect(stripVersionPrefix("V0.2.0-beta")).toBe("0.2.0-beta");
  });
});

describe("parseSemverStyle", () => {
  it("parses core and optional prerelease", () => {
    expect(parseSemverStyle("0.12.0-beta")).toEqual({
      major: 0,
      minor: 12,
      patch: 0,
      prerelease: "beta",
    });
    expect(parseSemverStyle("v0.11.1-beta")).toEqual({
      major: 0,
      minor: 11,
      patch: 1,
      prerelease: "beta",
    });
    expect(parseSemverStyle("1.0.0")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: null,
    });
  });

  it("returns null for malformed input", () => {
    expect(parseSemverStyle("not-a-version")).toBeNull();
  });
});

describe("compareSemverStyle", () => {
  it("orders numeric parts lexicographically by semver rules", () => {
    expect(compareSemverStyle("0.12.0-beta", "0.11.1-beta")).toBeGreaterThan(0);
    expect(compareSemverStyle("1.0.0", "0.12.0-beta")).toBeGreaterThan(0);
    expect(compareSemverStyle("0.11.0-beta", "0.11.0-beta")).toBe(0);
  });

  it("treats a release as newer than a prerelease with the same core", () => {
    expect(compareSemverStyle("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
    expect(compareSemverStyle("1.0.0-beta", "1.0.0")).toBeLessThan(0);
  });
});

describe("meetsMinimumSupportedVersion", () => {
  it("returns true when installed is at or above the minimum", () => {
    expect(meetsMinimumSupportedVersion("0.12.0-beta", "0.11.0-beta")).toBe(true);
    expect(meetsMinimumSupportedVersion("v0.11.0-beta", "0.11.0-beta")).toBe(true);
  });

  it("returns false when installed is below the minimum or unparsable", () => {
    expect(meetsMinimumSupportedVersion("0.10.0-beta", "0.11.0-beta")).toBe(false);
    expect(meetsMinimumSupportedVersion("nope", "0.11.0-beta")).toBe(false);
  });
});

describe("isVersionNewer", () => {
  it("returns true only when latest parses and is strictly greater", () => {
    expect(isVersionNewer("0.12.0-beta", "v0.11.0-beta")).toBe(true);
    expect(isVersionNewer("0.11.0-beta", "0.12.0-beta")).toBe(false);
    expect(isVersionNewer("0.11.0-beta", "0.11.0-beta")).toBe(false);
  });

  it("returns false when either side is unparsable", () => {
    expect(isVersionNewer("latest", "0.11.0-beta")).toBe(false);
    expect(isVersionNewer("0.12.0-beta", "unknown")).toBe(false);
  });
});
