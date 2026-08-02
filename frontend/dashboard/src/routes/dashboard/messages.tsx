import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import {
  useContactMessagesQuery,
  useDeleteContactMessageMutation,
  useSetContactMessageStatusMutation,
} from "@/hooks/useCmsQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, PhoneCall, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import type { CmsContactMessage } from "@/lib/cms-api";

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
});

const STATUSES = ["PENDING", "CONTACTED", "CONVERTED", "LOST"] as const;
type MessageStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<MessageStatus, string> = {
  PENDING: "Pending",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  LOST: "Lost",
};

function resolveStatus(m: CmsContactMessage): MessageStatus {
  const s = (m.status || "").toUpperCase();
  if (s === "CONTACTED" || s === "CONVERTED" || s === "LOST" || s === "PENDING") return s;
  if (m.replied_at) return "CONTACTED";
  if (m.is_read) return "CONTACTED";
  return "PENDING";
}

function statusBadgeVariant(status: MessageStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "PENDING") return "default";
  if (status === "CONTACTED") return "secondary";
  if (status === "CONVERTED") return "outline";
  return "destructive";
}

function MessagesPage() {
  const { data: messages = [], isLoading } = useContactMessagesQuery();
  const setStatus = useSetContactMessageStatusMutation();
  const remove = useDeleteContactMessageMutation();

  const counts = {
    PENDING: messages.filter((m) => resolveStatus(m) === "PENDING").length,
    CONTACTED: messages.filter((m) => resolveStatus(m) === "CONTACTED").length,
    CONVERTED: messages.filter((m) => resolveStatus(m) === "CONVERTED").length,
    LOST: messages.filter((m) => resolveStatus(m) === "LOST").length,
  };

  const updateStatus = async (id: string | number, status: MessageStatus) => {
    const res = await setStatus.mutateAsync({ id, status });
    if (res) toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    else toast.error("Could not update status");
  };

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Contact form, enroll requests, and newsletter subscriptions — status: Pending → Contacted → Converted / Lost."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={counts.PENDING} icon={Mail} tone="primary" />
        <StatCard label="Contacted" value={counts.CONTACTED} icon={PhoneCall} tone="info" />
        <StatCard label="Converted" value={counts.CONVERTED} icon={UserCheck} tone="success" />
        <StatCard label="Lost" value={counts.LOST} icon={UserX} tone="highlight" />
      </div>

      {isLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading messages…
        </p>
      )}

      <div className="mt-6 space-y-3">
        {messages.map((m) => {
          const status = resolveStatus(m);
          return (
            <Card
              key={String(m.id)}
              className={`border-border/60 ${status === "PENDING" ? "bg-primary/5" : ""}`}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <Badge variant={statusBadgeVariant(status)}>{STATUS_LABEL[status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.email}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium">{m.subject}</p>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{m.message}</p>
                    {m.created_at ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={status === s ? "default" : "outline"}
                      disabled={setStatus.isPending || status === s}
                      onClick={() => void updateStatus(m.id, s)}
                    >
                      {STATUS_LABEL[s]}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() =>
                      void remove.mutateAsync(m.id).then(() => toast.success("Message deleted"))
                    }
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!messages.length && !isLoading && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </div>
    </>
  );
}
