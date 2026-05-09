/**
 * Restrict update package downloads to approved GitHub URLs for this repository.
 * Does not allow arbitrary hosts (e.g. release asset redirects to objects.githubusercontent.com).
 */
export const TRUSTED_GITHUB_OWNER = "youdevon" as const;
export const TRUSTED_GITHUB_REPO = "local-db-hr" as const;

const TRUSTED_PATH_SEGMENT = `/${TRUSTED_GITHUB_OWNER}/${TRUSTED_GITHUB_REPO}/`;

export function isTrustedGithubReleaseDownloadUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "github.com") {
      return u.pathname.includes(TRUSTED_PATH_SEGMENT);
    }
    if (host === "codeload.github.com") {
      return u.pathname.startsWith(TRUSTED_PATH_SEGMENT);
    }
    return false;
  } catch {
    return false;
  }
}
