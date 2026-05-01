import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared max-width, horizontal padding, and bottom spacing so the sticky main footer
 * does not cover page content.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1400px] space-y-6 px-6 py-6 pb-20 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
