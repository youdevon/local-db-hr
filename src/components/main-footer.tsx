import { APP_CONFIG } from "@/lib/app-config";

export function MainFooter() {
  return (
    <footer
      className="border-border bg-background/95 text-muted-foreground supports-backdrop-filter:backdrop-blur-sm z-20 flex h-12 shrink-0 items-center justify-center border-t px-6 text-xs lg:px-8"
      role="contentinfo"
    >
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-center">
        <span className="text-muted-foreground text-xs leading-none whitespace-nowrap">
          {APP_CONFIG.copyright}
        </span>
      </div>
    </footer>
  );
}
