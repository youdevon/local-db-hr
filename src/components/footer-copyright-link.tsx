import { APP_CONFIG } from "@/lib/app-config";
import { cn } from "@/lib/utils";

const SUPPORT_MAILTO =
  "mailto:D3serv@outlook.com?subject=Local%20DB%20HR%20Support";

export function FooterCopyrightLink({ className }: { className?: string }) {
  return (
    <a
      href={SUPPORT_MAILTO}
      className={cn(
        "text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
        className,
      )}
      aria-label="Email D3 Services"
    >
      {APP_CONFIG.copyright}
    </a>
  );
}
