import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, ResponsiveTable, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { DashboardSectionLinks } from "@/components/dashboard/DashboardSectionLinks";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  usePromoteReviewMutation,
  useReviewsQuery,
  useUpdateReviewStatusMutation,
  useExportReviewsToTestimonialsMutation,
} from "@/hooks/useCmsQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/Rating";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MessageSquareQuote, Sparkles, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { averageRating, formatRating } from "@/lib/rating";
import { paginate } from "@/lib/dashboard-utils";

export const Route = createFileRoute("/dashboard/reviews")({
  component: ReviewsPage,
});

const statusTone: Record<string, string> = {
  PENDING: "bg-highlight/15 text-highlight",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
};

function ReviewActions({
  r,
  onApprove,
  onReject,
  onPromote,
  promoting,
}: {
  r: { id: string | number; status: string; is_promoted?: boolean };
  onApprove: () => void;
  onReject: () => void;
  onPromote: () => void;
  promoting: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {r.status === "PENDING" && (
        <>
          <Button size="sm" variant="outline" onClick={onApprove}>
            Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            Reject
          </Button>
        </>
      )}
      {!r.is_promoted && r.status !== "REJECTED" && (
        <Button size="sm" variant="highlight" disabled={promoting} onClick={onPromote}>
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Export
        </Button>
      )}
      {r.is_promoted && (
        <Badge variant="secondary" className="gap-1">
          <MessageSquareQuote className="h-3 w-3" /> On site
        </Badge>
      )}
    </div>
  );
}

function ReviewsPage() {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useReviewsQuery();
  const promote = usePromoteReviewMutation();
  const exportAll = useExportReviewsToTestimonialsMutation();
  const updateStatus = useUpdateReviewStatusMutation();
  const [page, setPage] = useState(1);

  const exportableCount = reviews.filter((r) => !r.is_promoted && r.status !== "REJECTED").length;
  const avgRating = useMemo(() => averageRating(reviews), [reviews]);
  const pendingCount = useMemo(() => reviews.filter((r) => r.status === "PENDING").length, [reviews]);
  const paged = useMemo(() => paginate(reviews, page), [reviews, page]);

  const handlePromote = (id: string | number) => {
    void promote.mutateAsync(id).then(() => toast.success("Review exported to testimonials"));
  };

  const handleBulkExport = () => {
    void exportAll.mutateAsync({ only_approved: true }).then((res) => {
      toast.success(`Exported ${res?.count ?? 0} review(s) to testimonials`);
    });
  };

  return (
    <>
      <PageHeader
        title="Review management"
        subtitle="Student course reviews submitted after completion. Export approved reviews to testimonials."
        action={
          <Button
            size="sm"
            variant="highlight"
            className="w-full sm:w-auto"
            disabled={exportAll.isPending || exportableCount === 0}
            onClick={handleBulkExport}
          >
            <Upload className="mr-1 h-4 w-4" /> Export to testimonials
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total reviews" value={reviews.length} icon={MessageSquareQuote} tone="primary" />
        <StatCard label="Avg rating" value={formatRating(avgRating)} icon={Star} tone="highlight" />
        <StatCard label="Pending" value={pendingCount} icon={Sparkles} tone="info" />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <div className="flex justify-center py-10" role="status" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              <span className="sr-only">Loading reviews</span>
            </div>
          ) : (
            <>
              <ResponsiveTable
                mobile={paged.items.map((r) => (
                  <Card key={String(r.id)} className="border-border/60">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{r.student_name}</p>
                          <p className="text-xs text-muted-foreground">{r.course_name}</p>
                        </div>
                        <Badge className={statusTone[r.status] || ""}>{r.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.content}</p>
                      <Rating value={r.rating} size="sm" showValue />
                      <ReviewActions
                        r={r}
                        promoting={promote.isPending}
                        onApprove={() =>
                          void updateStatus.mutateAsync({ id: r.id, status: "APPROVED" }).then(() =>
                            toast.success("Review approved"),
                          )
                        }
                        onReject={() =>
                          void updateStatus.mutateAsync({ id: r.id, status: "REJECTED" }).then(() =>
                            toast.message("Review rejected"),
                          )
                        }
                        onPromote={() => handlePromote(r.id)}
                      />
                    </CardContent>
                  </Card>
                ))}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.items.map((r) => (
                      <TableRow key={String(r.id)}>
                        <TableCell>
                          <p className="text-sm font-medium">{r.student_name}</p>
                          <p className="text-xs text-muted-foreground">{r.student_email}</p>
                        </TableCell>
                        <TableCell className="text-sm">{r.course_name}</TableCell>
                        <TableCell>
                          <Rating value={r.rating} size="sm" showValue />
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">{r.content}</TableCell>
                        <TableCell>
                          <Badge className={statusTone[r.status] || ""}>{r.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <ReviewActions
                            r={r}
                            promoting={promote.isPending}
                            onApprove={() =>
                              void updateStatus.mutateAsync({ id: r.id, status: "APPROVED" }).then(() =>
                                toast.success("Review approved"),
                              )
                            }
                            onReject={() =>
                              void updateStatus.mutateAsync({ id: r.id, status: "REJECTED" }).then(() =>
                                toast.message("Review rejected"),
                              )
                            }
                            onPromote={() => handlePromote(r.id)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {reviews.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          No student reviews yet. Reviews appear here when learners complete a course and submit feedback.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
              <DataPagination
                page={paged.page}
                totalPages={paged.totalPages}
                total={paged.total}
                from={paged.from}
                to={paged.to}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DashboardSectionLinks role={user.role} section="/dashboard/reviews" className="mt-6" />
    </>
  );
}
