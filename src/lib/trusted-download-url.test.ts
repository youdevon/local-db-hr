import { describe, expect, it } from "vitest";

import { isTrustedGithubReleaseDownloadUrl } from "./trusted-download-url";

describe("isTrustedGithubReleaseDownloadUrl", () => {
  it("accepts github.com paths for youdevon/local-db-hr", () => {
    expect(
      isTrustedGithubReleaseDownloadUrl(
        "https://github.com/youdevon/local-db-hr/archive/refs/tags/v0.13.1-beta.zip",
      ),
    ).toBe(true);
    expect(
      isTrustedGithubReleaseDownloadUrl(
        "https://github.com/youdevon/local-db-hr/releases/download/v0.1.0/pkg.zip",
      ),
    ).toBe(true);
  });

  it("accepts codeload.github.com for this repo", () => {
    expect(
      isTrustedGithubReleaseDownloadUrl("https://codeload.github.com/youdevon/local-db-hr/tar.gz/v0.1.0"),
    ).toBe(true);
  });

  it("rejects other hosts and repos", () => {
    expect(isTrustedGithubReleaseDownloadUrl("https://evil.com/youdevon/local-db-hr.zip")).toBe(false);
    expect(
      isTrustedGithubReleaseDownloadUrl("https://github.com/other/local-db-hr/archive/refs/tags/v1.zip"),
    ).toBe(false);
    expect(isTrustedGithubReleaseDownloadUrl("https://objects.githubusercontent.com/...")).toBe(false);
  });
});
