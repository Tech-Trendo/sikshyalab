import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getWebLoginUrl, redirectToWebLogin } from "@/lib/web-url";

/**
 * Dashboard no longer hosts its own sign-in UI.
 * Always send users to the public site login form.
 */
export const Route = createFileRoute("/login")({
  component: LoginRedirectPage,
});

function LoginRedirectPage() {
  useEffect(() => {
    redirectToWebLogin();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      <a href={getWebLoginUrl()} className="text-sm font-medium text-primary underline">
        Continue to sign in
      </a>
    </div>
  );
}
