import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/unauthorized")({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-xl border-border/60">
        <CardContent className="p-6">
          <h1 className="text-lg font-semibold">403 - Unauthorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don’t have permission to view this page.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/dashboard" prefetch="intent">
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

