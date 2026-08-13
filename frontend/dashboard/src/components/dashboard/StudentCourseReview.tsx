import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Rating } from "@/components/ui/Rating";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useSubmitReviewMutation, useReviewsQuery } from "@/hooks/useCmsQueries";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  courseName: string;
  completed: boolean;
};

export function StudentCourseReview({ courseName, completed }: Props) {
  const { user } = useAuth();
  const { data: reviews = [] } = useReviewsQuery();
  const submit = useSubmitReviewMutation();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");

  const existing = useMemo(
    () => reviews.find((r) => r.course_name === courseName && r.student_name === user.name),
    [reviews, courseName, user.name],
  );

  if (!completed) return null;

  if (existing) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader>
          <CardTitle className="text-base">Thank you for your review</CardTitle>
          <p className="text-xs text-muted-foreground">
            Your feedback for {courseName} is {existing.status.toLowerCase()}.
            {existing.is_promoted
              ? " It is now shown as a testimonial on our website."
              : " Our team will review it shortly."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm italic text-foreground/90">&ldquo;{existing.content}&rdquo;</p>
          <Rating value={existing.rating} size="sm" showValue />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-highlight/40">
      <CardHeader>
        <CardTitle className="text-base">Share your experience</CardTitle>
        <p className="text-xs text-muted-foreground">
          You completed <strong className="text-foreground">{courseName}</strong>. Tell us how it went — your
          review may be featured on our website.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Rating</Label>
          <div className="mt-2">
            <Rating
              value={rating || null}
              interactive
              size="lg"
              emptyLabel=""
              onChange={setRating}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="student-course-review">Your review</Label>
          <Textarea
            id="student-course-review"
            name="review"
            className="mt-1.5"
            rows={4}
            placeholder="What did you learn? How did Shiksha Lab help your career?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <Button
          className="btn-highlight"
          disabled={rating < 1 || !content.trim() || submit.isPending}
          onClick={() =>
            void submit
              .mutateAsync({
                student_name: user.name,
                student_email: user.email,
                course_name: courseName,
                rating,
                content: content.trim(),
              })
              .then(() => {
                toast.success("Review submitted — thank you!");
                setContent("");
                setRating(0);
              })
          }
        >
          Submit review
        </Button>
      </CardContent>
    </Card>
  );
}
