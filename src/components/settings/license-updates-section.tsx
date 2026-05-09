"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Download, RefreshCw, Package, Loader2 } from "lucide-react";

import { saveUpdateManifestUrlAction } from "@/actions/update-check-settings";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { UPDATE_CHECK_OFFLINE_MESSAGE } from "@/lib/update-manifest";
import { cn } from "@/lib/utils";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

const INSTALL_PHASE_LABELS: Record<string, string> = {
  idle: "Idle",
  preparing_update: "Preparing update",
  downloading_package: "Downloading package",
  validating_package: "Validating package",
  backup_started: "Creating backup",
  backup_completed: "Backup complete",
  installing_files: "Installing files",
  rebuilding_application: "Rebuilding application",
  database_migration_started: "Running database migrations",
  restarting_application: "Restarting application",
  verifying_update: "Verifying update",
  completed: "Update complete",
  failed: "Update failed",
};

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

type InstallStatusResponse = {
  phase?: string;
  error?: string | null;
  success?: boolean | null;
  finishedAt?: string | null;
  backupPath?: string | null;
  targetVersion?: string | null;
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
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installRunning, setInstallRunning] = useState(false);
  const [installStatus, setInstallStatus] = useState<InstallStatusResponse | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/install-update/status", { credentials: "include" });
      const data = (await res.json()) as InstallStatusResponse;
      if (!res.ok) return;
      if (data.phase && data.phase !== "idle") {
        setInstallStatus(data);
      }
      if (data.phase === "completed" && data.success === true) {
        setInstallRunning(false);
        notifySuccess("Update completed. Refresh the page to confirm the installed version.");
        router.refresh();
        return;
      }
      if (data.phase === "failed" || data.success === false) {
        setInstallRunning(false);
        const msg =
          (data.error as string) ||
          "Update failed. See server logs under update-staging/install-update.log. A backup may be available.";
        notifyError(msg);
        if (data.backupPath) {
          notifyWarning(`Backup path: ${data.backupPath}`);
        }
      }
    } catch {
      // ignore transient poll errors
    }
  }, [router]);

  useEffect(() => {
    if (!installRunning) return;
    const first = setTimeout(() => {
      void pollStatus();
    }, 0);
    const t = setInterval(() => {
      void pollStatus();
    }, 2500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [installRunning, pollStatus]);

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
        notifySuccess("An update is available. Open the release page for full notes before installing.");
      } else {
        notifySuccess("This installation is up to date.");
      }
    } catch {
      notifyError(UPDATE_CHECK_OFFLINE_MESSAGE);
    } finally {
      setChecking(false);
    }
  }

  async function startInstall() {
    setInstallDialogOpen(false);
    setInstallRunning(true);
    setInstallStatus({ phase: "preparing_update" });
    try {
      const res = await fetch("/api/system/install-update", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { error?: string; accepted?: boolean; message?: string };
      if (!res.ok) {
        setInstallRunning(false);
        notifyError(data.error || "Install could not be started.");
        return;
      }
      if (data.message) {
        notifyWarning(data.message);
      }
    } catch {
      setInstallRunning(false);
      notifyError("Failed to start install. The server may be misconfigured (e.g. DB_HR_PROJECT_ROOT in Docker).");
    }
  }

  const status: "idle" | "uptodate" | "available" | "offline" = !result
    ? "idle"
    : result.error
      ? "offline"
      : result.updateAvailable
        ? "available"
        : "uptodate";

  const phaseLabel = installStatus?.phase
    ? INSTALL_PHASE_LABELS[installStatus.phase] ?? installStatus.phase
    : null;

  const showInstallButton = Boolean(result?.updateAvailable && !result?.error);

  const releaseNotesHint =
    result?.requiresDatabaseMigration || result?.requiresDockerRebuild
      ? [
          result.requiresDatabaseMigration
            ? "This release may run database migrations (prisma migrate deploy only)."
            : null,
          result.requiresDockerRebuild ? "This release may expect a Docker image rebuild and container restart." : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Updates</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Compare this installation to approved GitHub releases. Install runs on the server from the manifest; the app may
          restart during installation after a backup.
        </p>

        <p className="text-destructive dark:text-red-300 mb-4 rounded-md border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm">
          Automatic rollback is not implemented. If an update fails, use the backup under{" "}
          <code className="text-foreground font-mono text-xs">backups/updates/</code> and follow your recovery procedure.
          Do not run destructive Docker or Prisma commands.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Update status</span>
          {status === "idle" ? <Badge variant="outline">Not checked yet</Badge> : null}
          {status === "uptodate" ? (
            <Badge
              variant="secondary"
              className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
            >
              Up to date
            </Badge>
          ) : null}
          {status === "available" ? (
            <Badge
              variant="secondary"
              className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Update available
            </Badge>
          ) : null}
          {status === "offline" ? <Badge variant="destructive">Unable to check</Badge> : null}
        </div>

        <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="border-border/80 flex flex-col gap-0.5 border-b pb-3 sm:border-0 sm:pb-0">
            <dt className="text-muted-foreground text-xs">Installed version</dt>
            <dd className="font-medium">{installedVersion}</dd>
          </div>
          <div className="border-border/80 flex flex-col gap-0.5 border-b pb-3 sm:border-0 sm:pb-0">
            <dt className="text-muted-foreground text-xs">Latest available</dt>
            <dd className="font-medium">{result?.latestVersion ?? "—"}</dd>
          </div>
          <div className="border-border/80 flex flex-col gap-0.5 border-b pb-3 sm:border-0 sm:pb-0 sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Last checked</dt>
            <dd className="font-medium">{result ? formatDateTime(result.checkedAt) : "—"}</dd>
          </div>
          {result?.releaseDate ? (
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Release date</dt>
              <dd className="font-medium">{formatReleaseDate(result.releaseDate)}</dd>
            </div>
          ) : null}
        </dl>

        {result?.error ? (
          <p className="mt-2 rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            {result.error}
          </p>
        ) : null}

        {releaseNotesHint ? (
          <p
            className={cn(
              "mt-3 rounded-md border px-3 py-2 text-sm leading-relaxed",
              "border-slate-200 bg-slate-100/90 text-slate-900",
              "dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100",
            )}
          >
            {releaseNotesHint}
          </p>
        ) : null}

        {installRunning || phaseLabel ? (
          <div className="mt-4 space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">Install progress</p>
            <p className="text-muted-foreground flex items-center gap-2">
              {installRunning ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              {installRunning
                ? phaseLabel || "Update has started. The app may restart — please wait…"
                : phaseLabel || "—"}
            </p>
            <p className="text-muted-foreground text-xs">
              Live status: <code className="text-foreground">update-staging/install-status.json</code>,{" "}
              <code className="text-foreground">update-staging/install-update.log</code>.
            </p>
            {installStatus?.backupPath && !installRunning ? (
              <p className="text-destructive text-xs">Last backup: {installStatus.backupPath}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void checkForUpdates()} disabled={checking || installRunning}>
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
          {showInstallButton ? (
            <Button
              type="button"
              variant="default"
              onClick={() => setInstallDialogOpen(true)}
              disabled={installRunning}
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              <Package className="mr-2 h-4 w-4" />
              Install update
            </Button>
          ) : null}
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

        <div className="border-border mt-6 border-t pt-5">
          <h3 className="font-heading mb-2 text-sm font-semibold tracking-tight">Update manifest URL</h3>
          <p className="text-muted-foreground mb-3 text-xs sm:text-sm">
            Use the approved manifest (e.g. <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">Licensed-Upgrades</code> branch)
            or another HTTPS source you control.
          </p>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Manifest URL</Label>
            <Input
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              spellCheck={false}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void saveManifestUrl()}
              disabled={savingUrl || manifestUrl.trim() === initialManifestUrl.trim()}
            >
              {savingUrl ? "Saving…" : "Save manifest URL"}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Install update</DialogTitle>
            <DialogDescription className="space-y-3 text-left">
              <span className="block">
                This will download and install Local DB HR{" "}
                <strong className="text-foreground">v{result?.latestVersion}</strong>. A database and application backup
                will be created before any changes are applied. The application may be unavailable for a few minutes
                during the update.
              </span>
              <span className="text-muted-foreground block">
                There is no automatic database or application rollback in this release. Backups are kept on the server
                for manual recovery.
              </span>
              {result?.requiresDatabaseMigration ? (
                <span className="text-amber-800 dark:text-amber-200 block">
                  This update may run Prisma migrations (deploy only).
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInstallDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void startInstall()}>
              Confirm install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
