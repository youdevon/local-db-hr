"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Download, RefreshCw } from "lucide-react";

import { saveUpdateManifestUrlAction } from "@/actions/update-check-settings";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import { UPDATE_CHECK_OFFLINE_MESSAGE } from "@/lib/update-manifest";
import { cn } from "@/lib/utils";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

type UpdateCheckResponse = {
  installedVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseTag: string | null;
  releaseDate: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  notes: string[];
  requiresDatabaseMigration: boolean | null;
  requiresDockerRebuild: boolean | null;
  checkedAt: string;
  error: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatReleaseDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  return value;
}

type Props = {
  installedVersion: string;
  initialManifestUrl: string;
};

export function LicenseUpdatesSection({ installedVersion, initialManifestUrl }: Props) {
  const router = useRouter();
  const [manifestUrl, setManifestUrl] = useState(initialManifestUrl);
  const [savingUrl, setSavingUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResponse | null>(null);

  async function saveManifestUrl() {
    setSavingUrl(true);
    try {
      const res = await saveUpdateManifestUrlAction({ manifestUrl });
      if (!res.success) {
        notifyError(res.message);
        return;
      }
      notifySuccess(res.message);
      router.refresh();
    } finally {
      setSavingUrl(false);
    }
  }

  async function checkForUpdates() {
    setChecking(true);
    try {
      const res = await fetch("/api/system/update-check", { method: "GET", credentials: "include" });
      const data = (await res.json()) as UpdateCheckResponse | { error?: string };
      if (!res.ok) {
        notifyError(typeof data === "object" && data && "error" in data && data.error ? String(data.error) : "Update check failed.");
        return;
      }
      setResult(data as UpdateCheckResponse);
      const body = data as UpdateCheckResponse;
      if (body.error) {
        notifyError(body.error);
      } else if (body.updateAvailable) {
        notifySuccess("An update is available. Review the release notes and follow the manual upgrade steps below.");
      } else {
        notifySuccess("This installation is up to date.");
      }
    } catch {
      notifyError(UPDATE_CHECK_OFFLINE_MESSAGE);
    } finally {
      setChecking(false);
    }
  }

  const status: "idle" | "uptodate" | "available" | "offline" = !result
    ? "idle"
    : result.error
      ? "offline"
      : result.updateAvailable
        ? "available"
        : "uptodate";

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Updates</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Check for approved releases published on GitHub. Updates are never installed automatically; administrators download
          packages and upgrade manually.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Status</span>
          {status === "idle" ? (
            <Badge variant="outline">Not checked yet</Badge>
          ) : null}
          {status === "uptodate" ? (
            <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
              Up to date
            </Badge>
          ) : null}
          {status === "available" ? (
            <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Update available
            </Badge>
          ) : null}
          {status === "offline" ? (
            <Badge variant="destructive">Unable to check</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Installed version" value={installedVersion} />
          <Info label="Latest available version" value={result?.latestVersion ?? "—"} />
          <Info label="Last checked" value={result ? formatDateTime(result.checkedAt) : "—"} />
          <Info label="Release date" value={result?.releaseDate ? formatReleaseDate(result.releaseDate) : "—"} />
          <Info
            label="Database migration required"
            value={
              result?.requiresDatabaseMigration == null ? "—" : result.requiresDatabaseMigration ? "Yes" : "No"
            }
          />
          <Info
            label="Docker rebuild required"
            value={result?.requiresDockerRebuild == null ? "—" : result.requiresDockerRebuild ? "Yes" : "No"}
          />
        </div>

        {result?.error ? (
          <p className="mt-4 rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            {result.error}
          </p>
        ) : null}

        {result?.notes && result.notes.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Release notes</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {result.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void checkForUpdates()} disabled={checking}>
            {checking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for updates
              </>
            )}
          </Button>
          {result?.releaseUrl ? (
            <a
              href={result.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open release page
            </a>
          ) : null}
          {result?.downloadUrl ? (
            <a
              href={result.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
            >
              <Download className="mr-2 h-4 w-4" />
              Download update package
            </a>
          ) : null}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="font-heading mb-2 text-sm font-bold tracking-tight">Update manifest URL</h3>
        <p className="text-muted-foreground mb-3 text-sm">
          Licensed deployments should use the approved manifest on the{" "}
          <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">Licensed-Upgrades</code> branch (or an
          equivalent HTTPS source you control).
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Manifest URL</Label>
          <Input value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} spellCheck={false} className="font-mono text-sm" />
          <Button type="button" variant="secondary" onClick={() => void saveManifestUrl()} disabled={savingUrl || manifestUrl.trim() === initialManifestUrl.trim()}>
            {savingUrl ? "Saving…" : "Save manifest URL"}
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="font-heading mb-2 text-sm font-bold tracking-tight">Manual upgrade steps</h3>
        <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
          <li>Create a backup of the database and application files.</li>
          <li>Download the approved release package from GitHub.</li>
          <li>Copy or extract the release package on the server.</li>
          <li>Preserve the existing <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">.env</code> file.</li>
          <li>Run the approved update/install script.</li>
          <li>
            Rebuild using{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">docker compose build --pull=false</code>.
          </li>
          <li>
            Start the app using{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">docker compose up -d</code>.
          </li>
          <li>
            Run Prisma migrations using{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">npx prisma migrate deploy</code>.
          </li>
          <li>Confirm the application opens and the version number has updated.</li>
        </ol>
        <div
          className={cn(
            "mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm",
            "text-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:text-red-200",
          )}
        >
          <p className="font-medium">Safety warnings</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Do not run <code className="rounded bg-muted/80 px-1 text-xs text-foreground">docker compose down -v</code>.</li>
            <li>Do not delete Docker volumes.</li>
            <li>Do not overwrite <code className="rounded bg-muted/80 px-1 text-xs text-foreground">.env</code>.</li>
            <li>Do not run <code className="rounded bg-muted/80 px-1 text-xs text-foreground">prisma migrate reset</code>.</li>
            <li>Do not pull directly from main/dev branches on licensed machines.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium break-all">{value || "—"}</p>
    </div>
  );
}
