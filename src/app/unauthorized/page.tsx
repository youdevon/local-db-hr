import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <PageContainer className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">Access denied.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to view this page.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/profile" className={buttonVariants({ variant: "outline", className: "h-10 rounded-md" })}>
            Back to Profile
          </Link>
          <Link href="/" className={buttonVariants({ className: "h-10 rounded-md" })}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
