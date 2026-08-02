import { inr } from "@/lib/mock";

type FeeTotalsFooterProps = {
  totalAmount: number;
  totalPaid: number;
  totalOverdue: number;
};

export function FeeTotalsFooter({ totalAmount, totalPaid, totalOverdue }: FeeTotalsFooterProps) {
  return (
    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total amount</p>
          <p className="mt-1 text-lg font-bold text-foreground">{inr(totalAmount)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total paid</p>
          <p className="mt-1 text-lg font-bold text-success">{inr(totalPaid)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total overdue</p>
          <p className="mt-1 text-lg font-bold text-destructive">{inr(totalOverdue)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Totals include all records, not just this page.</p>
    </div>
  );
}
